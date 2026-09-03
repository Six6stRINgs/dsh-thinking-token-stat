# dsh-client-ui-thinking-stats

A lightweight DeepSeek Harness client plugin that surfaces the model's
**thinking tokens** — the reasoning part of its output.

It adds two readouts, both of which **render nothing at all when the model has
produced no thinking** for the relevant scope:

| Surface | Slot | Scope |
| --- | --- | --- |
| Bottom composer dock | `conversation.composer.dock` | Whole session (cumulative) |
| Each assistant reply (timing row) | `conversation.chat.assistant-actions` | That single turn |

The per-turn readout is appended to the reply's timing strip — the same hover
row that shows `20:55 · 用时 11秒 · 首token 10秒 · 28 tok/s` — so it reads as part
of that same unit.

Each readout shows, left to right, a **brain glyph**, the thinking-token count,
its **share of all tokens**, and its **share of output tokens**, for example:

```
💭 12.3K · 17% · 56%
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

## Design

- **Client-only, zero host behavior.** The node half (`lib/index.js`) is an empty
  `apply` that exists so the package appears in the host Loader. Everything runs
  in the browser.
- **Read-only.** It consumes the existing conversation snapshot; it adds no
  service, projection, tool, or RPC.
- **Self-contained data.** It does not depend on any other optional plugin.
- **Theme-aware styling.** Colors come from the `--dsw-alias-*` theme tokens, so
  it follows light/dark automatically.

## Install

The plugin follows the standard `dsh.bundle` + `dsh.client` convention, so it
installs like any DSH plugin:

```sh
dsh plugin add @YOUR_NPM_SCOPE/dsh-client-ui-thinking-stats
```

or straight from this repository:

```sh
dsh plugin add github:YOUR_GITHUB/dsh-client-ui-thinking-stats
```

Then restart `dsh web` and reload the page. The readouts appear only once the
model starts thinking.

## Testing

`test/harness.mjs` stubs the browser/React environment, runs the real factory
and `apply`, and renders both entries against sample data (provider-reported and
block-estimated paths, plus the hidden-when-empty cases). Run with:

```
node test/harness.mjs
```

## Known limitations

- Figures come from the **in-window** conversation snapshot. For very long,
  paged sessions the visible window is the counted scope; the shipped stats
  line and projections use whole-log folds instead.
- The character-per-token estimate is approximate, exactly as the harness'
  fixed heuristic is; provider-reported `reasoningTokens` is always preferred.
