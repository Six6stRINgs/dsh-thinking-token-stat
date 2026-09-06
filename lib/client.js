window.__ModuleLoader__.load({
	id: "dsh-thinking-token-stat",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const Tooltip = primitives.Tooltip;
		const h = react.createElement;

		//#region styles
		// Injected once at module load (guarded), matching how shipped client
		// bundles mount their CSS. Theme tokens adapt to light/dark automatically.
		const CSS = [
			// Session dock readout (composer dock).
			".dsh-tdock{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-tertiary);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1}",
			".dsh-ttail-wrap{display:inline-flex;position:relative;order:999}",
			".dsh-ttail{min-width:0;height:calc(28px + var(--dsh-content-font-delta,0px));box-sizing:border-box;color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);font-variant-numeric:tabular-nums;line-height:calc(24px + var(--dsh-content-font-delta,0px));white-space:nowrap;border:0;border-radius:28px;align-items:center;gap:4px;padding:6px 8px;display:inline-flex;cursor:pointer;background:transparent;font-family:inherit}",
			".dsh-ttail:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
			".dsh-ttail svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px));flex:none}",
			".dsh-ttail-panel{z-index:1100;box-sizing:border-box;background:var(--dsw-specific-menu);color:var(--dsw-alias-label-secondary);width:max-content;min-width:min(300px,calc(100vw - 24px));max-width:min(440px,calc(100vw - 24px));box-shadow:var(--dsw-elevation-prominent);border:0;border-radius:12px;padding:16px;font-size:12px;line-height:18px;position:absolute;right:0;bottom:calc(100% + 8px);display:none}",
			".dsh-ttail-wrap:hover .dsh-ttail-panel,.dsh-ttail-wrap:focus-within .dsh-ttail-panel{display:block}",
			".dsh-ttail-title{color:var(--dsw-alias-label-primary);justify-content:space-between;gap:16px;margin-bottom:8px;font-weight:500;display:flex}",
			".dsh-ttail-title-label{align-items:center;gap:6px;display:inline-flex}",
			".dsh-ttail-title-label svg{width:14px;height:14px;flex:none}",
			".dsh-ttail-title-value{font-variant-numeric:tabular-nums}",
			".dsh-ttail-rule{border-top:.5px solid var(--dsw-alias-border-l2);margin-bottom:10px}",
			".dsh-ttail-details{color:var(--dsw-alias-label-tertiary);grid-template-columns:minmax(110px,auto) minmax(0,1fr);column-gap:20px;row-gap:6px;margin:0;display:grid}",
			".dsh-ttail-details dt,.dsh-ttail-details dd{margin:0}",
			".dsh-ttail-details dd{text-align:right;font-variant-numeric:tabular-nums}"
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
		// The model's "thinking" is the reasoning part of its output. Counted
		// per assistant message, then aggregated:
		//   1. provider-reported usage.reasoningTokens, when present (exact);
		//   2. otherwise a fixed-density estimate from the reasoning blocks
		//      (four characters per token, the harness heuristic).
		// Every figure derives from the SAME assistant nodes so the count and its
		// denominators always agree on one consistent scope.

		/** Four characters per token — the harness' fixed estimator density. */
		const CHARS_PER_TOKEN = 4;

		function num(v) {
			return typeof v === "number" && isFinite(v) ? v : 0;
		}

		/** All billed tokens of one usage sample (disjoint buckets). */
		function usageAll(usage) {
			if (!usage || typeof usage !== "object") return 0;
			return num(usage.inputTokens) + num(usage.outputTokens) + num(usage.cacheReadTokens) + num(usage.cacheWriteTokens);
		}

		/** Output tokens of one usage sample. */
		function usageOutput(usage) {
			if (!usage || typeof usage !== "object") return 0;
			return num(usage.outputTokens);
		}

		/** Thinking tokens for one assistant node. */
		function thinkingFromNode(node) {
			if (!node || node.kind !== "assistant") return 0;
			const reported = num(node.usage && node.usage.reasoningTokens);
			if (reported > 0) return reported;
			let chars = 0;
			const blocks = node.blocks || [];
			for (const b of blocks) {
				if (b && b.kind === "reasoning" && typeof b.text === "string") chars += b.text.length;
			}
			return chars > 0 ? Math.ceil(chars / CHARS_PER_TOKEN) : 0;
		}

		/** Sum thinking tokens and denominators over a set of conversation nodes. */
		function aggregate(nodes) {
			let thinking = 0;
			let total = 0;
			let output = 0;
			for (const node of nodes) {
				if (!node || node.kind !== "assistant") continue;
				thinking += thinkingFromNode(node);
				total += usageAll(node.usage);
				output += usageOutput(node.usage);
			}
			return { thinking, total, output };
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
			return (v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, ""));
		}
		/** Percentage of part over whole (one decimal place), or null when whole is not positive. */
		function pct(part, whole) {
			if (!whole || whole <= 0) return null;
			return ((part / whole) * 100).toFixed(1) + "%";
		}
		/** The exact figures shown in the hover tooltip. */
		function detailLabel(stats, scope) {
			const totalPct = pct(stats.thinking, stats.total);
			const outputPct = pct(stats.thinking, stats.output);
			return (
				(scope === "turn" ? "Thinking tokens this turn: " : "Thinking tokens (session): ") +
				stats.thinking +
				(totalPct !== null ? " · " + totalPct + " of all tokens" : "") +
				(outputPct !== null ? " · " + outputPct + " of output tokens" : "")
			);
		}
		//#endregion

		//#region components
		/**
		 * Bottom-dock readout: the whole session's cumulative thinking tokens
		 * plus its share of all tokens and of output tokens. Hidden until the
		 * model has produced some thinking. Hover shows the exact figures.
		 */
		const EMPTY_NODES = Object.freeze([]);
		const ThinkingStatsDock = react.memo(function ThinkingStatsDock({ useChat }) {
			const nodes = useChat((s) => (s.legacy && s.legacy.nodes) || EMPTY_NODES);
			const stats = react.useMemo(() => aggregate(nodes), [nodes]);
			if (stats.thinking <= 0) return null;
			const totalPct = pct(stats.thinking, stats.total);
			const outputPct = pct(stats.thinking, stats.output);
			const text = ["💭 " + formatTokens(stats.thinking)];
			if (totalPct !== null) text.push(totalPct);
			if (outputPct !== null) text.push(outputPct);
			return h(Tooltip, { label: detailLabel(stats, "session"), side: "top" },
				h("span", { className: "dsh-tdock", "data-thinking-dock": true }, text.join(" · ")));
		});

		/**
		 * Per-turn readout appended to the per-message actions row (the timing
		 * strip), so it reads as part of that same unit. Hidden until that turn
		 * produced thinking; hover shows the exact figures.
		 */
		const ThinkingTurnTail = react.memo(function ThinkingTurnTail({ messageId, useChat }) {
			const nodes = useChat((s) => (s.legacy && s.legacy.nodes) || EMPTY_NODES);
			const stats = react.useMemo(() => {
				const node = nodes.find((n) => n.kind === "assistant" && n.messageId === messageId);
				if (!node) return null;
				const turn = node.turn;
				return aggregate(nodes.filter((n) => n.kind === "assistant" && n.turn === turn));
			}, [nodes, messageId]);
			if (!stats || stats.thinking <= 0) return null;
			const totalPct = pct(stats.thinking, stats.total);
			const outputPct = pct(stats.thinking, stats.output);
			const text = [formatTokens(stats.thinking)];
			if (totalPct !== null) text.push(totalPct);
			if (outputPct !== null) text.push(outputPct);
			return h("span", { className: "dsh-ttail-wrap", "data-thinking-tail": true },
				h("button", { type: "button", className: "dsh-ttail", "aria-label": detailLabel(stats, "turn") },
					h("svg", { viewBox: "0 0 16 16", "aria-hidden": true, children: h("path", { d: "M5.05 11.75a3.7 3.7 0 0 1-.8-7.31 4.3 4.3 0 0 1 8.2 1.13A3.2 3.2 0 0 1 12 11.9c-.75 0-1.45-.2-2.05-.57a3.7 3.7 0 0 1-4.9.42ZM4.2 13.2a1.1 1.1 0 0 0 1.1-1.1v-.1H4.2a1.1 1.1 0 0 0 0 2.2v-1Z", fill: "currentColor" }) }),
					text.join(" · ")),
				h("div", { className: "dsh-ttail-panel", role: "dialog", "aria-label": detailLabel(stats, "turn") },
					h("div", { className: "dsh-ttail-title" },
						h("span", { className: "dsh-ttail-title-label" }, "Thinking tokens this turn"),
						h("span", { className: "dsh-ttail-title-value" }, formatTokens(stats.thinking) + " tok")),
					h("div", { className: "dsh-ttail-rule", "aria-hidden": true }),
					h("dl", { className: "dsh-ttail-details" },
						h("dt", null, "Thinking / all tokens"), h("dd", null, totalPct || "—"),
						h("dt", null, "Thinking / output"), h("dd", null, outputPct || "—"))));
		});
		//#endregion

		/**
		 * Client plugin body: register the session dock readout and the
		 * per-turn readout in the per-message actions row.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "thinking-stats",
				order: 100
			}, ThinkingStatsDock));
			ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
				name: "conversation.chat.assistant-actions",
				id: "thinking-stats",
				order: 100
			}, ThinkingTurnTail));
		}

		exports.apply = apply;
		exports.inject = ["slots"];
		return module.exports;
	}
});
