/**
 * Renders the browser half against a synthetic projection value.
 *
 * The numbers themselves are the host fold's business and are covered by
 * `test/projection.mjs`; this file covers what the client does with them — the pill, the
 * overview, the per-turn table, the explanation, and the ways the panel closes.
 */

import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

// ── minimal React stubs ─────────────────────────────────────────────────
// State cells persist across the two commits `mount()` performs and reset between
// mounts, so effects that call setState are observable (the dock resolves the shipped
// stats row in an effect before it portals into it).
let cells = [];
let cursor = 0;
/** Which panel `mount()` opens; the dock's view state carries this sentinel. */
let seedView = "summary";
const CLOSED_VIEW = "closed";
function resetCells() {
  cells = [];
  cursor = 0;
}
const react = {
  memo: (c) => c,
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useState: (initial) => {
    const i = cursor++;
    // The view state is recognised by its sentinel rather than by hook position, so
    // adding state elsewhere cannot silently break every panel test.
    if (!(i in cells)) cells[i] = initial === CLOSED_VIEW ? seedView : initial;
    return [cells[i], (next) => { cells[i] = typeof next === "function" ? next(cells[i]) : next; }];
  },
  useRef: (initial) => {
    const i = cursor++;
    if (!(i in cells)) cells[i] = { current: initial };
    return cells[i];
  },
  useEffect: (fn) => { fn(); },
  useLayoutEffect: (fn) => { fn(); },
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
};
const ThinkIconMock = (props) => ({ type: "IconThinkOutline16", props });
const portals = [];

const requireMock = {
  react,
  "react-dom": { createPortal: (node, container) => { portals.push({ node, container }); return node; } },
  "@deepseek-ai/dsh-client-ui-primitives": {
    IconThinkOutline16: ThinkIconMock,
    useAnchoredPosition: () => null,
  },
};

// ── stub the AMD loader + require, run the factory ─────────────────────
// The boxes the plugin measures: a panel anchored above the composer (so near the bottom
// of the window) and a card whose height the tests set to stand in for however much prose
// the explanation runs to.
const WHY_TEST_WIDTH = 280;
const layout = {
  viewport: { width: 1280, height: 720 },
  panel: { left: 320, top: 300, right: 820, bottom: 640 },
  cardHeight: 190
};
let captured = null;
let rowStub = null;
const fakeWindow = {
  __ModuleLoader__: { load: (obj) => { captured = obj; } },
  get innerWidth() { return layout.viewport.width; },
  get innerHeight() { return layout.viewport.height; }
};
const documentStub = {
  documentElement: { lang: process.env.DSH_TEST_LANG || "en" },
  body: {},
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: (selector) => (selector === "[data-composer-stats]" ? rowStub : null),
  createElement: () => ({ setAttribute: () => {}, textContent: "" }),
  head: { appendChild: () => {} },
};
new Function("window", "document", "require", SRC)(fakeWindow, documentStub, (spec) => requireMock[spec]);
if (!captured || !captured.factory) throw new Error("factory not captured");
const mod = captured.factory((spec) => requireMock[spec]);

if (JSON.stringify(mod.inject) !== JSON.stringify(["slots"])) {
  throw new Error("the client half must depend only on the slot service, got " + JSON.stringify(mod.inject));
}

// ── stub ctx.slots, run apply, capture registrations ───────────────────
const registrations = [];
const ctx = {
  slots: {
    inject: (name, cb) => { cb(); },
    register: (opts, component) => { registrations.push({ opts, component }); },
  },
};
mod.apply(ctx);

const dockReg = registrations.find((r) => r.opts.name === "conversation.composer.dock");
if (!dockReg) throw new Error("composer.dock not registered");
if (registrations.length !== 1) {
  throw new Error("the plugin must own exactly one readout surface, got " + registrations.length);
}

// ── element tree helpers ───────────────────────────────────────────────
function render(node) {
  if (node === null || node === undefined) return null;
  if (node === false || node === true) return node;
  if (Array.isArray(node)) return node.map(render).filter(Boolean);
  if (typeof node === "string" || typeof node === "number") return String(node);
  const { type, props, children } = node;
  const kids = render(children).filter(Boolean);
  const el = { type, props, kids };
  // React attaches refs at commit; the harness attaches them as it builds the tree. That
  // is faithful enough for the effects under test, which read the previous commit's
  // elements — the panel is measured on the commit after the one that rendered it.
  if (typeof props.ref === "object" && props.ref !== null) props.ref.current = el;
  const box = boxOf(props.className);
  if (box !== null) el.getBoundingClientRect = () => box;
  // The dismissal rule asks each surface whether the press landed inside it. A press on a
  // bare stub object is inside nothing, which leaves the classification to the markers the
  // plugin puts on the DOM — the same answer the browser gives for a real press.
  el.contains = (target) => {
    if (target === el) return true;
    if (target === null || typeof target !== "object") return false;
    return kids.some((kid) => typeof kid === "object" && kid !== null && typeof kid.contains === "function" && kid.contains(target));
  };
  return el;
}
/** The box a rendered element reports, for the code that measures before it places. */
function boxOf(className) {
  if (className === "dsh-tstat-panel") return liveBox(() => layout.panel);
  if (className === "dsh-tstat-why") return liveBox(() => ({ left: 0, top: 0, right: WHY_TEST_WIDTH, bottom: layout.cardHeight }));
  return null;
}
/**
 * A live rect: a real element's box is read when it is measured, not when it was rendered,
 * so the box has to follow the layout the test sets rather than snapshot it.
 * @param rect - returns the current rectangle.
 * @returns a DOMRect-shaped object.
 */
function liveBox(rect) {
  return {
    get left() { return rect().left; },
    get top() { return rect().top; },
    get right() { return rect().right; },
    get bottom() { return rect().bottom; },
    get width() { return rect().right - rect().left; },
    get height() { return rect().bottom - rect().top; }
  };
}
function textOf(el) {
  if (el === null || el === undefined) return null;
  if (typeof el === "string" || typeof el === "number") return String(el);
  if (Array.isArray(el)) return el.filter(Boolean).map(textOf).join(" ");
  if (Array.isArray(el.kids)) return el.kids.filter(Boolean).map(textOf).join(" ");
  return textOf(el.kids);
}
function flatten(children) {
  const out = [];
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (node !== null && node !== undefined) out.push(node);
  };
  walk(children);
  return out;
}

/**
 * Render one slot entry to its committed tree: a fresh state store, the first commit
 * (which runs effects and may setState), then the second commit that reflects those
 * updates.
 * @param projections - projection key → value, as the host would serve them.
 * @param view - `summary` (the pill) or `turns` (the chevron list).
 * @returns the committed element tree.
 */
function mount(projections, view) {
  resetCells();
  seedView = view === undefined ? "summary" : view;
  const props = { useProjection: (key) => projections[key] };
  render(dockReg.component(props));
  cursor = 0;
  return render(dockReg.component(props));
}
/** Re-render the tree `mount()` built, as React would after a state update. */
let lastProjections = null;
function mountTracked(projections, view) {
  lastProjections = projections;
  return mount(projections, view);
}
function rerender() {
  cursor = 0;
  return render(dockReg.component({ useProjection: (key) => lastProjections[key] }));
}

const panelOf = (el) => (el === null || !Array.isArray(el.kids) ? null : el.kids.find((kid) => kid !== undefined && kid.props !== undefined && kid.props.className === "dsh-tstat-panel") || null);
function panelKidsOf(el) {
  const panel = panelOf(el);
  if (panel === null) return null;
  const body = panel.kids.find((kid) => kid.props !== undefined && kid.props.className === "dsh-tstat-body");
  return body === undefined ? null : flatten(body.kids);
}
function detailsKidsOf(el) {
  const kids = panelKidsOf(el);
  if (kids === null) return null;
  const dl = kids.find((kid) => kid.props !== undefined && kid.props.className === "dsh-tstat-details");
  return dl === undefined ? null : flatten(dl.kids);
}
function coverageOf(el) {
  const kids = panelKidsOf(el);
  if (kids === null) return null;
  return kids.find((kid) => kid.props !== undefined && kid.props.className === "dsh-tstat-coverage") || null;
}
function turnRowsOf(el) {
  const kids = panelKidsOf(el);
  if (kids === null) return null;
  const list = kids.find((kid) => kid.props !== undefined && kid.props.className === "dsh-tstat-turns");
  if (list === undefined) return null;
  return flatten(list.kids).filter((kid) => kid.props !== undefined && typeof kid.props["data-turn"] === "number");
}
function filtersOf(el) {
  const kids = panelKidsOf(el);
  if (kids === null) return [];
  const row = kids.find((kid) => kid.props !== undefined && kid.props.className === "dsh-tstat-filters");
  return row === undefined ? [] : flatten(row.kids);
}
function headCellsOf(el) {
  const kids = panelKidsOf(el);
  if (kids === null) return null;
  const head = kids.find((kid) => kid.props !== undefined && typeof kid.props.className === "string" && kid.props.className.includes("dsh-tstat-head"));
  return head === undefined ? null : flatten(head.kids);
}
function pagerOf(el) {
  const kids = panelKidsOf(el);
  if (kids === null) return null;
  return kids.find((kid) => kid.props !== undefined && kid.props.className === "dsh-tstat-pager") || null;
}
function pagerButtonsOf(el) {
  const pager = pagerOf(el);
  return pager === null ? [] : flatten(pager.kids).filter((kid) => kid.props !== undefined && kid.props.className === "dsh-tstat-page");
}
/** The first element with the given class anywhere under a rendered node. */
function findClass(node, className) {
  if (node === null || node === undefined || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findClass(child, className);
      if (hit !== null) return hit;
    }
    return null;
  }
  if (node.props !== undefined && node.props.className === className) return node;
  return Array.isArray(node.kids) ? findClass(node.kids, className) : null;
}
/** The `?` on a note whose text starts with the given prefix, or null when it has none. */
function noteHelpOf(el, prefix) {
  const kids = detailsKidsOf(el);
  if (kids === null) return null;
  for (const kid of kids) {
    if (kid.props === undefined || kid.props.className !== "dsh-tstat-note") continue;
    if (!textOf(kid).startsWith(prefix)) continue;
    return findClass(kid, "dsh-tstat-help");
  }
  return null;
}
/** The `?` beside the scope line, or null when the count is complete. */
function scopeHelpOf(el) {
  return noteHelpOf(el, ZH ? "统计范围" : "Scope");
}
/** The `?` beside the list-cap line, or null when nothing is capped. */
function capHelpOf(el) {
  return noteHelpOf(el, ZH ? "逐轮明细" : "Only the newest");
}
function estimateOf(el) {
  const kids = detailsKidsOf(el);
  if (kids === null) return null;
  for (const kid of kids) {
    if (kid.props !== undefined && kid.props.className === "dsh-tstat-estimate") return kid;
    // The estimate lives inside the footnote cell that closes the overview list.
    if (kid.props === undefined || kid.props.className !== "dsh-tstat-note" || !Array.isArray(kid.kids)) continue;
    const found = flatten(kid.kids).find((child) => child.props !== undefined && child.props.className === "dsh-tstat-estimate");
    if (found !== undefined) return found;
  }
  return null;
}
function helpOf(el) {
  const estimate = estimateOf(el);
  if (estimate === null) return null;
  const found = flatten(estimate.kids).find((kid) => kid.props !== undefined && kid.props.className === "dsh-tstat-help");
  return found === undefined ? null : found;
}
function whyCardOf(rendered) {
  const hit = portals.find((p) => p.node !== null && p.node !== undefined && p.node.props !== undefined && p.node.props.className === "dsh-tstat-why");
  return hit === undefined ? null : (rendered === undefined ? render(hit.node) : rendered);
}
function pillTextOf(el) {
  if (el === null || !Array.isArray(el.kids)) return null;
  const button = el.kids[0];
  if (button === undefined || !Array.isArray(button.kids)) return null;
  const label = button.kids.find((kid) => kid !== null && kid !== undefined && kid.props !== undefined && typeof kid.props.className === "string" && /tdock-label$/.test(kid.props.className));
  return label === undefined ? null : textOf(label);
}
const cellOf = (row, className) => row.kids.find((kid) => kid.props !== undefined && kid.props.className === className);

// ── fixtures: projection values, shaped exactly as the host publishes them ──
/**
 * A `thinkingStats` view.
 * @param rows - `[turn, thinking, reported, folded, output, refs]` per turn, ascending.
 * @param labels - the model dictionary rows index into.
 * @param options - `turnCount` (defaults to the row count) and `whole`.
 */
function viewOf(rows, labels, options) {
  const opts = options || {};
  const totals = { thinking: 0, reported: 0, folded: 0, output: 0, total: 0, turns: 0, settledTurns: 0, reasoningTurns: 0, foldedTurns: 0 };
  for (const row of rows) {
    totals.thinking += row[1];
    totals.reported += row[2];
    totals.folded += row[3];
    totals.turns += 1;
    totals.settledTurns += 1;
    if (row[1] > 0) {
      totals.reasoningTurns += 1;
      totals.output += row[4];
      totals.total += row[4] + 1000;
    }
    if (row[3] > 0) totals.foldedTurns += 1;
  }
  if (opts.turnCount !== undefined) totals.turns = opts.turnCount;
  if (opts.settledTurns !== undefined) totals.settledTurns = opts.settledTurns;
  return {
    asOfTurn: rows.length === 0 ? 0 : rows[rows.length - 1][0],
    turnCount: totals.turns,
    totals,
    labels: labels || [],
    turns: rows,
    ...(opts.whole === undefined ? {} : { whole: opts.whole }),
  };
}
const reportedRow = (turn, thinking, output, ref) => [turn, thinking, thinking, 0, output, ref === undefined ? [] : [ref]];
const foldedRow = (turn, thinking, output) => [turn, thinking, 0, thinking, output, []];
const PROJECTIONS = (view, extra) => Object.assign({ thinkingStats: view }, extra || {});

let pass = 0;
function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}
const ZH = process.env.DSH_TEST_LANG === "zh-CN";
const L = {
  sessionTitle: ZH ? "本次会话思考 token" : "Thinking tokens (session)",
  turnsTitle: ZH ? "逐轮思考来源" : "Thinking by turn",
  all: ZH ? "思考 / 全部 token" : "Thinking / all tokens",
  output: ZH ? "思考 / 推理输出 token" : "Thinking / reasoning output",
  turns: ZH ? "推理轮次" : "Reasoning turns",
  turnsUnit: ZH ? "轮" : "turns",
  foldedTurns: ZH ? "未上报推理的轮次" : "Turns without a reported count",
  tokens: ZH ? "token" : "tok",
  colTurn: ZH ? "轮次" : "Turn",
  colThinking: ZH ? "思考" : "Thinking",
  colOutput: ZH ? "本轮输出" : "Output",
  colSource: ZH ? "思考来源" : "Thinking source",
  colModel: ZH ? "模型" : "Model",
  colShare: ZH ? "占输出" : "Of output",
  more: ZH ? "多轮具体统计" : "Per-turn detail",
  srcReported: ZH ? "直接提供" : "Reported",
  srcFolded: ZH ? "文本推算" : "Text",
  srcMixed: ZH ? "混合推算" : "Mixed",
  srcNone: ZH ? "未提供" : "None",
  newer: ZH ? "更新的" : "Newer",
  older: ZH ? "更早的" : "Older",
  pageOf: (p, n) => (ZH ? "第 " + p + " / " + n + " 页" : "Page " + p + " / " + n),
  estimated: (tokens) => (ZH ? "估算约 " + tokens : "Estimated ≈ " + tokens),
  scopeWhole: (n) => (ZH ? "统计范围：全量会话，共 " + n + " 轮。" : "Scope: the whole session, " + n + " turns."),
  scopeOwn: (n) => (ZH ? "统计范围：本会话自身的 " + n + " 轮（不含继承的历史）。" : "Scope: this session's own " + n + " turns, excluding inherited history."),
  scopeGap: (n, g) => (ZH ? "统计范围：全量会话，共 " + n + " 轮，其中 " + g + " 轮没有产出消息。" : "Scope: the whole session, " + n + " turns, of which " + g + " produced no reply."),
  scopeTotals: ZH ? "统计范围：仅有整场合计，没有逐轮数据。" : "Scope: session totals only; no per-turn figures.",
  scopeWhyOpen: ZH ? "统计范围为什么不是全量" : "Why the scope is not the whole session",
  scopeWhyTitle: ZH ? "为什么这里不是完整统计" : "Why this is not a complete count",
  whyGap: (n) => (ZH ? "有 " + n + " 轮已经开始、却没有产出助手消息（报错、被中断或中途取消），因此这些轮次没有可统计的用量；它们在表格里显示为「未提供」。" : n + " turns started but never produced an assistant message — they errored, were interrupted, or were cancelled — so there is no usage to count for them. The table lists them as \"None\"."),
  whyOwn: ZH ? "本会话由其它会话 fork 而来。折叠只统计本会话自身产生的轮次，继承来的历史不计入。" : "This session was forked from another. The fold counts only the turns this session produced itself; inherited history is excluded.",
  whyDurable: ZH ? "此宿主没有提供逐轮投影（旧版 DSH，或该会话尚未折叠过），所以只能给出官方的整场合计。" : "This host publishes no per-turn projection — an older DSH, or a session that has not been folded — so only the official session totals are available.",
  capped: (n) => (ZH ? "逐轮明细只列出最近 " + n + " 轮，更早的轮次只计入合计。" : "Only the newest " + n + " turns are listed; earlier ones count towards the totals."),
  capWhyOpen: ZH ? "为什么明细不是全部轮次" : "Why the table is not the whole history",
  capWhyTitle: ZH ? "为什么逐轮明细有上限" : "Why the list is capped",
  whyCapped: (n) => (ZH ? "逐轮明细只发布最近 " + n + " 轮：投影的值会跟着每一帧快照发送，必须保持在界面量级。更早的轮次仍然完整计入上面的合计。" : "Only the newest " + n + " turns are published: a projection value rides every snapshot frame, so it has to stay UI-sized. Earlier turns are still counted in the totals above."),
  pending: ZH ? "本会话还没有逐轮统计。" : "No per-turn figures for this session yet.",
  durableOnly: ZH ? "此宿主未提供逐轮统计，下面只有整场合计。" : "This host publishes no per-turn figures; only session totals are shown.",
  noTurns: ZH ? "当前筛选下没有轮次。" : "No turns match the filters.",
  whyOne: ZH ? "部分模型提供方不返回推理 token 计数。若因此忽略思考文本，这类模型会被记为全程未推理，而其思考内容实际已包含在响应之中。" : "Some model providers do not report a reasoning-token count. Discarding the reasoning text in that case would record those turns as having produced no reasoning at all, even though the reasoning is present in the response.",
  whyTwo: ZH ? "故对这类响应改按文本长度折算，并按语种取不同密度：中日韩文字、假名与谚文按 1 个字符折合 1 个 token；西里尔、希腊、阿拉伯、希伯来与印度诸文字约 2.5 个字符折合 1 个；拉丁字母及数字标点仍按 4 个字符折合 1 个。该值属估算而非实测，因此以 ~ 标注。" : "Such responses are therefore derived from text length, at a density that depends on the script: CJK characters, kana and Hangul at one character per token; Cyrillic, Greek, Arabic, Hebrew and the Indic scripts at about two and a half; Latin letters, digits and punctuation at four. The result is an estimate rather than a measurement, which is why it carries a ~.",
};

// 1. the pill reports the projection's totals, with reported figures unmarked
{
  const el = mountTracked(PROJECTIONS(viewOf([reportedRow(0, 300, 500, 0), reportedRow(1, 200, 400, 0)], ["a/one"])));
  const txt = textOf(el);
  assert(el !== null && el.props.className === "dsh-tdock-anchor", "the pill anchors the readout");
  assert(el.kids[0].type === "button" && el.kids[0].props["aria-haspopup"] === "dialog", "the pill opens a dialog");
  assert(txt.includes("500"), "the reported total is shown, got: " + txt);
  assert(txt.includes("55.6%"), "thinking / reasoning output = 500/900, got: " + txt);
  assert(txt.includes("17.2%"), "thinking / all tokens = 500/2900, got: " + txt);
  assert(txt.includes(L.sessionTitle) && txt.includes(L.output), "the overview names its rows, got: " + txt);
  assert(!txt.includes("~"), "a fully reported session carries no estimate mark, got: " + txt);
  assert(textOf(coverageOf(el) === null ? el : el).includes(L.turns), "coverage is stated, got: " + txt);
}

// 2. every figure resting on the text fold is marked, here and on the pill
{
  const el = mountTracked(PROJECTIONS(viewOf([foldedRow(0, 100, 400)], [])));
  const txt = textOf(el);
  assert(txt.includes("~100"), "the total is marked as an estimate, got: " + txt);
  assert(txt.includes("~25.0%"), "and so is the reasoning-output share, got: " + txt);
  assert(txt.includes("~7.1%"), "and the all-token share, got: " + txt);
  assert(pillTextOf(el).includes("~100"), "the pill carries the mark too, got: " + pillTextOf(el));
  assert(txt.includes(L.foldedTurns), "the folded-turn row is stated, got: " + txt);
  const estimate = detailsKidsOf(el).find((kid) => kid.props.className === "dsh-tstat-estimate" || (kid.props.className === "dsh-tstat-note" && flatten(kid.kids).some((k) => k.props.className === "dsh-tstat-estimate")));
  assert(estimate !== undefined, "the folded share has its own line");
  // The line says what the figure is, rather than leaving a bare `~100 tok` to be read
  // as an ordinary number.
  assert(textOf(estimate).includes(L.estimated("100 " + L.tokens)), "and states the estimate in words, got: " + textOf(estimate));
  assert(textOf(estimate).startsWith(ZH ? "估算约" : "Estimated"), "starting with the word, not the mark");
  assert(helpOf(el) !== null, "with a ? beside it");
}

// 3. the ? opens the reason as its own message, and closes again
{
  portals.length = 0;
  const el = mountTracked(PROJECTIONS(viewOf([foldedRow(0, 100, 400)], [])));
  const help = helpOf(el);
  assert(help !== null && help.type === "button" && help.props["aria-expanded"] === false, "the ? is a closed button");
  assert(whyCardOf() === null, "nothing is portalled before it is asked for");
  help.props.onClick();
  const open = rerender();
  assert(helpOf(open).props["aria-expanded"] === true, "clicking it opens the explanation");
  const card = whyCardOf();
  assert(card !== null && textOf(card).includes(L.whyOne) && textOf(card).includes(L.whyTwo), "the message explains why and how, got: " + textOf(card));
  assert(flatten(card.kids).filter((kid) => kid.type === "p").length === 2, "in two paragraphs");
  assert(!textOf(panelOf(open)).includes(L.whyTwo), "without padding the panel itself");
  helpOf(open).props.onClick();
  portals.length = 0;
  rerender();
  assert(whyCardOf() === null, "clicking it again closes the message");
}

// 4. the overview computes the scope from what the fold actually holds
{
  const whole = mountTracked(PROJECTIONS(viewOf([reportedRow(0, 300, 500)], ["a/one"])));
  assert(textOf(whole).includes(L.scopeWhole(1)), "a complete session says so, with its turn count, got: " + textOf(whole));
  assert(scopeHelpOf(whole) === null, "and a complete count needs no ? to explain itself");
  const own = mountTracked(PROJECTIONS(viewOf([reportedRow(0, 300, 500)], ["a/one"], { whole: false })));
  assert(textOf(own).includes(L.scopeOwn(1)), "a forked session says the scope excludes inherited history, got: " + textOf(own));
  assert(scopeHelpOf(own) !== null, "and carries a ? for the reason");
}

// 5. a scope that is not the whole session states why, from the same ? mechanism
{
  // Two started turns, one of which never produced a reply: the fold counts both, has
  // figures for one.
  const gaps = mountTracked(PROJECTIONS(viewOf([reportedRow(1, 300, 500, 0)], ["a/one"], { turnCount: 3, settledTurns: 1 })));
  assert(textOf(gaps).includes(L.scopeGap(3, 2)), "the gap is stated with its size, got: " + textOf(gaps));
  const help = scopeHelpOf(gaps);
  assert(help !== null && help.type === "button" && help.props["aria-expanded"] === false, "with a ? beside it");
  portals.length = 0;
  help.props.onClick();
  const card = whyCardOf(rerender());
  assert(card !== null && textOf(card).includes(L.scopeWhyTitle), "which opens a message titled for the scope, got: " + textOf(card));
  assert(textOf(card).includes(L.whyGap(2)), "and explains the missing turns, got: " + textOf(card));
  // The same panel can hold more than one reason at once.
  portals.length = 0;
  const both = mountTracked(PROJECTIONS(viewOf([reportedRow(1, 300, 500, 0)], ["a/one"], { turnCount: 3, settledTurns: 1, whole: false })));
  assert(textOf(both).includes(L.scopeOwn(3)), "a forked session with gaps prefers the fork wording, got: " + textOf(both));
  scopeHelpOf(both).props.onClick();
  const bothCard = whyCardOf(rerender());
  assert(textOf(bothCard).includes(L.whyOwn) && textOf(bothCard).includes(L.whyGap(2)), "and lists both reasons, got: " + textOf(bothCard));
}

// 5d. the explanation card is measured, placed beside the panel, and kept on screen
{
  // The case that broke: a panel low in a short window and a card of real prose. With a
  // fixed height guess the card was placed as if it were 190px tall and its last lines ran
  // off the bottom of the window.
  const projections = PROJECTIONS(viewOf([foldedRow(0, 100, 400)], []));
  layout.cardHeight = 300;
  layout.panel = { left: 320, top: 600, right: 820, bottom: 700 };
  layout.viewport = { width: 1280, height: 720 };
  const el = mountTracked(projections);
  helpOf(el).props.onClick();
  // First commit renders the card hidden at its final width, second measures it and places
  // it; the third shows the placement the tests read.
  rerender();
  rerender();
  portals.length = 0;
  rerender();
  const style = whyCardOf().props.style;
  assert(style.width === WHY_TEST_WIDTH, "the card is laid out at its own width, got: " + style.width);
  assert(style.top + layout.cardHeight <= layout.viewport.height - 12, "and its last line stays inside the window, got top " + style.top);
  assert(style.top === 720 - 12 - 300, "placed by its measured height, not by a guess, got: " + style.top);
  assert(style.left === 828, "with room to the right, it sits to the right of the panel, got: " + style.left);
  // A settled placement must not schedule another render, or the card re-places forever.
  portals.length = 0;
  rerender();
  assert(whyCardOf().props.style === style, "and a placement that has not changed is reused rather than recomputed");
  // No room on the right: the card goes to the panel's other side instead, still on screen.
  layout.panel = { left: 900, top: 300, right: 1240, bottom: 640 };
  rerender();
  portals.length = 0;
  rerender();
  const left = whyCardOf().props.style;
  assert(left.left === 612, "with no room to the right, it moves to the left, got: " + left.left);
  assert(left.left + left.width <= layout.viewport.width - 12, "and still fits inside the window");
  layout.panel = { left: 320, top: 300, right: 820, bottom: 640 };
  layout.cardHeight = 190;
  layout.viewport = { width: 1280, height: 720 };
}

// 5e. the ? closing a footnote keeps its own space
{
  const el = mountTracked(PROJECTIONS(viewOf([reportedRow(1, 300, 500, 0)], ["a/one"], { turnCount: 3, settledTurns: 1 })));
  const help = scopeHelpOf(el);
  assert(help !== null, "the scope footnote carries a ?");
  const scope = findClass(el, "dsh-tstat-scope");
  assert(textOf(scope).endsWith("?"), "which follows the sentence, got: " + textOf(scope));
  const rule = /\.dsh-tstat-scope \.dsh-tstat-help\{([^}]*)\}/.exec(SRC);
  assert(rule !== null && /margin-left:\s*[1-9]/.test(rule[1]), "and is spaced away from the full stop it would otherwise touch");
}

// 5b. the list cap is explained the same way, and the estimate's ? stays separate
{
  const rows = [];
  for (let turn = 0; turn < 5; turn += 1) rows.push(reportedRow(turn, 10, 20, 0));
  const el = mountTracked(PROJECTIONS(viewOf(rows.slice(-2), ["a/one"], { turnCount: 5 })));
  assert(textOf(el).includes(L.capped(2)), "the cap is stated, got: " + textOf(el));
  const capHelp = capHelpOf(el);
  assert(capHelp !== null, "with its own ?");
  portals.length = 0;
  capHelp.props.onClick();
  const card = whyCardOf(rerender());
  assert(card !== null && textOf(card).includes(L.capWhyTitle) && textOf(card).includes(L.whyCapped(2)), "which explains the cap, got: " + textOf(card));
  // One card at a time, and each ? toggles its own.
  portals.length = 0;
  const gapEl = mountTracked(PROJECTIONS(viewOf([reportedRow(1, 300, 500, 0)], ["a/one"], { turnCount: 3, settledTurns: 1 })));
  scopeHelpOf(gapEl).props.onClick();
  assert(textOf(whyCardOf(rerender())).includes(L.whyGap(2)), "the scope reason opens");
  scopeHelpOf(rerender()).props.onClick();
  // The portal recorder is append-only, so it is cleared after the click to observe
  // what the next render actually portals.
  portals.length = 0;
  assert(whyCardOf(rerender()) === null, "and clicking its ? again closes it");
}

// 6. the per-turn table lists one row per published turn, newest first
{
  const el = mountTracked(PROJECTIONS(viewOf([reportedRow(0, 300, 500, 0), reportedRow(1, 200, 400, 0)], ["a/one"])), "turns");
  const rows = turnRowsOf(el);
  assert(rows.length === 2, "one row per turn, got: " + rows.length);
  assert(rows[0].props["data-turn"] === 1 && rows[1].props["data-turn"] === 0, "newest first");
  assert(textOf(rows[0]).includes("200") && textOf(rows[0]).includes("400"), "the row carries thinking and output");
  assert(textOf(rows[0]).includes(L.srcReported), "and where the figure came from");
  assert(textOf(el).includes(L.turnsTitle), "the panel is titled as the per-turn view");
}

// 7. the table's header and every row agree on the columns
{
  const el = mountTracked(PROJECTIONS(viewOf([reportedRow(0, 300, 500, 0)], ["a/one"])), "turns");
  const head = headCellsOf(el);
  const labels = flatten(head.map((cell) => (cell.kids === undefined ? cell : cell.kids))).map((cell) => textOf(cell)).join("|");
  for (const key of ["colTurn", "colThinking", "colOutput", "colSource", "colModel", "colShare"]) {
    assert(labels.includes(L[key]), "the header names the " + key + " column, got: " + labels);
  }
  assert(turnRowsOf(el)[0].kids.length === head.length, "every row has as many cells as the header");
}

// 7b. no header label may wrap or be cut off, in either language
{
  const el = mountTracked(PROJECTIONS(viewOf([reportedRow(0, 300, 500, 0)], ["a/one"])), "turns");
  const head = headCellsOf(el);
  // `Thinking source` and `Of output` used to be truncated and wrapped respectively: the
  // English labels are longer than the Chinese ones, and the columns were sized for the
  // Chinese. Every header cell is now nowrap, and the two longest columns were widened to
  // what those labels measure at 11px in the interface font.
  const headRule = /\.dsh-tstat-head\{([^}]*)\}/.exec(SRC);
  assert(headRule !== null && headRule[1].includes("white-space:nowrap"), "no header label wraps");
  for (const cell of head) {
    const className = cell.props.className;
    if (typeof className !== "string") continue;
    const rule = new RegExp("\\." + className + "\\{([^}]*)\\}").exec(SRC);
    assert(rule !== null && rule[1].includes("white-space:nowrap"), "and no head cell can wrap either: " + className);
  }
  const tracks = /\.dsh-tstat-grid\{grid-template-columns:([^;]+);/.exec(SRC)[1].trim().split(/\s+/);
  assert(tracks.length === 7, "the table keeps seven columns, got: " + tracks.length);
  assert(parseInt(tracks[3], 10) >= 80, "the source column holds \"Thinking source\", got: " + tracks[3]);
  assert(parseInt(tracks[5], 10) >= 50, "the share column holds \"Of output\", got: " + tracks[5]);
}

// 8. an estimated turn marks its thinking blue and its share, and carries the ~
{
  const el = mountTracked(PROJECTIONS(viewOf([foldedRow(0, 100, 400)], [])), "turns");
  const row = turnRowsOf(el)[0];
  assert(row.props["data-src"] === "folded", "the row says its figure is text-derived");
  assert(textOf(cellOf(row, "dsh-tstat-turn-val")) === "~100", "the thinking cell carries the mark, got: " + textOf(cellOf(row, "dsh-tstat-turn-val")));
  assert(textOf(cellOf(row, "dsh-tstat-turn-share")) === "~25.0%", "and so does the share cell, got: " + textOf(cellOf(row, "dsh-tstat-turn-share")));
  const css = new Function("window", "document", "require", SRC);
  assert(SRC.includes("[data-src=folded] .dsh-tstat-turn-val"), "and the estimated row styles that cell as a business figure");
  assert(textOf(cellOf(row, "dsh-tstat-turn-val")).startsWith("~"), "the mark comes first");
  // The line above the table restates the session total, and that total rests on the
  // fold whenever any row does — so it carries the mark too, exactly as the overview's
  // headline does.
  const coverage = coverageOf(el);
  assert(coverage !== null && textOf(coverage).includes("~100 " + L.tokens), "the table's total is marked, got: " + textOf(coverage));
}

// 9. a reported turn carries no mark at all
{
  const el = mountTracked(PROJECTIONS(viewOf([reportedRow(0, 300, 500, 0)], ["a/one"])), "turns");
  const row = turnRowsOf(el)[0];
  assert(row.props["data-src"] === "reported", "the row says the provider reported it");
  assert(!textOf(cellOf(row, "dsh-tstat-turn-val")).includes("~"), "with no estimate mark");
  assert(textOf(cellOf(row, "dsh-tstat-turn-share")) === "60.0%", "and an exact share, got: " + textOf(cellOf(row, "dsh-tstat-turn-share")));
  assert(!textOf(coverageOf(el)).includes("~"), "and the table's total stays unmarked, got: " + textOf(coverageOf(el)));
}

// 10. the model column resolves the row's dictionary references
{
  const el = mountTracked(PROJECTIONS(viewOf([reportedRow(0, 300, 500, 1), reportedRow(1, 200, 400, 0)], ["cpa/qwen3.8-27b", "deepseek-official/deepseek-flash"])), "turns");
  const rows = turnRowsOf(el);
  assert(textOf(cellOf(rows[0], "dsh-tstat-turn-model")) === "cpa/qwen3.8-27b", "the newest row names its own model");
  assert(textOf(cellOf(rows[1], "dsh-tstat-turn-model")) === "deepseek-official/deepseek-flash", "and so does the older one");
  const unknown = mountTracked(PROJECTIONS(viewOf([reportedRow(0, 300, 500)], [])), "turns");
  assert(textOf(cellOf(turnRowsOf(unknown)[0], "dsh-tstat-turn-model")) === "—", "a row without a route states nothing rather than guessing");
}

// 11. the filters describe and select the three sources
{
  const rows = [reportedRow(0, 300, 500, 0), foldedRow(1, 100, 400), [2, 0, 0, 0, 400, []]];
  const el = mountTracked(PROJECTIONS(viewOf(rows, ["a/one"])), "turns");
  const filters = filtersOf(el);
  assert(filters.length === 3, "three source filters, got: " + filters.length);
  const byLabel = (text) => filters.find((chip) => textOf(chip).includes(text));
  assert(byLabel(L.srcReported).props["aria-pressed"] === true, "reported turns are shown");
  assert(byLabel(L.srcFolded).props["aria-pressed"] === true, "text-derived turns are shown");
  assert(byLabel(L.srcNone).props["aria-pressed"] === false, "turns with no figure start hidden");
  assert(byLabel(L.srcNone).props["data-count"] === "1", "the filter counts what it would reveal");
  assert(turnRowsOf(el).length === 2, "so the third turn is not listed, got: " + turnRowsOf(el).length);
  assert(textOf(cellOf(turnRowsOf(el)[0], "dsh-tstat-turn-src")) === L.srcFolded, "and each listed row is labelled");
}

// 12. every row offers a jump, and a turn the window no longer holds is a no-op
{
  const el = mountTracked(PROJECTIONS(viewOf([reportedRow(0, 300, 500, 0)], ["a/one"])), "turns");
  const jump = cellOf(turnRowsOf(el)[0], "dsh-tstat-jump");
  assert(jump !== undefined && jump.type === "button", "the row offers a jump control");
  assert(typeof jump.props.onClick === "function", "which is clickable");
  assert(jump.props.onClick() === undefined, "and does nothing when the turn is not in the document");
}

// 13. a long table is paged, and only the page in view is rendered
{
  const rows = [];
  for (let turn = 0; turn < 250; turn += 1) rows.push(reportedRow(turn, 10, 20, 0));
  const el = mountTracked(PROJECTIONS(viewOf(rows, ["a/one"])), "turns");
  assert(turnRowsOf(el).length === 100, "one page is rendered, got: " + turnRowsOf(el).length);
  assert(turnRowsOf(el)[0].props["data-turn"] === 249, "starting at the newest turn");
  const [newer, older] = pagerButtonsOf(el);
  assert(textOf(pagerOf(el)).includes(L.pageOf(1, 3)), "the pager states the page, got: " + textOf(pagerOf(el)));
  assert(newer.props.disabled === true && older.props.disabled === false, "the newest page can only go older");
  older.props.onClick();
  const second = rerender();
  assert(turnRowsOf(second).length === 100, "the next page renders its own rows");
  assert(turnRowsOf(second)[0].props["data-turn"] === 149, "continuing where the first stopped, got: " + turnRowsOf(second)[0].props["data-turn"]);
  pagerButtonsOf(second)[1].props.onClick();
  const third = rerender();
  assert(turnRowsOf(third).length === 50, "the last page renders the remainder, got: " + turnRowsOf(third).length);
  assert(pagerButtonsOf(third)[1].props.disabled === true, "and cannot go older");
}

// 14. a session with no thinking shows nothing at all
{
  assert(mountTracked(PROJECTIONS(viewOf([], [], { turnCount: 0 }))) === null, "an empty projection renders nothing");
  assert(mountTracked({}) === null, "so does a host that publishes no projections");
}

// 15. a host without the projection falls back to the durable totals, and says so
{
  const el = mountTracked({ tokenUsage: { reasoningTokens: 900, outputTokens: 2000 }, sessionStats: { turns: 4 } });
  assert(el !== null, "the readout still appears");
  assert(textOf(el).includes("900"), "carrying the durable reasoning total, got: " + textOf(el));
  assert(textOf(el).includes(L.scopeTotals), "and its scope says there are no per-turn figures, got: " + textOf(el));
  assert(scopeHelpOf(el) !== null, "with a ? for the reason");
  portals.length = 0;
  scopeHelpOf(el).props.onClick();
  assert(textOf(whyCardOf(rerender())).includes(L.whyDurable), "which explains that the host publishes no projection");
  const table = mountTracked({ tokenUsage: { reasoningTokens: 900, outputTokens: 2000 }, sessionStats: { turns: 4 } }, "turns");
  assert(turnRowsOf(table) === null, "with no per-turn list to invent");
  assert(textOf(table).includes(L.durableOnly), "and the table says why, got: " + textOf(table));
}

// 5c. the explanation closes on a click anywhere else, including inside the panel —
//     moving from the overview to the table must not carry it along
{
  const listeners = { pointerdown: [], keydown: [] };
  const savedAdd = documentStub.addEventListener;
  const savedRemove = documentStub.removeEventListener;
  documentStub.addEventListener = (type, handler) => { if (listeners[type] !== undefined) listeners[type].push(handler); };
  documentStub.removeEventListener = (type, handler) => {
    if (listeners[type] === undefined) return;
    listeners[type] = listeners[type].filter((entry) => entry !== handler);
  };
  // The plugin classifies a press by what it landed on, which a bare stub object answers
  // honestly: the panel is inside, a press on the page is not.
  const press = (target) => {
    for (const handler of [...listeners.pointerdown]) handler({ target });
  };
  const inPanel = { closest: (selector) => (selector.includes("data-thinking-panel") ? {} : null) };
  const onPage = { closest: () => null };
  // A real `?` is inside the panel *and* marked as a trigger, so it answers both.
  const onTrigger = { closest: (selector) => (selector.includes("data-thinking-panel") || selector === "[data-explain]" ? {} : null) };
  const projections = PROJECTIONS(viewOf([foldedRow(0, 100, 400)], []));
  const el = mountTracked(projections);
  helpOf(el).props.onClick();
  assert(whyCardOf(rerender()) !== null, "the estimate's explanation is open");
  press(inPanel);
  portals.length = 0;
  rerender();
  assert(whyCardOf() === null, "a press on the panel closes the message but not the panel");
  assert(panelOf(rerender()) !== null, "the panel is still open");
  // Reopening and pressing the trigger leaves it to the trigger's own click to toggle:
  // the pointerdown must not pre-close what the click is about to reopen.
  helpOf(rerender()).props.onClick();
  portals.length = 0;
  rerender();
  assert(whyCardOf() !== null, "the message reopens");
  press(onTrigger);
  rerender();
  assert(whyCardOf() !== null, "a press on the ? itself is left for the ? to toggle");
  assert(helpOf(rerender()).props["data-explain"] === "estimate", "and the trigger is marked with the explanation it owns");
  // Following the door into the per-turn table leaves no message behind.
  const moreRow = detailsKidsOf(rerender()).find((kid) => kid.props.className === "dsh-tstat-more-row");
  press(inPanel);
  moreRow.kids.find((kid) => kid.type === "button").props.onClick();
  portals.length = 0;
  assert(whyCardOf(rerender()) === null, "and opening the per-turn table carries no message across");
  assert(textOf(panelOf(rerender())).includes(L.turnsTitle), "the table is open on its own");
  // A press on the page closes the panel, and with it the message.
  press(onPage);
  portals.length = 0;
  assert(panelOf(rerender()) === null, "a press on the page closes the panel");
  documentStub.addEventListener = savedAdd;
  documentStub.removeEventListener = savedRemove;
}

// 16. the panel closes from anywhere, from either level, not only from its own trigger
{
  const listeners = { pointerdown: [], keydown: [] };
  const captures = [];
  const savedAdd = documentStub.addEventListener;
  const savedRemove = documentStub.removeEventListener;
  documentStub.addEventListener = (type, handler, capture) => {
    if (listeners[type] === undefined) return;
    listeners[type].push(handler);
    if (type === "pointerdown") captures.push(capture === true);
  };
  documentStub.removeEventListener = (type, handler) => {
    if (listeners[type] === undefined) return;
    listeners[type] = listeners[type].filter((entry) => entry !== handler);
  };
  const projections = PROJECTIONS(viewOf([reportedRow(0, 300, 500, 0)], ["a/one"]));
  const el = mountTracked(projections);
  assert(panelOf(el) !== null, "the overview is open");
  assert(listeners.pointerdown.length > 0, "an outside-pointer listener is installed while open");
  // Capture phase, so a component that stops pointer propagation cannot swallow it —
  // which is how the shipped bubble-phase hook loses dismissals in this app.
  assert(captures.every((capture) => capture === true), "and it listens in the capture phase");
  for (const handler of [...listeners.pointerdown]) handler({ target: {} });
  assert(panelOf(rerender()) === null, "a pointer anywhere else closes the overview");
  const table = mountTracked(projections, "turns");
  assert(panelOf(table) !== null, "the per-turn table is open");
  for (const handler of [...listeners.keydown]) handler({ key: "Escape" });
  assert(panelOf(rerender()) === null, "Escape closes the per-turn table too");
  documentStub.addEventListener = savedAdd;
  documentStub.removeEventListener = savedRemove;
}

// 17. the pill itself toggles, and the overview's own row opens the table
{
  const projections = PROJECTIONS(viewOf([reportedRow(0, 300, 500, 0)], ["a/one"]));
  const el = mountTracked(projections);
  const moreRow = detailsKidsOf(el).find((kid) => kid.props.className === "dsh-tstat-more-row");
  const more = moreRow.kids.find((kid) => kid.type === "button");
  assert(textOf(more).includes(L.more), "the overview offers the per-turn view, got: " + textOf(more));
  more.props.onClick();
  assert(textOf(rerender()).includes(L.turnsTitle), "and opening it shows the table");
}

// 18. only Chinese is Chinese — every other language, and none at all, reads English
{
  const saved = documentStub.documentElement.lang;
  const projections = PROJECTIONS(viewOf([reportedRow(0, 300, 500, 0)], ["a/one"]));
  const cases = [
    ["zh", true],
    ["zh-CN", true],
    ["zh-Hans-CN", true],
    ["ZH-tw", true],
    ["en", false],
    ["en-US", false],
    ["ja", false],
    ["de-DE", false],
    // A tag that merely starts with the same two letters is not Chinese.
    ["zhx", false],
    // A document whose locale service has not published yet.
    ["", false]
  ];
  for (const [lang, chinese] of cases) {
    documentStub.documentElement.lang = lang;
    const txt = textOf(mountTracked(projections));
    assert(
      txt.includes(chinese ? "本次会话思考 token" : "Thinking tokens (session)"),
      'lang "' + lang + '" reads ' + (chinese ? "Chinese" : "English") + ", got: " + txt
    );
  }
  documentStub.documentElement.lang = saved;
}

console.log(`All ${pass} assertions passed.`);
