# dsh-thinking-token-stat

> **English** | [中文](./README_zh.md)

[![awesome · DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
[![dsh](https://img.shields.io/badge/dsh-plugin-4B32C3)](https://github.com/deepseek-ai/deepseek-harness)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/dsh-thinking-token-stat?color=4a6cf7)](https://www.npmjs.com/package/dsh-thinking-token-stat)
[![npm downloads](https://img.shields.io/npm/dt/dsh-thinking-token-stat?color=4a6cf7)](https://www.npmjs.com/package/dsh-thinking-token-stat)
[![repo](https://img.shields.io/badge/repo-github-181717?logo=github)](https://github.com/Six6stRINgs/dsh-thinking-token-stat)
[![GitHub stars](https://img.shields.io/github/stars/Six6stRINgs/dsh-thinking-token-stat?color=4a6cf7)](https://github.com/Six6stRINgs/dsh-thinking-token-stat/)

See the thinking-token total of a whole conversation, right in the statistics line
under the message box. Open it for the share of the reasoning output, how many turns
actually thought, and how much of the figure had to be worked out rather than reported.
A second view breaks the figure down turn by turn, with the model each turn ran on.

![the readout in the composer dock, with the session overview open](./assets/screenshot.png)

The statistics line under the message box, and the overview it opens: the session total,
both shares, how many turns actually thought, how much of the figure was worked out
rather than reported, and what the numbers cover.

![thinking by turn](./assets/screenshot-turns.png)

The turn-by-turn table: one row per turn with its thinking, everything that turn wrote,
where that figure came from, the model that ran it, and the turn's share of its own
output.

## What you get

One extra figure in the statistics line under the message box:

```
💭 37.2K · 70.7% · 4 / 6 turns
```

- **how many thinking tokens** the conversation used in total;
- **what share of the output** those turns produced — of everything the model wrote
  while thinking, how much of it was thinking;
- **how many turns actually thought**, shown only when some turns did not, so the
  line stays short otherwise.

Click it for the details.

## Why there is no per-reply figure any more

DSH's own reply panel already reports a turn's reasoning tokens, and it says more
about that turn besides. An earlier version of this plugin also showed a number next
to every reply, which only repeated what was already one click away, so that figure
has been **removed**.

What the reply panel cannot show is a number the model provider never reported.
Rather than put a guess next to every reply, this plugin keeps that information where
it belongs: in the session details, as one clearly-labelled line.

## What the details show

```
Thinking tokens (session)                    37.2K tok
──────────────────────────────────────────────────────
Thinking / reasoning output (52.6K tok)         70.7%
Thinking / all tokens (12.4M tok)                0.3%
Reasoning turns                              4 / 6 turns
Turns without a reported count     2 turns · ~5.1K tok
                              Estimated ≈ 5.1K tok ?
Scope: the whole session, 6 turns, of which 1 produced no reply. ?
```

| Line | Meaning |
| --- | --- |
| Thinking / reasoning output | of the output written while thinking, how much was thinking |
| Thinking / all tokens | the same share measured against every token those turns were billed for |
| Reasoning turns | how many turns thought, out of how many ran |
| Turns without a reported count | how many turns needed a worked-out figure instead of a reported one, and how much of the total that accounts for |
| Estimated … | the same worked-out share again, stated in words, with a `?` for the reason behind it |
| Scope | what the numbers actually cover, computed rather than asserted: the turn count, any turn that produced no reply, a forked session's excluded history, and the per-turn list's own cap — each of which carries a `?` with its reason when it applies |

Percentages use one decimal place; large counts are shortened, as in `24.8K`.

**A figure that rests on the text fold carries a `~`** — `~37.2K`, `~70.7%` — on the
line under the message box and everywhere in the details. The `?` beside the estimate
opens a short message explaining why such a figure exists; it closes, like the details
themselves, when you click anywhere else.

At the bottom of the details, one line leads to the turn-by-turn view.

## Turn by turn

The turn-by-turn view lists one line per turn, newest first:

| Column | Meaning |
| --- | --- |
| Turn | which turn it is |
| Thinking | the thinking tokens for that turn, marked `~` and coloured as an estimate when it was worked out |
| Output | everything that turn wrote — what the last column is a share of |
| Thinking source | where the thinking figure came from: reported by the provider, worked out from the thinking text, or both |
| Model | which model ran that turn |
| Of output | that turn's thinking as a share of what it wrote, marked `~` when it was worked out |

Three switches above the table choose what is listed: turns with a reported count,
turns with a worked-out count, and turns with no thinking figure at all. The last
group is off by default, because a turn that did not think is not interesting to see
listed one by one — the switch shows how many are hidden.

**Every turn the conversation started is listed, including the ones that failed.** A
turn that errored or was interrupted never assembles a reply, so it has no tokens to
report; it still appears, with `—` in every column and `None` as its source, because a
table that silently skipped it would look as if the conversation had lost a turn. Those
are the turns behind the `None` switch's count, and the overview's scope line names how
many of them there are — with a `?` explaining that they produced no reply rather than
no reasoning.

**One page of 100 turns is rendered at a time.** A long conversation becomes a long
table, and laying out a thousand rows to read ten of them is work nobody asked for, so
only the page in view exists in the page: `Newer / Older` and `page 2 of 5` move
between them.

Every row ends with a jump button that takes you to that turn's reply in the
conversation. It does nothing for a turn the conversation view no longer holds.

**The details close from anywhere.** Clicking another control in the composer, or
anywhere outside, closes the overview and the table alike, as does `Escape` — the same
behaviour as DSH's own statistics panel.

### Where the numbers come from

This plugin is two halves. The **host half** folds the session's event log once, turn by
turn, and registers the result as a DSH **session projection** — the same mechanism the
official statistics use. The **browser half** reads that one value and draws it.

That is the whole design, and it is what makes the numbers trustworthy:

- **The fold covers the entire log, not the window.** DSH keeps a conversation as a
  window of recent turns and compaction rewrites that window, so anything counted from
  what is on screen is local and unstable. A projection is folded from every committed
  event, checkpointed with the session, and refolded only over the events that arrived
  since — so the figures are whole-session by construction, on a conversation of any
  length, and identical after a reload.
- **Nothing is loaded, ever.** The plugin never reads a message back into the
  conversation, and never asks DSH to. There is no "load more" because there is nothing
  to load: the host already folded it.
- **Nothing is cached by the browser.** There is no `localStorage`, no ledger, and no
  per-session browser state. The projection's checkpoint is the persistence, and it
  belongs to the session, not to this plugin.
- **Every event that is not an assistant settlement is a no-op**, and the fold keeps six
  numbers per turn plus a dictionary of model names. On a real 88-turn session it folds
  8 988 events in about 5 ms in total, and stores 3 KB.

If the host cannot provide the projection — an older DSH, a session that has not folded
yet — the readout falls back to the official whole-session token projection and says so,
rather than inventing per-turn numbers.

#### What it costs in storage

The fold's checkpoint is one row inside DSH's own projection cache
(<code>&lt;root&gt;/session_projcache/sessions/&lt;sessionId&gt;.json</code>), beside the
official units. A row is six numbers per turn plus a shared model dictionary, so size
follows length, not content:

| Turns | Persisted state | Published to the browser |
| --- | --- | --- |
| 88 (a real session measured here) | 3.0 KB | 2.4 KB |
| 1 000 | ≈ 35 KB | capped at the newest 200 rows |
| 5 000 (the state's own cap) | ≈ 175 KB | capped at the newest 200 rows |

For comparison, DSH's own `turnOutline` unit keeps a larger per-turn record for the same
session, and its `contextBreakdown` state is 54 KB. The published view is deliberately
bounded: a client-visible projection value rides every snapshot frame, so the per-turn
rows are capped at the newest 200 while the totals stay whole-session. Past that, the
overview says so in one line.

### Where the model column comes from

Each settled assistant message names the provider and model that produced it, so the fold
records that name on the turn it belongs to — once, in a dictionary, not once per row. A
turn that ran on two models after a retry lists both. Nothing is asked of DSH's Trajectory
view, and no second fold is created for it.


## Where the numbers come from

Whether a number is available depends on the model provider: some report a
reasoning-token count, some send only the thinking text, and some send neither.

| What the provider sends | What you see |
| --- | --- |
| A reasoning-token count | that count, exactly |
| Only the thinking text | a number worked out from the text |
| Neither | nothing — that reply counts as no thinking |

**Why some figures have to be worked out.** Not every provider reports a
reasoning-token count, and DSH cannot require one. If the thinking text were ignored
whenever a count is missing, a whole class of models would appear to have thought
nothing at all — even though the thinking is right there on screen. So the text is
measured instead, **at a density that depends on the script** — a single English rule
would under-count every other language by two to four times:

| Script | Characters per token | Why |
| --- | --- | --- |
| Chinese, Japanese kana, Korean Hangul, fullwidth forms | 1 | these tokenize at roughly 0.6–1.7 tokens per character depending on the tokenizer, and DeepSeek's and Qwen's own tokenizers sit at the dense end (~0.6–0.8) |
| Cyrillic, Greek, Arabic, Hebrew, Armenian, the Indic scripts, Thai, Georgian | 2.5 | better represented than CJK but still not English; measured tokenizer behaviour puts them at roughly 2–3 characters per token |
| Latin letters, digits, punctuation, whitespace | 4 | the familiar English rule of thumb |

The dense end is taken as 1 rather than 0.7 on purpose: for a Chinese-optimised model
that reads slightly high, and a figure that reads slightly high is a better failure than
one presented as a measurement while reading low.

That is an estimate rather than a measurement, and it is treated as one: every figure
that rests on it carries a `~`, the panel states how many turns needed it and how much
of the total it accounts for, and the `?` beside it opens the rule itself.

**What the split costs.** Two `replace` passes per reasoning block, and the fold stays
the fastest thing in the plugin: measured over this session's 2.3 million characters of
reasoning text, the per-script pricing adds 1.7 ms to a fold that takes 5 ms — about
5 µs per settlement, paid once, by the host, on the way into a durable projection. It
runs nowhere near the render path.

**The shares only ever use the turns that actually thought.** That is deliberate: if
you switch to a model that does not think, the older numbers do not start sliding
down just because the conversation got longer. It also means "4 / 6 turns" tells you
plainly how much of the conversation the figure describes.

## What this plugin does and does not do

**It does**: total up the thinking in a conversation and explain how that total was
arrived at.

**It does not**:

- change the conversation, steer the model, or send anything anywhere — it reads the
  session's own event log on the host and the projection DSH serves, and makes no
  network requests;
- display anything when the model did not think, or does not expose its thinking;
- claim precision it does not have. A number the provider reported is exact; a number
  worked out from the thinking text is an estimate, and the details label it as one;
- count a window instead of a session. The figures are the session's, so paging and
  compaction cannot change them;
- read your history behind your back, or load it in front of you. The host folds the log
  it already has; the browser never reads or requests a message;
- write anything into your browser. There is no local storage and no per-plugin state.

## Lightweight by design

- **One small figure.** Nothing is added next to individual replies.
- **Folded once, by the host.** One reducer over one event type, six numbers per turn,
  0.6 µs per event on a real session — and every other event costs a single reference
  comparison.
- **Nothing is loaded, paged, or cached.** The browser half reads one projection value;
  it holds no session binding, opens no conversation, and stores nothing.
- **Read-only.** No background service, no extra requests, no network access.
- **Nothing to configure.** No settings, no accounts, no data collection.
- **Invisible when idle.** A conversation with no thinking shows nothing at all.
- **Bounded.** The state keeps 5 000 rows (≈175 KB) and the published view 200 rows, and
  the table renders one page of 100 at a time.
- **Follows your theme**, light or dark.
- **Follows your language.** The plugin is written in the two languages DSH ships,
  Chinese and English, and follows `<html lang>` — anything else, including a third
  language from a locale plugin, falls back to English.

## Install

From GitHub:

```sh
dsh plugin add github:Six6stRINgs/dsh-thinking-token-stat
```

Or install the published npm package:

```sh
npm install dsh-thinking-token-stat
```

Then restart `dsh web` and reload the page. The figure appears once the model starts
thinking.

## License

MIT — see [LICENSE](./LICENSE).

## Changelog

One line per released version: [CHANGELOG.md](./CHANGELOG.md).

## For developers

Only if you intend to change the code. The plugin is two files with one job each:

- **`lib/index.js`** — the host half. Registers one session projection (`thinkingStats`),
  a pure `apply(state, event)` fold over `assistant/message` settlements. It carries its
  own tiny `{ parse }` schemas so the package stays dependency-free, and it exports
  `__testProjection` for the unit spec.
- **`lib/client.js`** — the browser half. Registers one composer-dock entry, reads
  `useProjection("thinkingStats")`, and draws the pill, the overview and the per-turn
  table. It depends on the slot service and nothing else.

`npm test` runs both suites with no browser and no host:

- `node test/projection.mjs` drives the fold — provider-reported counts, text-derived
  counts, retry replacement, fork inheritance, the reasoning-scoped denominators, both
  caps, and the schema gate — and, with `DSH_TEST_LOG` set to a `session.v3.jsonl.zstd`,
  re-folds a real recorded session and checks the totals against an independent pass over
  the same events.
- `node test/harness.mjs` renders the browser half against synthetic projection values:
  the `~` marks, the `?` message, scope and cap notes, the columns, filters and paging,
  the model dictionary, dismissal from either level, and the fallback for a host that
  serves no per-turn projection.
