window.__ModuleLoader__.load({
	id: "dsh-thinking-token-stat",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let reactDom = require("react-dom");
		const h = react.createElement;
		const createPortal = reactDom.createPortal;
		const useAnchoredPosition = primitives.useAnchoredPosition;
		// Host icons, each with an inline fallback so a missing export degrades to a
		// drawn glyph instead of throwing.
		const ThinkIcon = primitives.IconThinkOutline16;
		const ChevronRightIcon = primitives.IconChevronRightOutline14;
		const ChevronLeftIcon = primitives.IconChevronLeftOutline14;
		const JumpIcon = primitives.IconRightUpOutline16;

		//#region styles
		// Injected once at module load (guarded), matching how shipped client bundles
		// mount their CSS. Theme tokens adapt to light/dark automatically.
		//
		// The readout mirrors ui-chat's StatsPills pill; the panels mirror ui-chat's
		// stat-dialog.module.css. The overview is content-sized; the per-turn table is
		// bounded and scrolls internally, because it grows with the conversation.
		const CSS = [
			// Dock readout. The anchor is portalled INTO the shipped stats row, so it
			// inherits that row's centring and 12px gap; the anchor itself only has to
			// restate the secondary font the row would otherwise provide.
			".dsh-tdock-anchor{min-width:0;display:inline-flex;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px))}",
			".dsh-tdock{box-sizing:border-box;max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;background:0 0;border:none;border-radius:24px;align-items:center;gap:6px;padding:1px 8px;display:inline-flex;cursor:pointer}",
			".dsh-tdock:hover,.dsh-tdock[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
			".dsh-tdock svg{flex:none;width:14px;height:14px}",
			".dsh-tdock-label{text-overflow:ellipsis;min-width:0;overflow:hidden}",
			".dsh-tdock-sep{color:var(--dsw-alias-separator-primary);margin:0 6px}",
			// Shared panel — ui-chat stat-dialog.module.css. The overview sizes to its
			// content; the per-turn table is bounded so its body can scroll.
			".dsh-tstat-panel{z-index:1100;box-sizing:border-box;background:var(--dsw-specific-menu);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);width:max-content;min-width:min(300px,calc(100vw - 24px));max-width:min(440px,calc(100vw - 24px));box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);cursor:default;border:0;border-radius:12px;padding:16px;font-size:12px;line-height:18px;position:fixed;flex-direction:column;display:flex;overflow:hidden}",
			".dsh-tstat-panel[data-view=turns]{min-width:min(520px,calc(100vw - 24px));max-width:min(620px,calc(100vw - 24px));max-height:min(460px,70vh)}",
			".dsh-tstat-title{color:var(--dsw-alias-label-primary);justify-content:space-between;gap:16px;margin-bottom:8px;font-weight:500;flex:none;display:flex}",
			".dsh-tstat-title-label{align-items:center;gap:6px;min-width:0;display:inline-flex}",
			".dsh-tstat-title-label svg{flex:none;width:14px;height:14px}",
			".dsh-tstat-title-value{font-variant-numeric:tabular-nums}",
			".dsh-tstat-back{color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:6px;flex:none;place-items:center;margin-left:-4px;padding:1px;display:inline-grid;cursor:pointer}",
			".dsh-tstat-back:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
			".dsh-tstat-back svg{width:14px;height:14px}",
			".dsh-tstat-rule{border-top:.5px solid var(--dsw-alias-border-l2);margin-bottom:10px;flex:none}",
			".dsh-tstat-body{min-height:0;overflow-y:auto}",
			".dsh-tstat-details{color:var(--dsw-alias-label-tertiary);grid-template-columns:minmax(76px,auto) minmax(0,1fr);gap:6px 16px;margin:0;display:grid}",
			".dsh-tstat-details dt,.dsh-tstat-details dd{min-width:0;margin:0}",
			".dsh-tstat-details dd{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;text-align:right}",
			// A footnote spanning both columns: the counting scope and provenance.
			".dsh-tstat-details .dsh-tstat-note{grid-column:1/-1;color:var(--dsw-alias-label-tertiary);text-align:left;font-size:11px;line-height:16px}",
			// The `?` closing a footnote is a control, not punctuation: inline after a
			// sentence it needs its own space, or it reads as a stray glyph stuck to the
			// full stop. The estimate's own row spaces it with the flex gap instead.
			".dsh-tstat-scope .dsh-tstat-help{margin-left:4px}",
			// The overview's door to the per-turn table: its own row, not a chip beside
			// the logo.
			".dsh-tstat-more-row{grid-column:1/-1;margin:2px 0 0}",
			".dsh-tstat-more{color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:8px;justify-content:space-between;align-items:center;gap:8px;width:100%;padding:5px 2px;font:inherit;display:flex;cursor:pointer}",
			".dsh-tstat-more:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-tstat-more svg{flex:none;width:14px;height:14px;color:var(--dsw-alias-label-tertiary)}",
			// Per-turn table: one shared grid so the header and every row line up.
			".dsh-tstat-filters{flex-wrap:wrap;gap:8px;margin-bottom:10px;flex:none;display:flex}",
			".dsh-tstat-filter{color:var(--dsw-alias-label-tertiary);font:inherit;white-space:nowrap;background:0 0;border:.5px solid var(--dsw-alias-border-l1);border-radius:999px;align-items:center;gap:4px;padding:2px 10px;display:inline-flex;cursor:pointer}",
			".dsh-tstat-filter:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-tstat-filter[aria-pressed=true]{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-tstat-filter[data-count='0']{opacity:.5}",
			".dsh-tstat-coverage{color:var(--dsw-alias-label-tertiary);justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;flex:none;display:flex}",
			// Column widths are the widest label each column has to hold, in either
			// language, at these sizes: `Turn 96` ≈ 46px, `Thinking`/`Output` ≈ 42px,
			// `Thinking source` ≈ 78px, `Of output` ≈ 48px. Every header cell is nowrap
			// (below), so a column narrower than its label would cut the label rather than
			// wrap it — which is how `Thinking source` and `Of output` broke in English.
			".dsh-tstat-grid{grid-template-columns:46px 52px 56px 84px minmax(0,1fr) 52px 18px;align-items:center;gap:0 8px;display:grid}",
			".dsh-tstat-head{color:var(--dsw-alias-label-caption);white-space:nowrap;font-size:11px;line-height:16px;padding-bottom:6px;border-bottom:.5px solid var(--dsw-alias-border-l2)}",
			".dsh-tstat-turns{margin:0;padding:0;list-style:none;display:block}",
			".dsh-tstat-turn{padding:5px 0}",
			".dsh-tstat-turn-no{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;overflow:hidden;white-space:nowrap}",
			".dsh-tstat-turn-val{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}",
			".dsh-tstat-turn-out{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}",
			".dsh-tstat-turn-src{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;overflow:hidden;white-space:nowrap}",
			".dsh-tstat-turn-model{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;min-width:0;overflow:hidden;white-space:nowrap}",
			".dsh-tstat-turn-share{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}",
			// A worked-out figure is the estimate it says it is, and reads as one.
			".dsh-tstat-turn[data-src=folded] .dsh-tstat-turn-val,.dsh-tstat-turn[data-src=mixed] .dsh-tstat-turn-val,.dsh-tstat-turn[data-src=folded] .dsh-tstat-turn-src,.dsh-tstat-turn[data-src=mixed] .dsh-tstat-turn-src,.dsh-tstat-turn[data-src=folded] .dsh-tstat-turn-share,.dsh-tstat-turn[data-src=mixed] .dsh-tstat-turn-share{color:var(--dsw-alias-state-business-primary)}",
			".dsh-tstat-turn[data-src=none] .dsh-tstat-turn-no,.dsh-tstat-turn[data-src=none] .dsh-tstat-turn-val,.dsh-tstat-turn[data-src=none] .dsh-tstat-turn-out,.dsh-tstat-turn[data-src=none] .dsh-tstat-turn-src,.dsh-tstat-turn[data-src=none] .dsh-tstat-turn-model{color:var(--dsw-alias-label-caption)}",
			".dsh-tstat-jump{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:8px;place-items:center;padding:1px;display:inline-grid}",
			".dsh-tstat-jump:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
			".dsh-tstat-jump svg{width:14px;height:14px}",
			// The estimate row: the figure, then the `?` that opens the reason.
			".dsh-tstat-estimate{align-items:center;gap:4px;display:inline-flex}",
			".dsh-tstat-help{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:.5px solid var(--dsw-alias-border-l1);border-radius:999px;place-items:center;width:14px;height:14px;padding:0;font-size:10px;line-height:1;display:inline-grid}",
			".dsh-tstat-help:hover,.dsh-tstat-help[aria-expanded=true]{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}",
			// The explanation, as its own message beside the panel. Its height depends on
			// the viewport width and on the length of the words, so it is measured and
			// placed rather than assumed; the cap is the hard stop for a window too short
			// for even a correctly placed card.
			".dsh-tstat-why{z-index:1101;box-sizing:border-box;background:var(--dsw-specific-menu);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);border:0;border-radius:12px;padding:12px 14px;font-size:12px;line-height:18px;position:fixed;max-height:calc(100vh - 24px);overflow-y:auto}",
			".dsh-tstat-why-title{color:var(--dsw-alias-label-primary);margin-bottom:6px;font-weight:500}",
			".dsh-tstat-why-p{color:var(--dsw-alias-label-secondary);margin:0 0 6px}",
			".dsh-tstat-why-p:last-child{margin-bottom:0}",
			// Paging the table: only one page of rows is ever rendered.
			".dsh-tstat-pager{color:var(--dsw-alias-label-tertiary);justify-content:space-between;align-items:center;gap:8px;padding-top:8px;margin-top:2px;border-top:.5px solid var(--dsw-alias-border-l2);display:flex;flex:none}",
			".dsh-tstat-page{color:var(--dsw-alias-label-secondary);font:inherit;background:0 0;border:.5px solid var(--dsw-alias-border-l1);border-radius:999px;padding:1px 10px;cursor:pointer}",
			".dsh-tstat-page:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-tstat-page:disabled{color:var(--dsw-alias-label-caption);cursor:default}",
			".dsh-tstat-empty{color:var(--dsw-alias-label-tertiary);padding:6px 0}"
		].join("");
		const CSS_TAG_ID = "dsh-thinking-token-stat/styles.css";
		function injectStyles() {
			if (typeof document === "undefined") return;
			if (document.querySelector("style[data-plugin-css=\"" + CSS_TAG_ID + "\"]")) return;
			const tag = document.createElement("style");
			tag.setAttribute("data-plugin", "dsh-thinking-token-stat");
			tag.setAttribute("data-plugin-css", CSS_TAG_ID);
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		injectStyles();
		//#endregion
		//#region computation
		// Every figure this half shows comes from one place: the `thinkingStats` session
		// projection, folded by the host side of this plugin over the whole event log and
		// checkpointed with the session. Nothing here reads the conversation window, walks
		// assistant nodes, folds reasoning text, or caches anything — the numbers are the
		// same for a ten-turn session and a ten-thousand-turn one, and they arrive with the
		// session snapshot rather than being recomputed on the client.
		//
		// The fold itself (which provider counts are taken exactly, which are derived from
		// the reasoning text, how a retried step is replaced rather than double-counted, and
		// how a fork's inherited prefix is excluded) lives in the package's node half.

		/** The projection key the node half registers and this half reads. */
		const STATS_KEY = "thinkingStats";
		/** Rows per page of the per-turn table. */
		const PAGE_ROWS = 100;
		/**
		 * The explanation card's own box. The width is chosen here — a line of prose is
		 * unreadable past this — while the height is whatever the words come to, so it is
		 * measured on the pass that first renders the card. `WHY_HEIGHT` is only the guess
		 * used for the very first placement, before there is anything to measure.
		 */
		const WHY_WIDTH = 280;
		const WHY_HEIGHT = 190;
		/** The narrowest the card may become on a small window. */
		const WHY_MIN_WIDTH = 200;

		function num(v) {
			return typeof v === "number" && isFinite(v) ? v : 0;
		}

		/**
		 * Resolve one projection row into the shape the table renders.
		 *
		 * A row is `[turn, thinking, reported, folded, output, refs]`, where `refs` are
		 * indices into the view's model dictionary — the reason a session on one model
		 * costs eleven bytes per turn rather than repeating the model name in every row.
		 * @param row - a published projection row.
		 * @param labels - the view's model dictionary.
		 * @returns the turn entry.
		 */
		function turnOf(row, labels) {
			const routes = [];
			for (const ref of row[5]) {
				const label = labels[ref];
				if (typeof label === "string" && routes.indexOf(label) < 0) routes.push(label);
			}
			return {
				turn: num(row[0]),
				thinking: num(row[1]),
				reported: num(row[2]),
				folded: num(row[3]),
				output: num(row[4]),
				routes: routes.length === 0 ? null : routes
			};
		}

		/**
		 * Assemble the readout's ledger from the projection value.
		 * @param view - the `thinkingStats` view, or undefined when no host publishes it.
		 * @returns the ledger, or null when there is nothing to show.
		 */
		function ledgerOf(view) {
			if (view === null || view === undefined || typeof view.totals !== "object" || view.totals === null) return null;
			const totals = view.totals;
			const labels = Array.isArray(view.labels) ? view.labels : [];
			const rows = Array.isArray(view.turns) ? view.turns : [];
			return {
				turns: rows.map((row) => turnOf(row, labels)),
				turnsCount: num(view.turnCount),
				published: rows.length,
				// Turns the fold saw a settlement for. A turn without one never produced a
				// reply — it errored, was interrupted or was cancelled — so it has no figures
				// to show, which is a gap in coverage rather than a turn that thought nothing.
				settledTurns: totals.settledTurns === undefined ? num(view.turnCount) : num(totals.settledTurns),
				thinking: num(totals.thinking),
				reported: num(totals.reported),
				folded: num(totals.folded),
				output: num(totals.output),
				total: num(totals.total),
				reasoningTurns: num(totals.reasoningTurns),
				foldedTurns: num(totals.foldedTurns),
				whole: view.whole === undefined ? true : view.whole === true
			};
		}

		/**
		 * The fallback readout for a host that serves no per-turn projection.
		 *
		 * Only the durable session totals are available there, so the readout states them
		 * and says nothing about individual turns — an honest degradation rather than a
		 * second folding implementation that would behave differently from the first.
		 * @param usage - the `tokenUsage` projection value, if any.
		 * @param stats - the `sessionStats` projection value, if any.
		 * @returns the ledger, or null when even the totals are unavailable.
		 */
		function durableLedger(usage, stats) {
			const thinking = usage !== null && usage !== undefined && typeof usage.reasoningTokens === "number" ? usage.reasoningTokens : 0;
			const output = usage !== null && usage !== undefined && typeof usage.outputTokens === "number" ? usage.outputTokens : 0;
			if (thinking <= 0 && output <= 0) return null;
			const turnsCount = stats !== null && stats !== undefined && typeof stats.turns === "number" ? stats.turns : 0;
			return {
				turns: [],
				turnsCount: turnsCount,
				published: 0,
				settledTurns: 0,
				thinking: thinking,
				reported: thinking,
				folded: 0,
				output: 0,
				total: 0,
				reasoningTurns: turnsCount,
				foldedTurns: 0,
				whole: true,
				durableOnly: true
			};
		}

		/**
		 * How one turn's thinking figure was obtained.
		 * @param entry - a turn entry from the ledger.
		 * @returns `reported`, `folded`, `mixed` (both, within one turn), or `none`.
		 */
		function turnSource(entry) {
			if (entry.reported > 0 && entry.folded > 0) return "mixed";
			if (entry.folded > 0) return "folded";
			if (entry.reported > 0) return "reported";
			return "none";
		}
		//#endregion


		//#region formatting
		/** Compact token count: 517 / 12.2K / 517K / 1.2M (one decimal under three digits). */
		function formatTokens(n) {
			if (n < 1000) return String(n);
			if (n < 1000000) return trim1(n / 1000) + "K";
			return trim1(n / 1000000) + "M";
		}
		function trim1(v) {
			return v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, "");
		}
		/** Percentage of part over whole (one decimal place), or null when whole is not positive. */
		function pct(part, whole) {
			if (!whole || whole <= 0) return null;
			return ((part / whole) * 100).toFixed(1) + "%";
		}
		/**
		 * The one locale question this half asks: is the interface language Chinese?
		 *
		 * DSH ships exactly two locales — `zh` and `en` — and the locale service points
		 * `<html lang>` at the active one, as `zh-CN` for Chinese and as the bare id
		 * otherwise. Anything else is not Chinese: a locale pack for some third language,
		 * an id we do not have words for, or the empty attribute a document carries before
		 * the locale service publishes. All of those fall back to English, which is DSH's
		 * own fallback as well, so a third language gets English rather than a half-CJK mix.
		 * @returns true only for a `zh`-prefixed language tag.
		 */
		function isChinese() {
			if (typeof document === "undefined" || document.documentElement === null || document.documentElement === undefined) return false;
			const lang = document.documentElement.lang;
			return typeof lang === "string" && /^zh(?:-|$)/i.test(lang);
		}
		/**
		 * Re-render when the interface language changes.
		 *
		 * The copy is read while rendering, so the readout only needs to be told that the
		 * answer changed: the locale service switches `<html lang>` when the preference is
		 * set, and one attribute observer turns that into a render. Without it the readout
		 * keeps the language it was last rendered in until something unrelated re-renders
		 * it. Absent `MutationObserver`, the plugin simply stays in the language it booted
		 * with, which is what an older host had anyway.
		 */
		function useLocaleTick() {
			const [, bump] = react.useState(0);
			react.useEffect(() => {
				if (typeof MutationObserver !== "function" || typeof document === "undefined") return;
				const node = document.documentElement;
				if (node === null || node === undefined || typeof node !== "object") return;
				const observer = new MutationObserver(() => bump((n) => n + 1));
				observer.observe(node, { attributes: true, attributeFilter: ["lang"] });
				return () => observer.disconnect();
			}, []);
		}
		/** Locale seat: the readouts follow the active DSH interface language. */
		function copy(key) {
			const zh = isChinese();
			return ({
				sessionTitle: zh ? "本次会话思考 token" : "Thinking tokens (session)",
				turnsTitle: zh ? "逐轮思考来源" : "Thinking by turn",
				all: zh ? "思考 / 全部 token" : "Thinking / all tokens",
				output: zh ? "思考 / 推理输出 token" : "Thinking / reasoning output",
				turns: zh ? "推理轮次" : "Reasoning turns",
				turnsUnit: zh ? "轮" : "turns",
				foldedTurns: zh ? "未上报推理的轮次" : "Turns without a reported count",
				tokens: zh ? "token" : "tok",
				srcReported: zh ? "直接提供" : "Reported",
				srcFolded: zh ? "文本推算" : "Text",
				srcMixed: zh ? "混合推算" : "Mixed",
				srcNone: zh ? "未提供" : "None",
				colTurn: zh ? "轮次" : "Turn",
				colThinking: zh ? "思考" : "Thinking",
				colOutput: zh ? "本轮输出" : "Output",
				colSource: zh ? "思考来源" : "Thinking source",
				colModel: zh ? "模型" : "Model",
				colShare: zh ? "占输出" : "Of output",
				more: zh ? "多轮具体统计" : "Per-turn detail",
				back: zh ? "返回总览" : "Back to summary",
				jump: zh ? "跳转到该轮" : "Jump to this turn",
				newer: zh ? "更新的" : "Newer",
				older: zh ? "更早的" : "Older",
				pageOf: zh ? "第 {p} / {n} 页" : "Page {p} / {n}",
				whyOpen: zh ? "为什么会有估算值" : "Why a figure is estimated",
				whyTitle: zh ? "为什么会是估算值" : "Why some figures are estimated",
				whyOne: zh ? "部分模型提供方不返回推理 token 计数。若因此忽略思考文本，这类模型会被记为全程未推理，而其思考内容实际已包含在响应之中。" : "Some model providers do not report a reasoning-token count. Discarding the reasoning text in that case would record those turns as having produced no reasoning at all, even though the reasoning is present in the response.",
				whyTwo: zh ? "故对这类响应改按文本长度折算，并按语种取不同密度：中日韩文字、假名与谚文按 1 个字符折合 1 个 token；西里尔、希腊、阿拉伯、希伯来与印度诸文字约 2.5 个字符折合 1 个；拉丁字母及数字标点仍按 4 个字符折合 1 个。该值属估算而非实测，因此以 ~ 标注。" : "Such responses are therefore derived from text length, at a density that depends on the script: CJK characters, kana and Hangul at one character per token; Cyrillic, Greek, Arabic, Hebrew and the Indic scripts at about two and a half; Latin letters, digits and punctuation at four. The result is an estimate rather than a measurement, which is why it carries a ~.",
				// The estimate's own line states the figure in words as well as in marks: a
				// bare `~223K token` reads as a number, not as the admission it is.
				estimated: zh ? "估算约 {tokens}" : "Estimated ≈ {tokens}",
				// What the numbers cover, computed from what the fold actually has rather
				// than asserted. Each way it can fall short of the whole session gets its
				// own sentence, and its own `?` with the reason.
				scopeWhole: zh ? "统计范围：全量会话，共 {n} 轮。" : "Scope: the whole session, {n} turns.",
				scopeOwn: zh ? "统计范围：本会话自身的 {n} 轮（不含继承的历史）。" : "Scope: this session's own {n} turns, excluding inherited history.",
				scopeGap: zh ? "统计范围：全量会话，共 {n} 轮，其中 {g} 轮没有产出消息。" : "Scope: the whole session, {n} turns, of which {g} produced no reply.",
				scopeTotals: zh ? "统计范围：仅有整场合计，没有逐轮数据。" : "Scope: session totals only; no per-turn figures.",
				scopeWhyOpen: zh ? "统计范围为什么不是全量" : "Why the scope is not the whole session",
				scopeWhyTitle: zh ? "为什么这里不是完整统计" : "Why this is not a complete count",
				whyGap: zh ? "有 {n} 轮已经开始、却没有产出助手消息（报错、被中断或中途取消），因此这些轮次没有可统计的用量；它们在表格里显示为「未提供」。" : "{n} turns started but never produced an assistant message — they errored, were interrupted, or were cancelled — so there is no usage to count for them. The table lists them as \"None\".",
				whyOwn: zh ? "本会话由其它会话 fork 而来。折叠只统计本会话自身产生的轮次，继承来的历史不计入。" : "This session was forked from another. The fold counts only the turns this session produced itself; inherited history is excluded.",
				whyDurable: zh ? "此宿主没有提供逐轮投影（旧版 DSH，或该会话尚未折叠过），所以只能给出官方的整场合计。" : "This host publishes no per-turn projection — an older DSH, or a session that has not been folded — so only the official session totals are available.",
				capped: zh ? "逐轮明细只列出最近 {n} 轮，更早的轮次只计入合计。" : "Only the newest {n} turns are listed; earlier ones count towards the totals.",
				capWhyOpen: zh ? "为什么明细不是全部轮次" : "Why the table is not the whole history",
				capWhyTitle: zh ? "为什么逐轮明细有上限" : "Why the list is capped",
				whyCapped: zh ? "逐轮明细只发布最近 {n} 轮：投影的值会跟着每一帧快照发送，必须保持在界面量级。更早的轮次仍然完整计入上面的合计。" : "Only the newest {n} turns are published: a projection value rides every snapshot frame, so it has to stay UI-sized. Earlier turns are still counted in the totals above.",
				pending: zh ? "本会话还没有逐轮统计。" : "No per-turn figures for this session yet.",
				durableOnly: zh ? "此宿主未提供逐轮统计，下面只有整场合计。" : "This host publishes no per-turn figures; only session totals are shown.",
				noTurns: zh ? "当前筛选下没有轮次。" : "No turns match the filters."
			})[key];
		}
		/** A figure that rests on the text fold is marked as the estimate it is. */
		function approx(text, estimated) {
			return estimated && typeof text === "string" && text !== "—" ? "~" + text : text;
		}
		/** Count with its compact unit, e.g. `8.9K token`. */
		function countText(value) {
			return formatTokens(value) + " " + copy("tokens");
		}
		/** `第 3 轮` / `Turn 3`. */
		function turnLabel(turn) {
			return isChinese() ? "第 " + turn + " 轮" : "Turn " + turn;
		}
		/** `4 / 6 轮` — how much of the recorded session actually reasoned. */
		function coverageText(folded) {
			return folded.reasoningTurns + " / " + folded.turnsCount + " " + copy("turnsUnit");
		}
		/** The source label for one turn row. */
		function sourceText(source) {
			if (source === "reported") return copy("srcReported");
			if (source === "folded") return copy("srcFolded");
			if (source === "mixed") return copy("srcMixed");
			return copy("srcNone");
		}
		/** The figures stated in the panel's aria label. */
		function detailLabel(stats) {
			const estimated = stats.folded > 0;
			const totalPct = approx(pct(stats.thinking, stats.total), estimated);
			const outputPct = approx(pct(stats.thinking, stats.output), estimated);
			return (
				copy("sessionTitle") +
				": " +
				approx(String(stats.thinking), estimated) +
				(outputPct !== null ? " · " + outputPct + (isChinese() ? " 占推理输出" : " of reasoning output") : "") +
				(totalPct !== null ? " · " + totalPct + (isChinese() ? " 占全部 token" : " of all tokens") : "")
			);
		}
		//#endregion


		//#region shared chrome
		const PANEL_MARGIN = 12;
		const PANEL_GAP = 8;
		const MEASURE_STYLE = { visibility: "hidden", left: 0, top: 0 };
		/**
		 * The width the explanation card will be given, for a given window width. It is
		 * known before the card is measured, so the card is rendered at its final width
		 * while still hidden — a card laid out at one width and then shown at another would
		 * be measured wrong, and the measurement is what keeps it inside the window.
		 * @param viewportWidth - the window's inner width.
		 * @returns the card's width in pixels.
		 */
		function whyWidthFor(viewportWidth) {
			return Math.max(WHY_MIN_WIDTH, Math.min(WHY_WIDTH, viewportWidth - 2 * PANEL_MARGIN));
		}
		/** @returns the card's width for the window this plugin is running in. */
		function whyWidth() {
			if (typeof window === "undefined" || typeof window.innerWidth !== "number") return WHY_WIDTH;
			return whyWidthFor(window.innerWidth);
		}
		/**
		 * Where the explanation card goes: beside the panel when the window has room,
		 * otherwise on its other side, and always fully inside the viewport.
		 *
		 * The vertical clamp uses the card's *measured* height. Assuming a height was the
		 * bug: the card is a paragraph of prose, its height depends on the language and the
		 * words, and the old fixed guess was shorter than the real card, so a card opened
		 * near the bottom of the window ran off it and the last lines could not be read.
		 * @param panel - the panel's viewport rect.
		 * @param cardHeight - the card's measured height.
		 * @param viewport - the window's inner size.
		 * @returns the card's `left`, `top` and `width`.
		 */
		function whyPlacement(panel, cardHeight, viewport) {
			const width = whyWidthFor(viewport.width);
			const room = viewport.width - panel.right;
			const left = room >= width + PANEL_MARGIN + PANEL_GAP
				? panel.right + PANEL_GAP
				: Math.max(PANEL_MARGIN, Math.min(panel.left, viewport.width - PANEL_MARGIN) - width - PANEL_GAP);
			const top = Math.min(
				Math.max(PANEL_MARGIN, panel.top),
				Math.max(PANEL_MARGIN, viewport.height - PANEL_MARGIN - cardHeight)
			);
			return { left: left, top: top, width: width };
		}
		/**
		 * Everything that counts as "inside" for dismissal: the dock trigger, the panel, and
		 * the explanation card. Read as an attribute selector rather than through element
		 * refs, so a press is classified by what it landed on regardless of which portal has
		 * committed.
		 */
		const INSIDE_SELECTOR = "[data-thinking-dock],[data-thinking-panel],[data-thinking-explain]";
		/** Inline fallbacks, used only when the host exposes no such icon. */
		const FALLBACK_THINK = "M5.05 11.75a3.7 3.7 0 0 1-.8-7.31 4.3 4.3 0 0 1 8.2 1.13A3.2 3.2 0 0 1 12 11.9c-.75 0-1.45-.2-2.05-.57a3.7 3.7 0 0 1-4.9.42ZM4.2 13.2a1.1 1.1 0 0 0 1.1-1.1v-.1H4.2a1.1 1.1 0 0 0 0 2.2v-1Z";
		const FALLBACK_CHEVRON = { right: "M6.5 3.5 11 8l-4.5 4.5", left: "M9.5 3.5 5 8l4.5 4.5" };
		const FALLBACK_JUMP = "M5.5 10.5 10.5 5.5M10.5 5.5H6.5M10.5 5.5v4";
		/** A filled glyph — the one icon that reads as content rather than chrome. */
		function filledGlyph(Icon, path) {
			if (Icon !== undefined && Icon !== null) return h(Icon, {});
			return h("svg", { viewBox: "0 0 16 16", "aria-hidden": true, children: h("path", { d: path, fill: "currentColor" }) });
		}
		/**
		 * The `?` beside an estimated figure.
		 *
		 * It opens the explanation on a click rather than on hover: a tooltip that only
		 * appears under a pointer is invisible to touch, to keyboard focus and to anyone
		 * who does not think to hover a glyph, which is exactly the audience for an
		 * explanation nobody asked for until they doubted the number.
		 * @param label - the accessible name.
		 * @param open - whether the explanation is showing.
		 * @param toggle - opens or closes it.
		 * @param id - which explanation this trigger owns, marked on the element so the
		 *   dismissal listener can tell a trigger from a click that should close the card.
		 * @returns the trigger element.
		 */
		function helpGlyph(label, open, toggle, id) {
			return h("button", {
				type: "button",
				className: "dsh-tstat-help",
				"data-explain": id,
				"aria-expanded": open === true,
				"aria-label": label,
				title: label,
				onClick: toggle
			}, "?");
		}
		/** A stroked glyph for chrome: chevrons and the jump arrow. */
		function strokeGlyph(Icon, path) {
			if (Icon !== undefined && Icon !== null) return h(Icon, {});
			return h("svg", {
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				children: h("path", { d: path })
			});
		}
		/**
		 * One trigger-anchored dialog seat: open state, viewport-clamped placement,
		 * outside-pointer and Escape dismissal. Mirrors the shipped `useStatDialog`,
		 * including its `controlled` form.
		 *
		 * The dismissal listener is its own rather than the shipped hook's, and it listens
		 * in the capture phase. The shipped hook listens on `document` in the bubble phase,
		 * so any part of the app that stops pointer propagation — the composer and the
		 * message list both do — swallows the event and the panel stays open until its
		 * trigger is pressed again. Capture runs before anything can stop it, which is what
		 * makes "click anywhere else and it goes away" true rather than usually true.
		 * @param controlled - external open state; when given the seat reads and writes
		 *   it instead of owning its own.
		 * @param controlled.extraRef - a second floating surface that also counts as
		 *   inside, so opening the explanation does not close the panel.
		 * @returns the seat; spread `pos ?? MEASURE_STYLE` onto the portaled panel.
		 */
		function useStatDialog(controlled) {
			const [ownOpen, setOwnOpen] = react.useState(false);
			const open = controlled === undefined ? ownOpen : controlled.open;
			const setOpen = controlled === undefined ? setOwnOpen : controlled.setOpen;
			const extraRef = controlled === undefined ? undefined : controlled.extraRef;
			const rootRef = react.useRef(null);
			const panelRef = react.useRef(null);
			const pos = useAnchoredPosition({ open, anchorRef: rootRef, panelRef, side: "top", gap: PANEL_GAP, margin: PANEL_MARGIN });
			react.useEffect(() => {
				if (!open) return;
				// What counts as inside: the trigger, the panel, and the explanation card. The
				// refs answer this in the normal case; the markers make it survive a portal
				// whose ref has not been attached yet, and give the browser half one rule that
				// does not depend on React having committed.
				const contains = (node, target) => node !== null && node !== undefined && node.contains(target);
				const onPointerDown = (event) => {
					const target = event.target;
					if (target === null || target === undefined) return;
					if (contains(rootRef.current, target)) return;
					if (contains(panelRef.current, target)) return;
					if (extraRef !== undefined && contains(extraRef.current, target)) return;
					if (typeof target.closest === "function" && target.closest(INSIDE_SELECTOR) !== null) return;
					setOpen(false);
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				return () => document.removeEventListener("pointerdown", onPointerDown, true);
			}, [open, setOpen, extraRef, rootRef, panelRef]);
			react.useEffect(() => {
				if (!open) return;
				const onKeyDown = (event) => { if (event.key === "Escape") setOpen(false); };
				document.addEventListener("keydown", onKeyDown);
				return () => document.removeEventListener("keydown", onKeyDown);
			}, [open, setOpen]);
			return { open, setOpen, rootRef, panelRef, pos };
		}
		/**
		 * The estimate's explanation, as its own floating message.
		 *
		 * A separate card rather than a paragraph inside the panel: the panel stays a
		 * report of numbers, and the one thing that needs prose gets prose that is not
		 * pushing the numbers around. It closes the same way the panel does.
		 * @param title - the card's heading.
		 * @param paragraphs - one string per paragraph.
		 * @param cardRef - element ref for placement and for inside-click detection.
		 * @param pos - placement, or null on the pass that first renders the card, when it
		 *   is laid out at its final width but hidden so it can be measured.
		 * @returns the card element.
		 */
		function whyCard(title, paragraphs, cardRef, pos) {
			return h("div", {
				ref: cardRef,
				className: "dsh-tstat-why",
				"data-thinking-explain": true,
				role: "note",
				"aria-label": title,
				style: pos || { visibility: "hidden", left: 0, top: 0, width: whyWidth() }
			},
				h("div", { className: "dsh-tstat-why-title" }, title),
				paragraphs.map((text, index) => h("p", { key: "p" + index, className: "dsh-tstat-why-p" }, text)));
		}
		/**
		 * Scroll one turn into view. Only turns the window currently holds are rendered,
		 * so the caller gates on that.
		 * @param turn - the turn number to reveal.
		 */
		function jumpToTurn(turn) {
			if (typeof document === "undefined") return;
			const candidates = [
				document.querySelector("[data-turn-process=\"" + turn + "\"]"),
				document.querySelector("[data-turn-tail=\"" + turn + "\"]")
			];
			const target = candidates.find((el) => el !== null && el.getClientRects().length > 0);
			if (target === undefined) return;
			const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
			target.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
		}
		/**
		 * The portaled detail panel, shared by the overview and the per-turn table.
		 * @param options.view - `summary` or `turns`, exposed for styling.
		 * @param options.title - panel heading.
		 * @param options.headline - right-hand total, already formatted.
		 * @param options.onBack - when given, the title gains a back affordance.
		 * @param options.children - the body content.
		 * @param options.label - the dialog's aria label.
		 * @param options.panelRef - element ref used for anchored placement.
		 * @param options.pos - anchored placement, or null while measuring.
		 * @returns the panel element.
		 */
		function statPanel(options) {
			const titleLabel = [];
			if (options.onBack !== undefined) {
				titleLabel.push(h("button", {
					key: "back",
					type: "button",
					className: "dsh-tstat-back",
					"aria-label": copy("back"),
					title: copy("back"),
					onClick: options.onBack
				}, strokeGlyph(ChevronLeftIcon, FALLBACK_CHEVRON.left)));
			} else {
				titleLabel.push(filledGlyph(ThinkIcon, FALLBACK_THINK));
			}
			titleLabel.push(options.title);
			return h("div", {
				ref: options.panelRef,
				className: "dsh-tstat-panel",
				"data-thinking-panel": true,
				role: "dialog",
				"data-view": options.view,
				"aria-label": options.label,
				style: options.pos || MEASURE_STYLE
			},
				h("div", { className: "dsh-tstat-title" },
					h("span", { className: "dsh-tstat-title-label" }, titleLabel),
					h("span", { className: "dsh-tstat-title-value" }, options.headline)),
				h("div", { className: "dsh-tstat-rule", "aria-hidden": true }),
				options.children);
		}
		//#endregion

		//#region dock placement
		/** The shipped composer stats row, published by ui-chat's StatsPills root. */
		const STATS_ROW_SELECTOR = "[data-composer-stats]";
		/**
		 * Locate the shipped stats row.
		 *
		 * The dock reads as one centred line only when this readout is a flex child of
		 * that row: the row already owns the centring, the 12px rhythm and the
		 * secondary font, so joining it inherits all three. A slot entry cannot join
		 * it — the slot wraps entries in a `display:contents` element (no box, so flex
		 * properties on it are inert) that sits under a column stack, and CSS cannot
		 * name the box that actually lays the dock out (`:has()` may not be nested).
		 * Portalling into the row is therefore both simpler and immune to whatever
		 * layout the host puts above it.
		 * @returns the stats row element, or null before it renders.
		 */
		function statsRow() {
			if (typeof document === "undefined") return null;
			return document.querySelector(STATS_ROW_SELECTOR);
		}
		//#endregion
		/**
		 * One row of the per-turn table.
		 * @param entry - the turn entry from the ledger.
		 * @returns the row element, sharing the table's column grid.
		 */
		function turnRow(entry) {
			const source = turnSource(entry);
			const model = entry.routes === null ? "—" : entry.routes.join(", ");
			const estimated = entry.folded > 0;
			const share = approx(pct(entry.thinking, entry.output), estimated);
			const detail = [
				turnLabel(entry.turn),
				entry.thinking > 0 ? approx(countText(entry.thinking), estimated) : copy("srcNone"),
				copy("colOutput") + ": " + countText(entry.output),
				sourceText(source),
				model
			].join(" · ");
			return h("li", {
				key: entry.turn,
				className: "dsh-tstat-turn dsh-tstat-grid",
				"data-src": source,
				"data-turn": entry.turn,
				title: detail
			},
				h("span", { className: "dsh-tstat-turn-no" }, turnLabel(entry.turn)),
				h("span", { className: "dsh-tstat-turn-val" }, entry.thinking > 0 ? approx(formatTokens(entry.thinking), estimated) : "—"),
				h("span", { className: "dsh-tstat-turn-out" }, entry.output > 0 ? formatTokens(entry.output) : "—"),
				h("span", { className: "dsh-tstat-turn-src" }, sourceText(source)),
				h("span", { className: "dsh-tstat-turn-model" }, model),
				h("span", { className: "dsh-tstat-turn-share" }, share === null ? "—" : share),
				h("button", {
					type: "button",
					className: "dsh-tstat-jump",
					"aria-label": copy("jump"),
					title: copy("jump"),
					onClick: () => jumpToTurn(entry.turn)
				}, strokeGlyph(JumpIcon, FALLBACK_JUMP)));
		}

		//#region components
		/**
		 * The closed view's sentinel. It is a value rather than `null` because the panel is
		 * rendered for any view that is not closed, and `null` — what a dismissal sets — is
		 * not closed by that test. Reading the two as the same thing once made the panel
		 * dismissible only from its own trigger.
		 */
		const VIEW_CLOSED = "closed";
		/** Every source filter is on except the one for turns with no figure. */
		const DEFAULT_FILTERS = { reported: true, folded: true, none: false };
		/**
		 * The plugin's dock readout, portalled into the shipped composer stats row so it
		 * lines up with the built-in pills. Clicking it opens the session overview; the
		 * overview's own last row opens the per-turn table. Hidden until the session has
		 * produced thinking.
		 *
		 * Both panels answer what no built-in surface can. The shipped session pill reports
		 * tokens and cache hit only, and the shipped per-turn panel reports one turn at a
		 * time and only when the provider states a count — so which turns fell back to a
		 * worked-out figure, and which contributed no figure at all, is something only this
		 * plugin states.
		 */
		const ThinkingStatsDock = react.memo(function ThinkingStatsDock({ useProjection }) {
			// Follow the interface language without a reload, and read no locale but `zh`.
			useLocaleTick();
			// The host's fold is the entire data source; every render reads one immutable
			// value from the session snapshot.
			const statsView = typeof useProjection === "function" ? useProjection(STATS_KEY) : undefined;
			const usage = typeof useProjection === "function" ? useProjection("tokenUsage") : undefined;
			const sessionStats = typeof useProjection === "function" ? useProjection("sessionStats") : undefined;
			const stats = react.useMemo(() => ledgerOf(statsView) || durableLedger(usage, sessionStats), [statsView, usage, sessionStats]);
			// Which panel is open: the closed sentinel, "summary" (the logo) or "turns"
			// (the overview's own row).
			const [view, setView] = react.useState(VIEW_CLOSED);
			const open = view !== VIEW_CLOSED && view !== null;
			const [filters, setFilters] = react.useState(DEFAULT_FILTERS);
			const [page, setPage] = react.useState(0);
			// The explanation card is shared: the estimate, the scope line and the list cap
			// each open the same message with their own words, so there is one floating
			// surface and one dismissal rule rather than three.
			const [explain, setExplain] = react.useState(null);
			const [whyPos, setWhyPos] = react.useState(null);
			const whyRef = react.useRef(null);
			const toggleExplain = (id, title, paragraphs) => {
				setExplain(explain !== null && explain.id === id ? null : { id: id, title: title, paragraphs: paragraphs });
			};
			const explainOpen = (id) => explain !== null && explain.id === id;
			const close = react.useCallback(() => {
				setExplain(null);
				setView(VIEW_CLOSED);
			}, []);
			// The explanation closes on any pointer outside its own card — including a click
			// inside the panel, which is what makes moving between the overview and the table
			// close it rather than carry it along. Its own trigger is exempt, because the
			// pointerdown that precedes a click would otherwise close the card and the click
			// would reopen it, leaving the `?` unable to close anything.
			react.useEffect(() => {
				if (explain === null) return;
				const onPointerDown = (event) => {
					const target = event.target;
					if (target === null || target === undefined) return;
					const card = whyRef.current;
					if (card !== null && card !== undefined && card.contains(target)) return;
					if (typeof target.closest !== "function") { setExplain(null); return; }
					if (target.closest("[data-thinking-explain]") !== null) return;
					if (target.closest("[data-explain]") !== null) return;
					setExplain(null);
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				return () => document.removeEventListener("pointerdown", onPointerDown, true);
			}, [explain]);
			const seat = useStatDialog({
				open: open,
				setOpen: (next) => { if (next !== true) close(); },
				extraRef: whyRef
			});
			const { rootRef, panelRef, pos } = seat;
			// The explanation card sits beside the panel, not over it: to the right when the
			// viewport has room, otherwise to the left. Placement needs the panel's measured
			// rect and the card's measured height, so the card is rendered hidden at its
			// final width until both are known — and the effect re-runs after every render,
			// which is how it follows the panel when the window is resized or scrolled
			// (the shipped anchoring hook re-places the panel on both, and that re-render
			// lands here).
			react.useEffect(() => {
				if (explain === null) {
					if (whyPos !== null) setWhyPos(null);
					return;
				}
				const panel = panelRef.current;
				if (panel === null || panel === undefined || typeof window === "undefined") return;
				const card = whyRef.current;
				const next = whyPlacement(
					panel.getBoundingClientRect(),
					card === null || card === undefined ? WHY_HEIGHT : card.getBoundingClientRect().height,
					{ width: window.innerWidth, height: window.innerHeight }
				);
				// An identical placement keeps the previous object: a fresh one every pass
				// would re-render, re-run this effect and never settle.
				setWhyPos((prev) => (prev !== null && prev.left === next.left && prev.top === next.top && prev.width === next.width ? prev : next));
			});
			// Re-resolve after every render (one cheap attribute query) so the readout
			// follows the row across session switches and host re-mounts. An equal value is
			// a no-op, so this adds no renders of its own.
			const [row, setRow] = react.useState(null);
			react.useEffect(() => {
				const found = statsRow();
				if (found !== row) setRow(found);
			});
			// Keep the readout as the row's last child: the shipped pills are appended as
			// they appear, which would otherwise place them after this one.
			react.useEffect(() => {
				const node = rootRef.current;
				if (row === null || row === undefined || typeof row.appendChild !== "function") return;
				if (node === null || node === undefined) return;
				const keepLast = () => {
					if (node.parentElement === row && row.lastElementChild !== node) row.appendChild(node);
				};
				keepLast();
				if (typeof MutationObserver !== "function") return;
				const observer = new MutationObserver(keepLast);
				observer.observe(row, { childList: true });
				return () => observer.disconnect();
			}, [row, stats === null ? 0 : stats.thinking]);
			if (stats === null || stats.thinking <= 0) return null;
			// Any figure that rests on the text fold carries `~`. The flag is per figure, not
			// per panel: a session whose every turn reported a count shows no `~` at all,
			// which is what makes the mark worth reading when it does appear.
			const estimated = stats.folded > 0;
			const outputPct = pct(stats.thinking, stats.output);
			const totalPct = pct(stats.thinking, stats.total);
			// Coverage only informs when part of the session did not reason, so the readout
			// stays two figures wide in the single-model case.
			const partial = stats.reasoningTurns > 0 && stats.reasoningTurns < stats.turnsCount;
			const label = [approx(formatTokens(stats.thinking), estimated)];
			if (outputPct !== null) label.push(approx(outputPct, estimated));
			if (partial) label.push(coverageText(stats));
			const kids = [];
			const pairs = h("dl", { className: "dsh-tstat-details" }, kids);
			const add = (name, value) => {
				kids.push(h("dt", { key: "dt" + kids.length }, name));
				kids.push(h("dd", { key: "dd" + kids.length }, value));
			};
			add(copy("output") + " (" + countText(stats.output) + ")", outputPct !== null ? approx(outputPct, estimated) : "—");
			add(copy("all") + " (" + countText(stats.total) + ")", totalPct !== null ? approx(totalPct, estimated) : "—");
			add(copy("turns"), coverageText(stats));
			// How much of the figure rests on the text fold: a fact only this plugin can
			// state, because the shipped panel simply omits a reasoning figure it lacks. The
			// reason itself opens as its own message from the `?`, which is the one gesture
			// every input device has.
			const notes = [];
			if (stats.foldedTurns > 0) {
				add(copy("foldedTurns"), stats.foldedTurns + " " + copy("turnsUnit") + " · " + approx(countText(stats.folded), true));
				notes.push(h("span", { key: "estimate", className: "dsh-tstat-estimate" },
					copy("estimated").replace("{tokens}", countText(stats.folded)),
					helpGlyph(copy("whyOpen"), explainOpen("estimate"),
						() => toggleExplain("estimate", copy("whyTitle"), [copy("whyOne"), copy("whyTwo")]), "estimate")));
			}
			// What the numbers cover, computed from what the fold actually holds rather than
			// asserted: a turn that never produced a reply has no figures, a forked session
			// has no inherited ones, and a host without the projection has no per-turn ones.
			// Each way the scope falls short of the whole session is stated, and carries its
			// own `?` with the reason.
			const gaps = Math.max(0, stats.turnsCount - stats.settledTurns);
			const capped = stats.published > 0 && stats.turnsCount > stats.published;
			const scopeReasons = [];
			if (stats.durableOnly === true) {
				scopeReasons.push(copy("whyDurable"));
			} else {
				if (stats.whole === false) scopeReasons.push(copy("whyOwn"));
				if (gaps > 0) scopeReasons.push(copy("whyGap").replace("{n}", String(gaps)));
			}
			let scope = copy("scopeWhole").replace("{n}", String(stats.turnsCount));
			if (stats.durableOnly === true) scope = copy("scopeTotals");
			else if (stats.whole === false) scope = copy("scopeOwn").replace("{n}", String(stats.turnsCount));
			else if (gaps > 0) scope = copy("scopeGap").replace("{n}", String(stats.turnsCount)).replace("{g}", String(gaps));
			notes.push(h("span", { key: "scope", className: "dsh-tstat-scope" },
				scope,
				scopeReasons.length === 0 ? null : helpGlyph(copy("scopeWhyOpen"), explainOpen("scope"),
					() => toggleExplain("scope", copy("scopeWhyTitle"), scopeReasons), "scope")));
			if (capped) {
				notes.push(h("span", { key: "cap", className: "dsh-tstat-scope" },
					copy("capped").replace("{n}", String(stats.published)),
					helpGlyph(copy("capWhyOpen"), explainOpen("cap"),
						() => toggleExplain("cap", copy("capWhyTitle"), [copy("whyCapped").replace("{n}", String(stats.published))]), "cap")));
			}
			// The door to the per-turn table, as its own row in the overview.
			kids.push(h("dd", { key: "more", className: "dsh-tstat-more-row" },
				h("button", {
					type: "button",
					className: "dsh-tstat-more",
					onClick: () => setView("turns")
				},
					copy("more"),
					strokeGlyph(ChevronRightIcon, FALLBACK_CHEVRON.right))));
			// Scope footnotes close the list, after the door to the per-turn table.
			for (const note of notes) {
				kids.push(h("dd", { key: "note" + kids.length, className: "dsh-tstat-note" }, note));
			}
			const counts = { reported: 0, folded: 0, none: 0 };
			for (const entry of stats.turns) {
				const source = turnSource(entry);
				if (source === "none") { counts.none += 1; continue; }
				if (source !== "folded") counts.reported += 1;
				if (source !== "reported") counts.folded += 1;
			}
			const visible = stats.turns.filter((entry) => {
				const source = turnSource(entry);
				if (source === "none") return filters.none;
				if (source === "folded") return filters.folded;
				if (source === "reported") return filters.reported;
				return filters.reported || filters.folded;
			});
			const filterButton = (name, source) => h("button", {
				key: name,
				type: "button",
				className: "dsh-tstat-filter",
				"aria-pressed": filters[name],
				"data-count": String(counts[name]),
				onClick: () => setFilters(Object.assign({}, filters, { [name]: !filters[name] }))
			}, sourceText(source) + " " + counts[name]);
			// Newest first, one page of rows at a time. Only the page in view is rendered:
			// a long conversation makes a long table, and laying out hundreds of rows to
			// read ten of them is work nobody asked for.
			const rows = [...visible].reverse();
			const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_ROWS));
			const current = Math.min(page, pageCount - 1);
			const shown = rows.slice(current * PAGE_ROWS, current * PAGE_ROWS + PAGE_ROWS);
			const pager = pageCount > 1
				? h("div", { className: "dsh-tstat-pager" },
					h("button", {
						type: "button",
						className: "dsh-tstat-page",
						disabled: current === 0,
						onClick: () => setPage(Math.max(0, current - 1))
					}, copy("newer")),
					h("span", { className: "dsh-tstat-page-info" },
						copy("pageOf").replace("{p}", String(current + 1)).replace("{n}", String(pageCount))),
					h("button", {
						type: "button",
						className: "dsh-tstat-page",
						disabled: current >= pageCount - 1,
						onClick: () => setPage(Math.min(pageCount - 1, current + 1))
					}, copy("older")))
				: null;
			const listView = h("div", { className: "dsh-tstat-body" },
				h("div", { className: "dsh-tstat-filters" },
					filterButton("reported", "reported"),
					filterButton("folded", "folded"),
					filterButton("none", "none")),
				h("div", { className: "dsh-tstat-coverage" },
					// Same rule as the overview: the table's total is the folded total, so it
					// carries the mark whenever any part of it came from the text fold.
					h("span", null, coverageText(stats) + " · " + approx(countText(stats.thinking), estimated))),
				h("div", { className: "dsh-tstat-grid dsh-tstat-head" },
					h("span", { className: "dsh-tstat-turn-no" }, copy("colTurn")),
					h("span", { className: "dsh-tstat-turn-val" }, copy("colThinking")),
					h("span", { className: "dsh-tstat-turn-val" }, copy("colOutput")),
					h("span", { className: "dsh-tstat-turn-src" }, copy("colSource")),
					h("span", { className: "dsh-tstat-turn-model" }, copy("colModel")),
					h("span", { className: "dsh-tstat-turn-share" }, copy("colShare")),
					h("span", null, "")),
				stats.turns.length === 0
					? h("div", { className: "dsh-tstat-empty" }, stats.durableOnly === true ? copy("durableOnly") : copy("pending"))
					: visible.length === 0
						? h("div", { className: "dsh-tstat-empty" }, copy("noTurns"))
						: h("ul", { className: "dsh-tstat-turns" }, shown.map((entry) => turnRow(entry))),
				stats.turns.length === 0 ? null : pager);
			const readout = h("span", { ref: rootRef, className: "dsh-tdock-anchor", "data-thinking-dock": true },
				h("button", {
					type: "button",
					className: "dsh-tdock",
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					"aria-label": detailLabel(stats),
					onClick: () => setView(open ? VIEW_CLOSED : "summary")
				},
					filledGlyph(ThinkIcon, FALLBACK_THINK),
					h("span", { className: "dsh-tdock-label" }, label.map((part, i) => i === 0
						? part
						: [h("span", { key: "sep" + i, className: "dsh-tdock-sep", "aria-hidden": true }, "·"), part]))),
				open ? createPortal(statPanel(view === "turns" ? {
					view: "turns",
					title: copy("turnsTitle"),
					headline: stats.turnsCount + " " + copy("turnsUnit"),
					onBack: () => setView("summary"),
					label: copy("turnsTitle"),
					panelRef,
					pos,
					children: listView
				} : {
					view: "summary",
					title: copy("sessionTitle"),
					headline: approx(countText(stats.thinking), estimated),
					label: detailLabel(stats),
					panelRef,
					pos,
					children: h("div", { className: "dsh-tstat-body" }, pairs)
				}), document.body) : null,
				explain === null
					? null
					: createPortal(whyCard(explain.title, explain.paragraphs, whyRef, whyPos), document.body));
			// The readout is portalled into the shipped stats row when there is one; on an
			// older host without it, it renders in its own slot entry rather than vanishing.
			return row !== null && row !== undefined ? createPortal(readout, row) : readout;
		});
		//#endregion

		//#region plugin
		/**
		 * Client plugin body: register the single dock readout.
		 *
		 * The dependency list is deliberately one entry long — the slot service that
		 * carries the readout. This half reads a projection and draws it; it needs no
		 * session binding, no conversation binding, and no access to the conversation
		 * window, because it never loads, folds, or pages anything.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "thinking-stats",
				order: 1
			}, ThinkingStatsDock));
		}

		exports.apply = apply;
		exports.inject = ["slots"];
		//#endregion

		return module.exports;
	}
});
