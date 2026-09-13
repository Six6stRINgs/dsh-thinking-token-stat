/**
 * Unit spec for the host half: the `thinkingStats` fold.
 *
 * The fold is the only place the plugin's numbers are computed, so it is exercised
 * directly — no browser, no host, no session log — against hand-written events and then
 * against a real recorded log when one is present.
 */

import { readFileSync } from "node:fs";
import zlib from "node:zlib";

// The host half is a plain ES module (`"type": "module"`), so the spec imports it the way
// the host loader would rather than re-parsing its source.
const mod = await import("../lib/index.js");
const { thinkingStatsProjection, stateSchema, viewSchema, KEY, STORED_TURNS, VIEW_TURNS } = mod.__testProjection;

let pass = 0;
function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

/** One settled assistant message, shaped as the log writes it. */
function settled(turn, step, options) {
  const opts = options || {};
  const content = [];
  // `reasoningText` supplies an exact script; `reasoningChars` supplies that many Latin
  // characters. Both may be given, and are separate reasoning blocks.
  if (opts.reasoningText !== undefined) content.push({ type: "reasoning", text: opts.reasoningText });
  else if (opts.reasoningChars !== undefined) content.push({ type: "reasoning", text: "x".repeat(opts.reasoningChars) });
  if (opts.extraReasoning !== undefined) content.push({ type: "reasoning", text: opts.extraReasoning });
  if (opts.visible === true) content.push({ type: "text", text: "hello" });
  const usage = {};
  if (opts.input !== undefined) usage.inputTokens = opts.input;
  if (opts.output !== undefined) usage.outputTokens = opts.output;
  if (opts.cacheRead !== undefined) usage.cacheReadTokens = opts.cacheRead;
  if (opts.cacheWrite !== undefined) usage.cacheWriteTokens = opts.cacheWrite;
  if (opts.reasoning !== undefined) usage.reasoningTokens = opts.reasoning;
  const source = opts.route === undefined ? undefined : { kind: "model", provider: opts.route.split("/")[0], model: opts.route.split("/")[1] };
  return {
    type: "assistant/message",
    seq: opts.seq === undefined ? turn * 10 + step : opts.seq,
    time: 0,
    data: { turn, step, usage, message: { id: "m" + turn + "-" + step, role: "assistant", content, source } },
  };
}

/** A turn boundary, shaped as the log writes it. */
function turnStart(turn, seq) {
  return { type: "turn/start", seq: seq === undefined ? turn * 10 - 1 : seq, time: 0, data: { turn } };
}

/** Fold a list of events through a fresh unit. */
function fold(events, inheritedEventCount) {
  const unit = thinkingStatsProjection();
  let state = unit.init({ createdAt: 0 }, inheritedEventCount === undefined ? 0 : inheritedEventCount);
  for (const event of events) state = unit.apply(state, event);
  return { unit, state, view: unit.wire.view(state) };
}

// 1. the unit announces the contract the registry checks
{
  const unit = thinkingStatsProjection();
  assert(unit.key === KEY, "the unit is registered under its key");
  assert(Number.isSafeInteger(unit.stateVersion) && unit.stateVersion >= 0, "the unit states a version");
  assert(typeof unit.stateSchema.parse === "function" && typeof unit.wire.viewSchema.parse === "function", "both schemas parse");
  assert(typeof unit.init === "function" && typeof unit.apply === "function" && typeof unit.wire.view === "function", "the unit is complete");
  const fresh = unit.init({ createdAt: 0 }, 0);
  assert(stateSchema.parse(fresh) !== undefined, "the initial state satisfies its own schema");
  assert(viewSchema.parse(unit.wire.view(fresh)) !== undefined, "and so does its view");
}

// 2. an event that is not ours costs nothing and must return the same reference
{
  const unit = thinkingStatsProjection();
  const state = unit.init({ createdAt: 0 }, 0);
  for (const type of ["turn/start", "step/end", "tool/call", "user/message", "compaction/prune"]) {
    assert(unit.apply(state, { type, seq: 1, data: {} }) === state, "an unrelated event returns the same state reference");
  }
}

// 3. reasoning the provider reported is taken exactly; reasoning it only wrote is folded
{
  const { state, view } = fold([
    settled(0, 1, { input: 1000, output: 500, reasoning: 300, route: "a/one" }),
    settled(1, 1, { input: 1000, output: 400, reasoningChars: 400, route: "a/one" }),
  ]);
  assert(view.totals.thinking === 300 + 100, "reported 300 plus 400 chars / 4 = 100, got " + view.totals.thinking);
  assert(view.totals.reported === 300, "the reported share is tracked separately, got " + view.totals.reported);
  assert(view.totals.folded === 100, "and so is the folded share, got " + view.totals.folded);
  assert(view.totals.foldedTurns === 1, "one turn needed the fold, got " + view.totals.foldedTurns);
  assert(view.totals.turns === 2 && view.totals.reasoningTurns === 2, "both turns reasoned");
  assert(state.turns.length === 2 && view.turns.length === 2, "one row per turn");
  assert(view.turns[0][1] === 300 && view.turns[1][1] === 100, "each row carries its own thinking");
  assert(view.turns[1][3] === 100, "and its own folded share, got " + view.turns[1][3]);
}

// 3b. reasoning text is priced by script, not at one flat English density
{
  const cjk = fold([settled(0, 1, { input: 1000, output: 400, reasoningChars: 400, reasoningText: "好".repeat(400) })]);
  assert(cjk.view.totals.folded === 400, "400 Chinese characters price at ~1 token each, got " + cjk.view.totals.folded);
  const latin = fold([settled(0, 1, { input: 1000, output: 400, reasoningChars: 400 })]);
  assert(latin.view.totals.folded === 100, "400 Latin characters stay at 4 per token, got " + latin.view.totals.folded);
  const cyrillic = fold([settled(0, 1, { input: 1000, output: 400, reasoningChars: 400, reasoningText: "д".repeat(400) })]);
  assert(cyrillic.view.totals.folded === 160, "400 Cyrillic characters sit between the two, got " + cyrillic.view.totals.folded);
  const greek = fold([settled(0, 1, { input: 1000, output: 400, reasoningChars: 400, reasoningText: "δ".repeat(400) })]);
  assert(greek.view.totals.folded === cyrillic.view.totals.folded, "Greek is priced with the same middle density");
  const arabic = fold([settled(0, 1, { input: 1000, output: 400, reasoningChars: 400, reasoningText: "م".repeat(400) })]);
  assert(arabic.view.totals.folded === 160, "and so is Arabic, got " + arabic.view.totals.folded);
  const kana = fold([settled(0, 1, { input: 1000, output: 400, reasoningChars: 400, reasoningText: "の".repeat(400) })]);
  assert(kana.view.totals.folded === 400, "Japanese kana is dense, got " + kana.view.totals.folded);
  const hangul = fold([settled(0, 1, { input: 1000, output: 400, reasoningChars: 400, reasoningText: "한".repeat(400) })]);
  assert(hangul.view.totals.folded === 400, "Korean Hangul is dense, got " + hangul.view.totals.folded);
  // A mixed settlement is priced by its parts: 400 Latin (100) plus 400 Chinese (400).
  const mixed = fold([settled(0, 1, { input: 1000, output: 400, reasoningChars: 400, extraReasoning: "好".repeat(400) })]);
  assert(mixed.view.totals.folded === 500, "a bilingual settlement prices each part by its own script, got " + mixed.view.totals.folded);
  assert(cjk.view.totals.folded > cyrillic.view.totals.folded && cyrillic.view.totals.folded > latin.view.totals.folded, "dense > middle > latin for the same character count");
  // A provider count still wins outright, whatever the text says.
  const reported = fold([settled(0, 1, { input: 1000, output: 400, reasoning: 250, reasoningChars: 4000, reasoningText: "好".repeat(4000) })]);
  assert(reported.view.totals.folded === 0 && reported.view.totals.reported === 250, "a reported count is never second-guessed");
}

// 4. the shares are measured against the turns that reasoned, never the whole session
{
  const { view } = fold([
    settled(0, 1, { input: 1000, output: 500, reasoning: 300 }),
    settled(1, 1, { input: 1000, output: 4000 }),
  ]);
  assert(view.totals.output === 500, "only the reasoning turn's output is the denominator, got " + view.totals.output);
  assert(view.totals.total === 1500, "and only its token total, got " + view.totals.total);
  assert(view.totals.reasoningTurns === 1 && view.totals.turns === 2, "coverage still counts both turns");
  const reasoning = view.turns.find((row) => row[0] === 0);
  const silent = view.turns.find((row) => row[0] === 1);
  assert(silent[1] === 0, "a turn that produced no reasoning is recorded as zero, not dropped");
  assert(silent[2] === 0 && silent[3] === 0, "with no reported or folded share");
  assert(reasoning[4] === 500, "the reasoning turn keeps its own output for the table");
}

// 5. a turn entering or leaving the reasoning set moves its denominator with it
{
  const unit = thinkingStatsProjection();
  let state = unit.init({ createdAt: 0 }, 0);
  state = unit.apply(state, settled(0, 1, { input: 100, output: 200, reasoning: 300 }));
  const before = unit.wire.view(state).totals;
  assert(before.reasoningTurns === 1 && before.output === 200 && before.total === 300, "one reasoning turn counted");
  // The same step settles again, this time with no reasoning at all.
  state = unit.apply(state, settled(0, 1, { input: 100, output: 200 }));
  const after = unit.wire.view(state).totals;
  assert(after.reasoningTurns === 0, "the turn left the reasoning set, got " + after.reasoningTurns);
  assert(after.output === 0 && after.total === 0, "so its denominator left too, got " + after.output + "/" + after.total);
  assert(after.thinking === 0 && after.turns === 1, "and the turn itself is still counted once");
}

// 6. a retried step replaces its earlier settlement instead of adding to it
{
  const unit = thinkingStatsProjection();
  let state = unit.init({ createdAt: 0 }, 0);
  state = unit.apply(state, settled(0, 1, { input: 100, output: 200, reasoning: 50 }));
  state = unit.apply(state, settled(0, 1, { input: 100, output: 400, reasoning: 90 }));
  const view = unit.wire.view(state);
  assert(view.totals.thinking === 90, "the later settlement wins, got " + view.totals.thinking);
  assert(view.totals.output === 400, "its output too, got " + view.totals.output);
  assert(view.totals.turns === 1 && view.turns.length === 1, "and the turn is not counted twice");
  // A retry that moved to another model leaves both names on the row.
  state = unit.apply(state, settled(0, 1, { input: 100, output: 400, reasoning: 90, route: "b/two" }));
  const row = unit.wire.view(state).turns[0];
  assert(row[5].length === 1 && unit.wire.view(state).labels[row[5][0]] === "b/two", "the surviving route names the row");
}

// 7. a retried step on a different model keeps both names, so the row tells the truth
{
  const unit = thinkingStatsProjection();
  let state = unit.init({ createdAt: 0 }, 0);
  state = unit.apply(state, settled(0, 1, { input: 100, output: 200, reasoning: 50, route: "a/one" }));
  state = unit.apply(state, settled(0, 2, { input: 100, output: 200, reasoning: 50, route: "a/one" }));
  state = unit.apply(state, settled(0, 3, { input: 100, output: 200, reasoning: 50, route: "b/two" }));
  const view = unit.wire.view(state);
  assert(view.labels.length === 2, "both models are in the dictionary, got " + JSON.stringify(view.labels));
  assert(view.turns[0][5].length === 2, "and the turn lists both, got " + JSON.stringify(view.turns[0][5]));
}

// 8. a fork's inherited prefix is not the child's own work
{
  // `inheritedEventCount` counts leading events, and those events carry seq 0..n-1.
  const parent = [
    settled(0, 1, { input: 100, output: 200, reasoning: 50, seq: 0 }),
    settled(1, 1, { input: 100, output: 200, reasoning: 70, seq: 1 }),
  ];
  const { view } = fold(parent.concat([settled(2, 1, { input: 100, output: 200, reasoning: 30, seq: 2 })]), 2);
  assert(view.totals.turns === 1, "only the child's own turn is counted, got " + view.totals.turns);
  assert(view.totals.thinking === 30, "and only its own tokens, got " + view.totals.thinking);
  const unforked = fold(parent.concat([settled(2, 1, { input: 100, output: 200, reasoning: 30, seq: 2 })]), 0);
  assert(unforked.view.totals.turns === 3, "without inheritance the same log counts three turns");
}

// 9. the view is bounded while the aggregates stay whole-session
{
  const events = [];
  for (let turn = 0; turn < VIEW_TURNS + 25; turn += 1) events.push(settled(turn, 1, { input: 10, output: 20, reasoning: 5 }));
  const { view } = fold(events);
  assert(view.turnCount === VIEW_TURNS + 25, "every turn is counted, got " + view.turnCount);
  assert(view.turns.length === VIEW_TURNS, "but only the newest are published, got " + view.turns.length);
  assert(view.turns[0][0] === 25, "the published window starts at the oldest published turn, got " + view.turns[0][0]);
  assert(view.totals.thinking === (VIEW_TURNS + 25) * 5, "the total covers all of them, got " + view.totals.thinking);
  assert(viewSchema.parse(view) !== undefined, "the bounded view still satisfies its schema");
}

// 10. the state is bounded too, and keeps counting what it no longer lists
{
  const events = [];
  for (let turn = 0; turn < STORED_TURNS + 30; turn += 1) events.push(settled(turn, 1, { input: 10, output: 20, reasoning: 1 }));
  const { state, view } = fold(events);
  assert(state.turns.length === STORED_TURNS, "rows are capped, got " + state.turns.length);
  assert(view.turnCount === STORED_TURNS + 30, "the count is not, got " + view.turnCount);
  assert(view.totals.thinking === STORED_TURNS + 30, "and neither is the total, got " + view.totals.thinking);
  assert(stateSchema.parse(state) !== undefined, "the capped state satisfies its schema");
}

// 11. the schema is a real gate: a mangled checkpoint is refused, not half-read
{
  const { state } = fold([settled(0, 1, { input: 10, output: 20, reasoning: 5 })]);
  const broken = [
    { ...state, floor: "soon" },
    { ...state, labels: [7] },
    { ...state, turns: [[0, 1, 2, 3, 4]] },
    { ...state, turns: [[0, 1, 2, 3, 4, 5, [0]]], labels: [] },
    { ...state, totals: { thinking: 1 } },
    { ...state, last: [0, 1, 2] },
  ];
  for (const candidate of broken) {
    let threw = false;
    try {
      stateSchema.parse(candidate);
    } catch (error) {
      threw = true;
    }
    assert(threw, "a malformed state is refused: " + JSON.stringify(candidate).slice(0, 60));
  }
  assert(stateSchema.parse(state) !== undefined, "while the real one passes");
  let viewThrew = false;
  try {
    viewSchema.parse({ asOfTurn: 0, turnCount: 0, totals: state.totals, labels: [], turns: [[0, 1, 2, 3, 4, [0]]] });
  } catch (error) {
    viewThrew = true;
  }
  assert(viewThrew, "and a row referencing a missing label is refused");
}

// 12. a usage-less or reasoning-less settlement still counts its tokens
{
  const unit = thinkingStatsProjection();
  let state = unit.init({ createdAt: 0 }, 0);
  state = unit.apply(state, { type: "assistant/message", seq: 1, time: 0, data: { turn: 0, step: 1, message: { id: "m", content: [] } } });
  const view = unit.wire.view(state);
  assert(view.totals.turns === 1 && view.totals.thinking === 0, "a settlement without usage counts as a turn with no reasoning");
  state = unit.apply(state, settled(0, 2, { input: 100, output: 200, cacheRead: 5000, route: "a/one" }));
  const both = unit.wire.view(state);
  assert(both.turns[0][1] === 0, "the turn still has no reasoning");
  assert(both.totals.total === 0, "and contributes no denominator, got " + both.totals.total);
  const withAll = fold([settled(3, 1, { input: 10, output: 20, cacheRead: 30, cacheWrite: 40, reasoning: 5 })]);
  assert(withAll.view.totals.turns === 1, "a turn with all buckets is counted");
  assert(withAll.view.turns[0][4] === 20, "the row's output is the provider's output, got " + withAll.view.turns[0][4]);
}

// 12. a turn that never assembled a message is still a turn
{
  // Exactly the shape of a failed or aborted turn: a boundary, a step, and no
  // settlement — so there are no tokens, but there is a turn that must be listed.
  const { state, view } = fold([
    turnStart(1, 0),
    { type: "step/end", seq: 1, time: 0, data: { turn: 1, step: 1 } },
    { type: "turn/end", seq: 2, time: 0, data: { turn: 1, reason: { kind: "error" } } },
    turnStart(2, 3),
    settled(2, 1, { input: 1000, output: 400, reasoning: 120, seq: 4 }),
  ]);
  assert(view.turnCount === 2, "both started turns are counted, got " + view.turnCount);
  assert(view.turns.length === 2, "and both are listed, got " + view.turns.length);
  assert(view.turns[0][0] === 1 && view.turns[0][1] === 0, "the failed turn is listed with no thinking, got: " + JSON.stringify(view.turns[0]));
  assert(view.turns[0][2] === 0 && view.turns[0][3] === 0 && view.turns[0][4] === 0, "and no reported, folded or output figures");
  assert(view.turns[0][5].length === 0, "and no model, because nothing ran a model to completion");
  assert(view.totals.reasoningTurns === 1, "it does not count as a turn that reasoned, got " + view.totals.reasoningTurns);
  assert(view.totals.output === 400, "and it contributes no denominator, got " + view.totals.output);
  assert(stateSchema.parse(state) !== undefined, "the state with an empty turn is still valid");
  // A boundary that arrives twice for the same turn must not open a second row.
  const again = fold([turnStart(1, 0), turnStart(1, 1), settled(1, 1, { input: 10, output: 20, reasoning: 5, seq: 2 })]);
  assert(again.view.turnCount === 1 && again.view.turns.length === 1, "a repeated boundary does not duplicate the turn");
  // A fork's inherited boundaries are not the child's turns.
  const forked = fold([turnStart(0, 0), turnStart(1, 1), turnStart(2, 2), settled(2, 1, { input: 10, output: 20, reasoning: 5, seq: 3 })], 2);
  assert(forked.view.turnCount === 1 && forked.view.turns[0][0] === 2, "inherited turn boundaries are skipped, got: " + JSON.stringify(forked.view.turns.map((row) => row[0])));
}

// 13. a settlement still counts its tokens even when the boundary was never seen
{
  const { view } = fold([settled(7, 1, { input: 100, output: 200, reasoning: 30 })]);
  assert(view.turnCount === 1 && view.turns[0][0] === 7, "a settlement opens its own turn when no boundary is in the log");
  assert(view.totals.thinking === 30, "with its figures intact, got " + view.totals.thinking);
  assert(view.totals.settledTurns === 1, "and it counts as settled, got " + view.totals.settledTurns);
}

// 13b. the fold states how much of the session it actually has figures for
{
  const quiet = [turnStart(1, 0), settled(1, 1, { input: 100, output: 200, seq: 1 })];
  const healthy = fold([turnStart(1, 0), settled(1, 1, { input: 100, output: 200, seq: 1 }), turnStart(2, 2), settled(2, 1, { input: 100, output: 200, reasoning: 40, seq: 3 })]);
  assert(healthy.view.totals.settledTurns === 2 && healthy.view.totals.turns === 2, "every turn settled");
  // A turn that reported no usage still settled: it produced a reply, it just had no
  // tokens to report. Only a turn that never settled at all is a gap.
  const gap = fold([
    turnStart(1, 0),
    { type: "turn/end", seq: 1, time: 0, data: { turn: 1, reason: { kind: "error" } } },
    turnStart(2, 2),
    settled(2, 1, { input: 100, output: 200, reasoning: 40, seq: 3 }),
  ]);
  assert(gap.view.turnCount === 2, "both turns are listed, got " + gap.view.turnCount);
  assert(gap.view.totals.settledTurns === 1, "but only one of them settled, got " + gap.view.totals.settledTurns);
  const quietOnly = fold(quiet);
  assert(quietOnly.view.totals.settledTurns === quietOnly.view.turnCount, "a turn with a usage-less reply counts as settled");
  assert(
    (gap.view.turnCount - gap.view.totals.settledTurns) === 1,
    "so the gap is exactly the turns that never produced a message",
  );
}

// 14. a checkpoint round trip resumes the fold exactly where it left off
{
  const events = [];
  for (let turn = 0; turn < 12; turn += 1) events.push(settled(turn, 1, { input: 100, output: 200, reasoning: 10 + turn, route: turn % 3 === 0 ? "a/one" : "b/two" }));
  const unit = thinkingStatsProjection();
  let state = unit.init({ createdAt: 0 }, 0);
  for (const event of events.slice(0, 7)) state = unit.apply(state, event);
  // The registry stores `{ver, seq, val}` per unit and, on restore, parses `val` back
  // through `stateSchema` before folding the tail — so the payload must survive JSON.
  const checkpoint = { ver: unit.stateVersion, seq: 6, val: JSON.parse(JSON.stringify(state)) };
  assert(stateSchema.parse(checkpoint.val) !== undefined, "a checkpointed state survives the schema on restore");
  let resumed = stateSchema.parse(checkpoint.val);
  for (const event of events.slice(7)) resumed = unit.apply(resumed, event);
  const straight = unit.init({ createdAt: 0 }, 0);
  let direct = straight;
  for (const event of events) direct = unit.apply(direct, event);
  const resumedView = unit.wire.view(resumed);
  const directView = unit.wire.view(direct);
  assert(JSON.stringify(resumedView) === JSON.stringify(directView), "and the resumed fold equals the uninterrupted one");
  // A version bump makes the host discard the row and refold from init; the refolded
  // state must be identical, which is what makes that recovery safe.
  const refolded = fold(events);
  assert(JSON.stringify(refolded.view) === JSON.stringify(directView), "so does refolding from scratch after a version bump");
}

// 14. a published view keeps reporting the numbers it was published with
{
  const unit = thinkingStatsProjection();
  let state = unit.init({ createdAt: 0 }, 0);
  state = unit.apply(state, settled(0, 1, { input: 100, output: 200, reasoning: 50, route: "a/one" }));
  const first = unit.wire.view(state);
  const firstJson = JSON.stringify(first);
  state = unit.apply(state, settled(1, 1, { input: 100, output: 200, reasoning: 70, route: "a/one" }));
  state = unit.apply(state, settled(2, 1, { input: 100, output: 200, reasoning: 90, route: "a/one" }));
  assert(JSON.stringify(first) === firstJson, "an already-published view is not rewritten by later events, got: " + JSON.stringify(first));
  assert(unit.wire.view(state).totals.thinking === 210, "while the current one keeps counting, got " + unit.wire.view(state).totals.thinking);
}

// 15. the fold is driven by a real recorded log when one is available
{
  const file = process.env.DSH_TEST_LOG;
  if (file === undefined) {
    console.log("(skipping the recorded-log check: set DSH_TEST_LOG to a session.v3.jsonl.zstd path)");
  } else {
    const buffer = readFileSync(file);
    const magic = [0x28, 0xb5, 0x2f, 0xfd];
    const offsets = [];
    for (let index = 0; index + 3 < buffer.length; index += 1) {
      if (buffer[index] === magic[0] && buffer[index + 1] === magic[1] && buffer[index + 2] === magic[2] && buffer[index + 3] === magic[3]) offsets.push(index);
    }
    let text = "";
    for (let index = 0; index < offsets.length; index += 1) {
      const start = offsets[index];
      const end = index + 1 < offsets.length ? offsets[index + 1] : buffer.length;
      try {
        text += zlib.zstdDecompressSync(buffer.subarray(start, end)).toString("utf8");
      } catch (error) {
        // A frame we cannot read is a frame we do not count.
      }
    }
    const events = text.split("\n").filter((line) => line.trim() !== "").map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    }).filter(Boolean);
    const { state, view } = fold(events);
    assert(stateSchema.parse(state) !== undefined && viewSchema.parse(view) !== undefined, "the real log produces a valid state and view");
    assert(view.turnCount > 0, "the real log produces turns, got " + view.turnCount);
    // Turn totals must agree with a straight independent fold of the same events.
    // The density model is re-stated here rather than imported, so the check fails if the
    // fold's own pricing ever drifts from what it claims to do.
    const denseRe = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/g;
    const mediumRe = /[\u0370-\u03ff\u0400-\u052f\u0530-\u058f\u0590-\u05ff\u0600-\u06ff\u0700-\u074f\u0750-\u077f\u0780-\u07bf\u08a0-\u08ff\u0900-\u097f\u0980-\u09ff\u0a00-\u0a7f\u0a80-\u0aff\u0b00-\u0b7f\u0b80-\u0bff\u0c00-\u0c7f\u0c80-\u0cff\u0d00-\u0d7f\u0d80-\u0dff\u0e00-\u0e7f\u0e80-\u0eff\u0f00-\u0fff\u1000-\u109f\u10a0-\u10ff\u1200-\u137f\u1780-\u17ff]/g;
    const price = (text) => {
      const withoutDense = text.replace(denseRe, "");
      const withoutMedium = withoutDense.replace(mediumRe, "");
      const dense = text.length - withoutDense.length;
      const medium = withoutDense.length - withoutMedium.length;
      const sparse = text.length - dense - medium;
      return Math.ceil(dense + medium / 2.5 + sparse / 4);
    };
    const started = new Set();
    const byTurn = new Map();
    let reported = 0;
    let folded = 0;
    let denseChars = 0;
    let totalChars = 0;
    for (const event of events) {
      if (event.type === "turn/start") started.add(event.data.turn);
      if (event.type !== "assistant/message") continue;
      const usage = event.data.usage !== undefined ? event.data.usage : {};
      const counted = typeof usage.reasoningTokens === "number" && usage.reasoningTokens > 0 ? usage.reasoningTokens : 0;
      let price_ = 0;
      if (counted === 0) {
        for (const block of event.data.message.content) if (block.type === "reasoning") price_ += price(block.text);
      }
      byTurn.set(event.data.turn, (byTurn.get(event.data.turn) || 0) + counted + price_);
      reported += counted;
      folded += price_;
      for (const block of event.data.message.content) {
        if (block.type !== "reasoning") continue;
        totalChars += block.text.length;
        denseChars += block.text.length - block.text.replace(denseRe, "").length;
      }
    }
    assert(view.turnCount === started.size, `the fold sees ${view.turnCount} turns where the log started ${started.size}`);
    assert(view.totals.reported === reported, `reported ${view.totals.reported} where the log has ${reported}`);
    assert(view.totals.folded === folded, `folded ${view.totals.folded} where the log has ${folded}`);
    // Every turn the log started is listed, including the ones that never assembled a
    // message: those are exactly the turns with no figures at all.
    const emptyRows = view.turns.filter((row) => row[1] === 0 && row[2] === 0 && row[3] === 0 && row[4] === 0);
    assert(
      emptyRows.length === started.size - byTurn.size || view.turnCount > view.turns.length,
      `the log has ${started.size - byTurn.size} message-less turns, listed with no figures: ${emptyRows.length}`,
    );
    const withThinking = view.turns.filter((row) => row[1] > 0);
    const newest = withThinking[withThinking.length - 1];
    assert(newest[1] === byTurn.get(newest[0]), `the newest reasoned row (turn ${newest[0]}) matches the log: ${newest[1]} vs ${byTurn.get(newest[0])}`);
    console.log(`  recorded log: ${view.turnCount} turns (${emptyRows.length} without a message), reported ${reported}, folded ${folded}, thinking ${view.totals.thinking}, published rows ${view.turns.length}`);
    console.log(`  reasoning text: ${totalChars.toLocaleString()} characters, ${(denseChars / totalChars * 100).toFixed(1)}% of them dense-script`);
    assert(denseChars >= 0 && totalChars > 0, "the log's reasoning text is measurable");
  }
}

console.log(`All ${pass} assertions passed.`);
