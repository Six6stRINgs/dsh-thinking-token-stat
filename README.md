# dsh-client-ui-thinking-stats

![license](https://img.shields.io/badge/license-MIT-green)
![dsh](https://img.shields.io/badge/dsh-plugin-4B32C3)
[![repo](https://img.shields.io/badge/repo-github-181717?logo=github)](https://github.com/Six6stRINgs/dsh-client-ui-thinking-stats)


A **lightweight, client-only** DeepSeek Harness plugin that surfaces the
model's **thinking tokens** — the reasoning part of its output. No host
behavior, no extra services, no background polling: a small readout that reads
the existing conversation snapshot and renders nothing at all when there is no
thinking.

[Chinese version / 中文版](./README.zh.md)

![thinking-token statistics](./assets/screenshot.png)

It adds two readouts, both of which **render nothing when the model has produced
no thinking** for the relevant scope:

| Surface | Slot | Scope |
| --- | --- | --- |
| Bottom composer dock | `conversation.composer.dock` | Whole session (cumulative) |
| Each assistant reply (timing row) | `conversation.chat.assistant-actions` | That single turn |

The per-turn readout is appended to the reply's timing strip — the same hover
row that shows `20:55 · 用时 11秒 · 首token 10秒 · 28 tok/s` — so it reads as part
of that same unit.

Each readout shows, left to right, a **brain glyph**, the thinking-token count,
its **share of all tokens**, and its **share of output tokens**, each with one
decimal place, for example:

```
💭 15 · 0.2% · 60.0%
```

Hover for the exact numbers.

## How thinking tokens are counted

For every finalized assistant message, in order:

1. **Provider-reported** — if `usage.reasoningTokens` is present (DeepSeek,
   OpenAI o-series, Anthropic, …), it is used as-is. This is exact.
2. **Otherwise** — the reasoning blocks are priced with the harness' fixed
   heuristic (four characters per token), so a provider that returns reasoning
   text but no token count still gets a figure.
3. **Neither present** → the message counts as zero thinking and contributes
   nothing.

The two denominators are derived from the *same* assistant messages, so the
percentages always agree with the count on one consistent scope:

- **share of all tokens** = thinking ÷ (input + output + cache reads + cache writes)
- **share of output** = thinking ÷ output

## Why it's lightweight

- **Client-only, zero host behavior.** The node half (`lib/index.js`) is an empty
  `apply` that exists only so the package appears in the host Loader. All work is
  done in the browser.
- **Read-only.** It consumes the existing conversation snapshot; it adds no
  service, projection, tool, or RPC.
- **Self-contained.** It depends on no other plugin.
- **Zero-cost when idle.** When nothing is being thought, both readouts render
  `null` — no element, no layout cost.
- **Theme-aware.** Colors come from the `--dsw-alias-*` tokens, so it follows
  light/dark automatically.

## Install

The plugin follows the standard `dsh.bundle` + `dsh.client` convention, so it
installs like any DSH plugin. From this repository:

```sh
dsh plugin add github:Six6stRINgs/dsh-client-ui-thinking-stats
```

Then restart `dsh web` and reload the page. The readouts appear only once the
model starts thinking.

## Testing

`test/harness.mjs` stubs the browser/React environment, runs the real factory
and `apply`, and renders both entries against sample data (provider-reported and
block-estimated paths, the one-decimal formatting, and the hidden-when-empty
cases). Run with:

```
node test/harness.mjs
```

## Known limitations

- Figures come from the **in-window** conversation snapshot. For very long,
  paged sessions the visible window is the counted scope; the shipped stats
  line and projections use whole-log folds instead.
- The character-per-token estimate is approximate, exactly as the harness'
  fixed heuristic is; provider-reported `reasoningTokens` is always preferred.
