# Changelog

One line per released version. Versions before 1.0.2 were development-only and
were never published to npm.

## 1.1.0 — 2026-09-13

Rebuilt on a session projection of this plugin's own, with the wording and the scope of
every figure made explicit. The browser half no longer reads the conversation at all.

- Reworked into a session-level ledger: the shares now cover only the turns that
  actually reasoned, so switching to a model that does not think no longer makes
  the numbers slide down.
- Added coverage (`4 / 6 turns`, shown only when part of the conversation did not
  reason) and a line saying how much of the total was worked out from the thinking
  text rather than reported by the provider.
- Removed the per-reply figure: the DSH reply panel already reports that turn's
  reasoning tokens, so it was a duplicate. The plugin now owns one readout.
- Added a turn-by-turn view behind the details: one row per turn with its thinking
  tokens, the turn's own output tokens, where that number came from, the model that
  ran it, and the share of its own output; filters for the three sources, and a jump
  button on every row.
- Fixed the model column: the shipped per-turn usage data exists for only a few turns
  of a real log, so the column now comes from the plugin's own fold, which records the
  provider and model each settlement itself.
- **Rebuilt on a session projection.** The host half folds the session's whole event log
  once (`assistant/message` settlements, six numbers per turn, model names in a
  dictionary) and publishes it as the `thinkingStats` projection; the browser half reads
  that one value. The figures are therefore whole-session by construction — paging and
  compaction cannot change them — and identical after a reload.
- **All loading is gone**, along with the per-turn cache, the `~`/paging controls for it
  and the browser's local storage. There is nothing to load: the host already folded the
  log. The client no longer needs the session or conversation service, a conversation
  window, the node store, or the trajectory fold.
- The overview's scope line is now computed from what the fold actually holds rather
  than asserted: the whole session with its turn count, or the turns that produced no
  reply, or this session's own turns when it was forked, or totals only when the host
  serves no projection. Whenever the count is not complete, a `?` opens the same kind of
  message as the estimate's, explaining that reason — and the per-turn list's own cap
  carries one too.
- Measured on a real 88-turn session: 8 988 events folded in ~5 ms total (0.6 µs per
  event), 3.0 KB of persisted state (36 B per turn) and a 2.4 KB published view — smaller
  than DSH's own `turnOutline` record for the same session.
- The overview carries no per-model split: the table's model column answers that question
  per turn, and an aggregate would have needed extra fold state for a duplicate.
- The per-turn table is unchanged otherwise (columns, source filters, 100 rows a page,
  jump button), and an estimated row now marks both its thinking and its share with `~`
  and colours them as an estimate.
- The fold opens a turn on its `turn/start` boundary rather than on its first settlement,
  so a turn that errored or was interrupted — and therefore never produced a message — is
  still listed, with no figures, instead of looking like a turn the conversation lost. It
  also counts how many turns actually settled, which is what the scope line measures its
  gaps against.
- Worked-out figures are now priced **per script** instead of at a flat four characters per
  token: CJK/Kana/Hangul and fullwidth forms at 1 character per token, Cyrillic, Greek,
  Arabic, Hebrew, Armenian, the Indic scripts, Thai and Georgian at 2.5, Latin letters,
  digits and punctuation at 4. Two `replace` passes per reasoning block, measured at
  1.7 ms over a session's 2.3M characters of reasoning against a 5 ms fold. The fold's
  `stateVersion` is bumped to 2 so stored checkpoints are rebuilt rather than mixed.
- The estimate's own line states `Estimated ≈ 5.1K tok` rather than a bare `~5.1K tok`,
  so the figure reads as the admission it is.
- A host without the projection falls back to the official whole-session token projection
  and says so, rather than inventing per-turn figures.
- The plugin now has a unit spec for the fold (`test/projection.mjs`) which, given
  `DSH_TEST_LOG`, re-folds a real recorded session and checks every total against an
  independent pass over the same events.
- The table renders **one page of 100 turns**, with Newer/Older and a page count; only
  the page in view is laid out.
- Fixed the per-turn table's header in English: `Thinking source` was cut to
  `Thinking sou…` and `Of output` wrapped onto a second line, because the columns were
  sized for the shorter Chinese labels. The two columns are now as wide as the longest
  label in either language, and no header cell wraps.
- Fixed the `?` on the overview's footnotes: inline after a sentence it needed its own
  space instead of sitting on the full stop it closes.
- Fixed the estimate's explanation card running off the bottom of the window. It is a
  paragraph of prose, so its height is now measured and the card is clamped inside the
  viewport, rather than placed as if it were a fixed height that was shorter than the
  real card; a window too short for it scrolls the card instead of cutting it. The
  placement also stops recomputing a fresh position on every render.
- Follows the interface language, in the two languages DSH ships: only a `zh`-prefixed
  `<html lang>` reads Chinese, and every other value — a third language, or the empty
  attribute a document has before the locale service publishes — reads English, which is
  DSH's own fallback. Switching language updates the readout without a reload.
- Fixed dismissal: an outside click or Escape closed nothing, because a dismissal set
  the panel's view to a value the render test did not read as closed — only the logo
  could close it. Both levels now close from anywhere, and the listener runs in the
  capture phase so a component that stops pointer propagation cannot swallow it.
- Every figure derived from the text fold is marked `~`: on the pill, on both shares,
  on the table's own total and on each estimated row.
- The estimate's `?` opens a short explanation as its own message beside the panel,
  instead of a hover tooltip that never appeared for touch or keyboard.
- The scope note is the details panel's last line, below the door to the turn-by-turn
  view, and states what the figures cover.
- Rewrote the README in plain language and replaced the screenshot.

## 1.0.8

- README: documented how to install from npm.

## 1.0.7

- The details panel now follows the DSH interface language (Chinese and English),
  and each row states the total it is a share of.
- New screenshot.

## 1.0.6

- Replaced the hover tooltip with a details panel styled like DSH's own.

## 1.0.5

- Rendered the per-reply figure as a matching icon-and-text pill.

## 1.0.4

- Followed the newer DSH reply-tail styling so the figure lined up with the
  built-in pills.

## 1.0.3

- Renamed the project and package to `dsh-thinking-token-stat` and updated every
  repository link.
- Documented that models which do not expose reasoning show no figure.

## 1.0.2

- First npm release, under the current package name.
