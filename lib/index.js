/**
 * Thinking-token statistics — node half.
 *
 * This half does one thing: it registers the `thinkingStats` session projection, a
 * single incremental fold of the session's assistant settlements into per-turn
 * thinking/output figures plus whole-session aggregates. The browser half reads that
 * value and draws it.
 *
 * Why a projection rather than reading the conversation: DSH's own statistics ride
 * durable projections precisely because the client window is paged and compaction
 * rewrites it, so anything folded from the window is local and unstable. A projection
 * is folded by the host over the whole event log, checkpointed under
 * `<root>/session_projcache/sessions/`, and served to clients as one small JSON value —
 * which is why the readout is instant on a conversation of any length, and why this
 * plugin never has to load a single message.
 *
 * The fold is deliberately small: one event type, six numbers per turn, model names in
 * a dictionary. Nothing here re-reads the log, and nothing accumulates per event.
 *
 * @module dsh-thinking-token-stat
 */

/** The projection's key, also the client's `useProjection` selector. */
const KEY = "thinkingStats";
/**
 * Bumped whenever the fold's state or its meaning changes. A stored checkpoint whose
 * version differs is discarded by the host, which then refolds that session's log from
 * the beginning — correct, and the reason this number must not churn.
 *
 * 2 — reasoning text is priced per script instead of at a flat four characters per
 * token, so every stored fold has to be rebuilt for the new densities.
 */
const STATE_VERSION = 2;
/**
 * Characters per token, by script.
 *
 * A single flat four characters per token is an English rule, and it under-counts every
 * other script by two to four times. The three densities here follow measured tokenizer
 * behaviour rather than a guess: CJK/Kana/Hangul tokenize at roughly 0.6–1.7 tokens per
 * character depending on the tokenizer (DeepSeek's and Qwen's own tokenizers are at the
 * dense end, ~0.6–0.8), Cyrillic, Greek, Arabic, Hebrew and the Indic scripts sit between
 * that and English at roughly 2–3 characters per token, and Latin prose with its digits
 * and punctuation stays at four. Taking the dense end as 1 character per token is
 * deliberately the conservative choice for a Chinese-optimised model: it reads slightly
 * high rather than presenting an underestimate as a measurement.
 *
 * Astral-plane CJK (extension B and beyond) is not listed: it is rare in reasoning text,
 * and matching it would mean a unicode-flagged regex over every block for two code units
 * per character.
 */
const DENSE_PER_TOKEN = 1;
const MEDIUM_PER_TOKEN = 2.5;
const SPARSE_PER_TOKEN = 4;
/**
 * The dense scripts: CJK symbols and punctuation, Kana, CJK ideographs (unified and
 * extension A), Hangul syllables, compatibility ideographs, and fullwidth forms.
 */
const DENSE_CHARS = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/g;
/**
 * The scripts between the two extremes: Greek, Cyrillic, Armenian, Hebrew, Arabic and its
 * supplements, Syriac, Thaana, the Brahmic scripts, Thai, Lao, Tibetan, Myanmar, Georgian
 * and Ethiopic.
 */
const MEDIUM_CHARS = /[\u0370-\u03ff\u0400-\u052f\u0530-\u058f\u0590-\u05ff\u0600-\u06ff\u0700-\u074f\u0750-\u077f\u0780-\u07bf\u08a0-\u08ff\u0900-\u097f\u0980-\u09ff\u0a00-\u0a7f\u0a80-\u0aff\u0b00-\u0b7f\u0b80-\u0bff\u0c00-\u0c7f\u0c80-\u0cff\u0d00-\u0d7f\u0d80-\u0dff\u0e00-\u0e7f\u0e80-\u0eff\u0f00-\u0fff\u1000-\u109f\u10a0-\u10ff\u1200-\u137f\u1780-\u17ff]/g;
/** Per-turn rows kept in the persisted state; older rows fold into the aggregates. */
const STORED_TURNS = 5000;
/**
 * Per-turn rows published to clients. A client-visible projection value rides every
 * snapshot frame, so the view is held to a size a UI can afford — the newest couple of
 * hundred turns — while the aggregates above stay whole-session.
 */
const VIEW_TURNS = 200;

/** Marker for "this value is not what the schema promises". */
const INVALID = Symbol("invalid");

/** A non-negative safe integer, or null. */
function asCount(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** A non-negative safe integer, or 0 — usage records are optional. */
function count(value) {
	const parsed = asCount(value);
	return parsed === null ? 0 : parsed;
}

/**
 * A minimal `{ parse }` schema.
 *
 * The registry only ever calls `.parse` — on a stored checkpoint's state, and on a view
 * before publishing it — so a validation library would buy nothing but an install step
 * and another version to track. `parse` throws on anything it cannot vouch for, exactly
 * as a library's would: the registry reads a throw on restore as "row unusable, refold
 * from init".
 * @param check - validator returning the value, or `INVALID`.
 * @returns the schema object the registry expects.
 */
function schema(check) {
	return {
		parse(value) {
			const parsed = check(value);
			if (parsed === INVALID) throw new Error("thinkingStats: invalid projection value");
			return parsed;
		}
	};
}

/** The aggregate field names, in schema order. */
const TOTALS_FIELDS = ["thinking", "reported", "folded", "output", "total", "turns", "settledTurns", "reasoningTurns", "foldedTurns"];

/** Whether a value is the aggregate record the fold maintains. */
function isTotals(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	for (const field of TOTALS_FIELDS) if (asCount(value[field]) === null) return false;
	return Object.keys(value).length === TOTALS_FIELDS.length;
}

/** Whether an array is a list of dictionary indices. */
function isRefs(value, labels) {
	return Array.isArray(value) && value.every((ref) => asCount(ref) !== null && ref < labels.length);
}

/** A stored per-turn row: `[turn, thinking, reported, folded, output, total, refs, settled]`. */
function isStoredRow(row, labels) {
	if (!Array.isArray(row) || row.length !== 8) return false;
	for (let index = 0; index < 6; index += 1) if (asCount(row[index]) === null) return false;
	if (!isRefs(row[6], labels)) return false;
	return row[7] === 0 || row[7] === 1;
}

/** A published per-turn row: `[turn, thinking, reported, folded, output, refs]`. */
function isViewRow(row, labels) {
	if (!Array.isArray(row) || row.length !== 6) return false;
	for (let index = 0; index < 5; index += 1) if (asCount(row[index]) === null) return false;
	return isRefs(row[5], labels);
}

/** Whether a value is a string dictionary. */
function isLabels(value) {
	return Array.isArray(value) && value.every((label) => typeof label === "string");
}

/** The persisted fold state. */
const stateSchema = schema((value) => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return INVALID;
	const { floor, labels, turns, totals, last } = value;
	if (floor !== -1 && asCount(floor) === null) return INVALID;
	if (!isLabels(labels)) return INVALID;
	if (!Array.isArray(turns) || turns.length > STORED_TURNS || !turns.every((row) => isStoredRow(row, labels))) return INVALID;
	if (!isTotals(totals)) return INVALID;
	if (last !== null) {
		if (!Array.isArray(last) || last.length !== 8) return INVALID;
		for (let index = 0; index < 7; index += 1) if (asCount(last[index]) === null) return INVALID;
		if (last[7] !== -1 && (asCount(last[7]) === null || last[7] >= labels.length)) return INVALID;
	}
	return value;
});

/** The client-visible value. */
const viewSchema = schema((value) => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return INVALID;
	const { asOfTurn, turnCount, totals, labels, turns } = value;
	if (asCount(asOfTurn) === null || asCount(turnCount) === null) return INVALID;
	if (!isTotals(totals) || !isLabels(labels)) return INVALID;
	if (!Array.isArray(turns) || turns.length > VIEW_TURNS || !turns.every((row) => isViewRow(row, labels))) return INVALID;
	return value;
});

/** The aggregate record of a session that has folded nothing yet. */
function emptyTotals() {
	return {
		thinking: 0,
		reported: 0,
		folded: 0,
		output: 0,
		total: 0,
		turns: 0,
		settledTurns: 0,
		reasoningTurns: 0,
		foldedTurns: 0
	};
}

/** The all-zero row an aggregate diff is taken against when a turn is new. */
const ZERO_ROW = [0, 0, 0, 0, 0, 0, [], 0];

/**
 * Price reasoning text in tokens, by script.
 *
 * Two `replace` passes measure the dense and middle scripts and the remainder is Latin
 * and punctuation; the three counts are divided by their densities once, so a settlement
 * costs two string scans and no per-character work. Measured over a real session's 890k
 * characters of reasoning, this is 1.7 ms in total — the fold it feeds is 5 ms.
 * @param content - the settled message's content blocks.
 * @returns estimated tokens, 0 when there is no reasoning text.
 */
function estimateReasoningTokens(content) {
	if (!Array.isArray(content)) return 0;
	let chars = 0;
	let dense = 0;
	let medium = 0;
	for (const block of content) {
		if (block === null || typeof block !== "object") continue;
		if (block.type !== "reasoning" || typeof block.text !== "string") continue;
		const text = block.text;
		const withoutDense = text.replace(DENSE_CHARS, "");
		const withoutMedium = withoutDense.replace(MEDIUM_CHARS, "");
		chars += text.length;
		dense += text.length - withoutDense.length;
		medium += withoutDense.length - withoutMedium.length;
	}
	if (chars === 0) return 0;
	const sparse = chars - dense - medium;
	return Math.ceil(dense / DENSE_PER_TOKEN + medium / MEDIUM_PER_TOKEN + sparse / SPARSE_PER_TOKEN);
}

/**
 * One assistant settlement's own contribution to its turn.
 *
 * Thinking is the provider's own reasoning count when it reports one, and otherwise a
 * fold of the reasoning text at that text's per-script density — the case this plugin
 * exists for, because a provider that omits the count would otherwise read as having
 * produced no reasoning at all.
 * @param event - a committed session event.
 * @returns the contribution, or null when the event is not a settled assistant message.
 */
function contributionOf(event) {
	const data = event.data;
	if (data === null || typeof data !== "object") return null;
	const turn = asCount(data.turn);
	if (turn === null) return null;
	const usage = data.usage !== null && typeof data.usage === "object" ? data.usage : {};
	const reported = count(usage.reasoningTokens);
	const content = data.message !== null && typeof data.message === "object" ? data.message.content : null;
	const folded = reported > 0 ? 0 : estimateReasoningTokens(content);
	const output = count(usage.outputTokens);
	const total = count(usage.inputTokens) + output + count(usage.cacheReadTokens) + count(usage.cacheWriteTokens);
	const source = data.message !== null && typeof data.message === "object" && data.message.source !== null && typeof data.message.source === "object"
		? data.message.source
		: null;
	const provider = source !== null && typeof source.provider === "string" ? source.provider : "";
	const model = source !== null && typeof source.model === "string" ? source.model : "";
	return {
		turn,
		step: asCount(data.step) === null ? -1 : data.step,
		thinking: reported + folded,
		reported,
		folded,
		output,
		total,
		label: provider !== "" && model !== "" ? provider + "/" + model : null
	};
}

/** The aggregates after one turn row changed, as a diff against the row it replaced. */
function aggregate(totals, previous, next) {
	const nextTotals = { ...totals };
	nextTotals.thinking += next[1] - previous[1];
	nextTotals.reported += next[2] - previous[2];
	nextTotals.folded += next[3] - previous[3];
	// The shares are measured against the turns that actually reasoned, so a turn
	// entering or leaving that set moves its whole output and denominator with it.
	const was = previous[1] > 0;
	const now = next[1] > 0;
	if (was && now) {
		nextTotals.output += next[4] - previous[4];
		nextTotals.total += next[5] - previous[5];
	} else if (was) {
		nextTotals.output -= previous[4];
		nextTotals.total -= previous[5];
	} else if (now) {
		nextTotals.output += next[4];
		nextTotals.total += next[5];
	}
	if (!was && now) nextTotals.reasoningTurns += 1;
	if (was && !now) nextTotals.reasoningTurns -= 1;
	if (previous[3] === 0 && next[3] > 0) nextTotals.foldedTurns += 1;
	if (previous[3] > 0 && next[3] === 0) nextTotals.foldedTurns -= 1;
	return nextTotals;
}

/**
 * The `thinkingStats` projection unit.
 * @returns the unit definition the registry accepts.
 */
function thinkingStatsProjection() {
	return {
		key: KEY,
		stateVersion: STATE_VERSION,
		stateSchema,
		/**
		 * @param header - immutable session metadata.
		 * @param inheritedEventCount - exact count of fork-inherited leading events.
		 * @returns the empty fold, floored past any inherited events.
		 */
		init: (_header, inheritedEventCount) => ({
			// A fork copies the parent's events into the child's log, and the host states
			// exactly how many, so the child counts only what it produced itself.
			floor: asCount(inheritedEventCount) !== null && inheritedEventCount > 0 ? inheritedEventCount : -1,
			labels: [],
			turns: [],
			totals: emptyTotals(),
			last: null
		}),
		/**
		 * Fold one committed event.
		 *
		 * Two event types matter: `turn/start` opens a turn (so a turn that never
		 * assembled a message still appears), and `assistant/message` adds that
		 * settlement's figures. Every other event returns the same state reference, which
		 * the registry reads as "nothing to recompute".
		 * @param state - the current fold.
		 * @param event - the committed event.
		 * @returns the next fold, or `state` when the event is not ours.
		 */
		apply: (state, event) => {
			if (state.floor >= 0 && asCount(event.seq) !== null && event.seq < state.floor) return state;
			// A turn is opened by its own boundary, not by its first settlement: a turn that
			// failed or was aborted never assembles a message, and a table that skipped it
			// would read as if the conversation had lost a turn. It is listed with no
			// figures, which is exactly what happened.
			if (event.type === "turn/start") {
				const turn = event.data !== null && typeof event.data === "object" ? asCount(event.data.turn) : null;
				if (turn === null) return state;
				const open = state.turns;
				const last = open.length === 0 ? null : open[open.length - 1];
				if (last !== null && last[0] === turn) return state;
				open.push([turn, 0, 0, 0, 0, 0, [], 0]);
				if (open.length > STORED_TURNS) open.splice(0, open.length - STORED_TURNS);
				return { ...state, turns: open, totals: { ...state.totals, turns: state.totals.turns + 1 } };
			}
			if (event.type !== "assistant/message") return state;
			const item = contributionOf(event);
			if (item === null) return state;

			// A retried step settles more than once; the later settlement replaces the
			// earlier one, so the previous contribution of the same (turn, step) is
			// subtracted rather than added a second time.
			const prior = state.last !== null && state.last[0] === item.turn && state.last[1] === item.step ? state.last : null;
			const delta = [
				item.thinking - (prior === null ? 0 : prior[2]),
				item.reported - (prior === null ? 0 : prior[3]),
				item.folded - (prior === null ? 0 : prior[4]),
				item.output - (prior === null ? 0 : prior[5]),
				item.total - (prior === null ? 0 : prior[6])
			];

			const labels = state.labels;
			let label = prior === null || prior[7] < 0 ? -1 : prior[7];
			if (item.label !== null) {
				const known = labels.indexOf(item.label);
				label = known < 0 ? labels.push(item.label) - 1 : known;
			}
			const own = label < 0 ? [] : [label];

			const turns = state.turns;
			const lastRow = turns.length === 0 ? null : turns[turns.length - 1];
			let totals;
			if (lastRow !== null && lastRow[0] === item.turn) {
				// The model column lists every model a turn ran on, so a second settlement
				// on another model adds its name rather than replacing the first.
				const refs = lastRow[6].slice();
				for (const ref of own) if (!refs.includes(ref)) refs.push(ref);
				const next = [lastRow[0], lastRow[1] + delta[0], lastRow[2] + delta[1], lastRow[3] + delta[2], lastRow[4] + delta[3], lastRow[5] + delta[4], refs, 1];
				// Only the newest row is ever rewritten, so the array can be shared with the
				// state being replaced; the state object itself is always new, which is the
				// reference the registry's change gate reads.
				turns[turns.length - 1] = next;
				totals = aggregate(state.totals, lastRow, next);
				// The row's flag says whether any settlement ever arrived for the turn, which
				// is what distinguishes a turn that reported nothing from a turn that failed
				// before it could report anything.
				if (lastRow[7] === 0) totals.settledTurns += 1;
			} else {
				const row = [item.turn, delta[0], delta[1], delta[2], delta[3], delta[4], own, 1];
				turns.push(row);
				totals = aggregate(state.totals, ZERO_ROW, row);
				totals.turns += 1;
				totals.settledTurns += 1;
				// Bounded state: the oldest rows stop being listed while their numbers stay
				// in the aggregates above.
				if (turns.length > STORED_TURNS) turns.splice(0, turns.length - STORED_TURNS);
			}
			return {
				...state,
				labels,
				turns,
				totals,
				last: [item.turn, item.step, item.thinking, item.reported, item.folded, item.output, item.total, label]
			};
		},
		wire: {
			viewSchema,
			/**
			 * Publish the newest turns and the whole-session aggregates.
			 * @param state - the current fold.
			 * @returns the client-visible value.
			 */
			view: (state) => {
				const turns = state.turns;
				const from = turns.length > VIEW_TURNS ? turns.length - VIEW_TURNS : 0;
				const published = [];
				for (let index = from; index < turns.length; index += 1) {
					const row = turns[index];
					published.push([row[0], row[1], row[2], row[3], row[4], row[6]]);
				}
				return {
					asOfTurn: published.length === 0 ? 0 : published[published.length - 1][0],
					turnCount: state.totals.turns,
					totals: state.totals,
					labels: state.labels,
					turns: published
				};
			}
		}
	};
}

/** Cordis plugin name. */
const name = "thinking-token-stat";
/** The projection registry is the whole point of this half; without it the fiber waits. */
const inject = ["sessionProjections"];

/**
 * Register the `thinkingStats` unit; the registration is an effect on this plugin's
 * fiber, so unloading the plugin removes the key and its cached cells.
 * @param ctx - registrant context carrying the projection registry.
 */
function apply(ctx) {
	ctx.sessionProjections.register(thinkingStatsProjection());
}

export { apply, inject, name };
/** Exported for the unit spec; not part of the host load path. */
export const __testProjection = { thinkingStatsProjection, stateSchema, viewSchema, contributionOf, KEY, STORED_TURNS, VIEW_TURNS };
