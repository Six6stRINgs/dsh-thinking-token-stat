import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

// ── minimal React + Tooltip stubs ───────────────────────────────────────
function render(node) {
  if (node === null || node === undefined) return null;
  if (node === false || node === true) return node;
  if (Array.isArray(node)) return node.map(render).filter(Boolean);
  if (typeof node === "string" || typeof node === "number") return String(node);
  const { type, props, children } = node;
  const kids = render(children).filter(Boolean);
  return { type, props, kids };
}
function textOf(el) {
  if (el === null || el === undefined) return null;
  if (typeof el === "string" || typeof el === "number") return String(el);
  if (Array.isArray(el)) return el.filter(Boolean).map(textOf).join(" ");
  if (Array.isArray(el.kids)) return el.kids.filter(Boolean).map(textOf).join(" ");
  return textOf(el.kids);
}
const react = {
  memo: (c) => c,
  useMemo: (fn) => fn(),
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
};
// Tooltip mock: expose the label so tests can assert on it.
const TooltipMock = (props) => ({ type: "Tooltip", props });

const requireMock = {
  react,
  "@deepseek-ai/dsh-client-ui-primitives": { Tooltip: TooltipMock },
};

// ── stub the AMD loader + require, run the factory ─────────────────────
let captured = null;
const fakeWindow = { __ModuleLoader__: { load: (obj) => { captured = obj; } } };
const documentStub = {
  querySelector: () => null,
  createElement: () => ({ setAttribute: () => {}, textContent: "" }),
  head: { appendChild: () => {} },
};
new Function("window", "document", "require", SRC)(
  fakeWindow,
  documentStub,
  (spec) => requireMock[spec],
);
if (!captured || !captured.factory) throw new Error("factory not captured");
const mod = captured.factory((spec) => requireMock[spec]);

// ── stub ctx.slots, run apply, capture registrations ───────────────────
const registrations = [];
const ctx = {
  slots: {
    inject: (name, cb) => { cb(); },
    register: (opts, component) => { registrations.push({ opts, component }); },
  },
};
mod.apply(ctx);

function findReg(name) { return registrations.find((r) => r.opts.name === name); }
const dockReg = findReg("conversation.composer.dock");
const turnReg = findReg("conversation.chat.assistant-actions");
if (!dockReg) throw new Error("composer.dock not registered");
if (!turnReg) throw new Error("assistant-actions not registered");

// ── sample data ────────────────────────────────────────────────────────
const asst = (messageId, usage, blocks, turn) => ({ kind: "assistant", messageId, turn, usage, blocks: blocks || [] });

const nodesProvider = [
  asst("m1", { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 300 }, [], 0),
  asst("m2", { inputTokens: 1000, outputTokens: 400, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 200 }, [], 1),
];
const nodesBlocks = [
  asst("m3", { inputTokens: 1000, outputTokens: 400 }, [{ kind: "reasoning", text: "x".repeat(400) }], 0),
];
const nodesNone = [
  asst("m4", { inputTokens: 1000, outputTokens: 400 }, [{ kind: "text", text: "hello" }], 0),
];
const snapshot = (nodes) => ({ legacy: { nodes } });
function useChatFor(nodes) { return (selector) => selector(snapshot(nodes)); }

let pass = 0;
function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// 1. dock renders session totals (provider-reported path) + uses Tooltip
{
  const el = render(dockReg.component({ useChat: useChatFor(nodesProvider) }));
  const txt = textOf(el);
  assert(el !== null && el.type === TooltipMock, "dock wraps readout in Tooltip");
  assert(txt.includes("500"), "dock thinking total 500, got: " + txt);
  assert(txt.includes("17.2%"), "dock thinking/total 17.2% (500/2900), got: " + txt);
  assert(txt.includes("55.6%"), "dock thinking/output 55.6% (500/900), got: " + txt);
  assert(el.props.label.includes("Thinking tokens (session): 500"), "dock tooltip label, got: " + el.props.label);
}
// 2. dock block-estimate path: 400 chars / 4 = 100 thinking
{
  const el = render(dockReg.component({ useChat: useChatFor(nodesBlocks) }));
  const txt = textOf(el);
  assert(txt.includes("100"), "dock block-estimate 100, got: " + txt);
}
// 3. dock hidden when no thinking
{
  const el = render(dockReg.component({ useChat: useChatFor(nodesNone) }));
  assert(el === null, "dock renders null when no thinking");
}
// 4. per-turn (assistant-actions) via messageId → aggregates its turn
{
  const el = render(turnReg.component({ messageId: "m1", useChat: useChatFor(nodesProvider) }));
  const txt = textOf(el);
  assert(el !== null && el.props.className === "dsh-ttail-wrap", "per-turn renders the native detail-panel wrapper");
  assert(txt.includes("300"), "per-turn thinking 300 for m1, got: " + txt);
  assert(txt.includes("Thinking tokens this turn"), "per-turn detail panel title, got: " + txt);
  assert(txt.includes("Thinking / all tokens"), "per-turn all-token detail, got: " + txt);
}
// 5. per-turn aggregates the whole turn (two steps same turn)
{
  const two = [
    asst("a1", { inputTokens: 1000, outputTokens: 500, reasoningTokens: 300 }, [], 0),
    asst("a2", { inputTokens: 1000, outputTokens: 500, reasoningTokens: 300 }, [], 0),
  ];
  const el = render(turnReg.component({ messageId: "a1", useChat: useChatFor(two) }));
  const txt = textOf(el);
  assert(txt.includes("600"), "per-turn sums both steps in turn → 600, got: " + txt);
}
// 6. per-turn hidden when that turn has no thinking
{
  const el = render(turnReg.component({ messageId: "m4", useChat: useChatFor(nodesNone) }));
  assert(el === null, "per-turn renders null when that turn has no thinking");
}
// 7. per-turn hidden when messageId unknown
{
  const el = render(turnReg.component({ messageId: "nope", useChat: useChatFor(nodesProvider) }));
  assert(el === null, "per-turn renders null for unknown messageId");
}
// 8. formatting sanity
{
  const el = render(dockReg.component({ useChat: useChatFor([
    asst("big", { inputTokens: 10000, outputTokens: 12000, reasoningTokens: 9876 }, [], 0),
  ]) }));
  const txt = textOf(el);
  assert(txt.includes("9.9K"), "formatTokens 9876 → 9.9K, got: " + txt);
}
// 9. small percentage keeps one decimal (regression: was "0%")
{
  // thinking 15 over total 8725 → 0.17% ; output 25 → 60.0%
  const el = render(dockReg.component({ useChat: useChatFor([
    asst("s", { inputTokens: 8700, outputTokens: 25, reasoningTokens: 15 }, [], 0),
  ]) }));
  const txt = textOf(el);
  assert(txt.includes("0.2%"), "small pct 15/8725 → 0.2% (not 0%), got: " + txt);
  assert(txt.includes("60.0%"), "60% shown with one decimal, got: " + txt);
}

console.log(`All ${pass} assertions passed.`);
