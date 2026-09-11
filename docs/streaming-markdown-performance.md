# Streaming Markdown rendering

Measured on September 9, 2026, against `c92bf0928`, using the signed-in
`/ai/chat` page served from the performance worktree on localhost:3000.

## The problem

A real answer delivered 10,144 characters in 72 text callbacks over 36.3 seconds.
There were 75 network reads during the answer; the median gap was 544 ms and the
median read was 202 bytes. The Markdown subtree committed 74 times.

A chunk is a sentence or a table row. It appeared whole, then nothing moved for
half a second. Three clocks ran independently: the network at roughly 500 ms,
React whenever a chunk landed, and the scroll follow on its own 200 ms interval.
Each one produced a visible hop. A faster renderer cannot fix that on its own; it
draws the same burst faster. Smoothness has to be manufactured on the client, and
then the renderer has to be cheap enough to run every frame.

## Layers

### 1. Reveal pacing (`useStreamReveal`)

Sits between the stream state and the Markdown renderer. It keeps a revealed
prefix of the draft and advances it every animation frame at a rate that finishes
the backlog by the time the next chunk is expected. The rate is fixed when text
arrives, not recomputed from the shrinking backlog, so a chunk finishes in bounded
time. The expected gap is an exponential average of observed arrival gaps, clamped
to 120–800 ms; the first chunk uses 500 ms. A chunk arriving early raises the rate,
so the reveal never lags by more than about one chunk gap.

Text that is not a continuation of what was revealed (reset, finalized rewrite)
shows in full at once. Committed and historical messages are never paced. When the
stream ends with text still unrevealed, the remainder drains over 150 ms and the
caret stays on the trailing text until it does.

Character-level reveal works inside tables for free: a partial row parses as a
partial row. Column widths shift as cells fill; that is accepted.

### 1b. Tail mending (`mendStreamingMarkdown`)

Revealing a few characters at a time means every marker exists alone for a few
frames, which chunked delivery hid inside one commit. A `-` on the line after a
paragraph is a setext underline that turns the paragraph into a heading until the
next character makes it a list item; `#` alone is an empty heading; `**bo` shows
two literal asterisks; `[Aave](https://ll` is a growing line of URL text that
collapses into one word when the `)` lands. Each flip moves the layout, and a
shrink clamps the scroll position (see the scroll section).

While the text is unfinished, a mending pass repairs the tail, in the spirit of
Streamdown's `remend` but decided from the parse tree rather than the source text.
The segment renderer parses the text, hands the tree to the mender, and if the
mender returns a repaired source, parses that instead; the parser cache makes the
second parse a suffix parse like the first, and nothing scans the whole text.

Only the block that ends exactly at the end of the source can still change, so
only it is considered. What the parser already recognised is never touched: a
backtick inside a code span, a fence inside a block quote or list item, a `-`
inside a code block are other nodes and do not count as markers. A first version
counted delimiter characters in the source and was rejected in review for exactly
those cases (a valid ``` ``a`b`` ``` span lost its code, `` `**` `` gained
asterisks, a fence inside a quote was edited); the tests now carry them.

Rules: a heading with no text (`#`, `## `) is held back until text arrives; a
setext underline (`Text\n-`) is held back until its line is complete, since one
more character makes it a list item; a backtick run still in text is an unmatched
opener and is closed with a run of the same length; `**` or `~~` still in text and
followed by a character is closed; an unfinished link keeps its text and drops its
partial URL (the partial URL is usually already a GFM autolink node, which is why
the check runs over the trailing text-and-link run); an unfinished image is hidden.
Single `*` and `_` are left alone because they are also list markers and identifier
characters. Finished text is always rendered exactly as written.

### 1c. List repairs (`repairLists`)

Models write lists the way people read them, and two of those habits are not
Markdown. CommonMark lets only a `1.` item interrupt a paragraph, so a bold header
followed on the next line by `4. ...` is one paragraph, and items 4 to 9 run
together as wrapped prose. A sub-list indented by one space under `2. item` is
shallower than the item's content column, so it splits the numbered list in two
instead of nesting.

Both repairs read the parse tree, not the source text, and rewrite only the
affected range: a blank line goes between a paragraph and a following list that
starts above 1, and a shallow sub-list is pushed out to its parent item's content
column. Code and every other block are untouched, and a repair that changes nothing
returns null so no reparse happens. These apply to finished text as well as
streaming text, unlike tail mending.

### 2. Parser cache (`remarkIncremental`)

Reuses the previous parse for every top-level block except the two trailing ones
and reparses only the changed suffix. Details and limits are below.

Raw input, detached ordered lists, and nested indented lists each have a separate
parser cache. Sharing one cache would alternate raw and repaired prefixes; an
early list repair would then force full-document parses on every reveal commit.
Tail mending uses whichever stage produced the final tree, since its changes stay
inside the open suffix. The existing full-parse fallbacks still apply.

### 3. Cached segments (`markdownSegments`)

Replaces `<ReactMarkdown>` with the same pipeline run per top-level block. Each
block goes through remark-rehype, raw HTML, sanitize, citation pills, heading ids
and React element creation on its own, and the finished React elements are kept.
On the next render a block whose source, and every block before it, is unchanged
returns the same elements, so React skips it as well. Only the trailing block does
work per frame.

Document-wide behaviour is preserved by construction:

- Heading numbering runs across segments through counts handed from one segment
  to the next in `file.data.headingCounts`, which is why reuse stops at the first
  changed block.
- Definitions and footnotes resolve references anywhere, so a document containing
  one renders as a single segment.
- Raw HTML is parsed by parse5 as one stream, so an element left open in a block
  swallows the blocks after it. A block whose HTML tags do not balance renders
  together with everything after it. Balanced HTML ends a segment.
- The caret pass runs on the last segment. If that segment renders nothing visible
  (a comment, a stripped tag), the caret passes back to the last segment that has
  content, as it would walking a whole document.
- A newline text node separates segments, matching remark-rehype, so the DOM is
  identical to the whole-document render.

`markdownSegments.test.tsx` renders every streamed prefix of a fixture corpus
through both `<ReactMarkdown>` and the segment renderer and requires identical
`innerHTML`, including unclosed HTML, footnotes, definitions, nested lists, unsafe
URLs and the caret.

### 4. Scroll follow on content growth (`useChatScroll`)

The 200 ms follow interval is gone. A `ResizeObserver` on the conversation
content pins the viewport to the bottom in the same frame the content grows, after
layout and before paint, so the viewport moves with the text instead of hopping
after it.

The first browser check of this branch found following switch off by itself on
desktop and never recover. Cause: with text typing in per frame, a partial `---`
or `#` line turns a paragraph into a heading and back, so the content briefly
shrinks. The browser clamps `scrollTop` by a line or a block, and both the scroll
handler and the follow heuristic read "scrollTop is lower than where we put it" as
an upward user scroll. Chunked delivery never showed such shrinks because they
happened inside one commit. A clamp and a scrollbar nudge are indistinguishable in
a scroll event, so the rule is now: while attached, an upward move that leaves the
viewport within 120 px of the bottom is layout and is pinned straight back; a
larger one is intent and detaches. Wheel, touch and now ArrowUp, PageUp and Home
are read from their own events and detach regardless of distance. The regression
has a test in `useChatScroll.test.tsx`.

The second browser check confirmed following held across three answers and found
two smaller things. A scrollbar drag under 120 px was pulled back to the bottom, so
a pointer press within 20 px of the container's right edge now marks a scrollbar
grab, and while it lasts every movement is intent. And one ArrowUp was undone: the
viewport was still within the 48 px attach threshold, browser scroll anchoring
nudged scrollTop down as content changed, and that read as the user returning.
Re-attaching now also requires a downward gesture within the last two seconds
(wheel, touch, ArrowDown, PageDown, End, Space) or a held scrollbar. The attach,
detach and reattach state machine is otherwise unchanged.

### Not done

Per-word fade-in spans (what Streamdown's `animated` does) were left out. With a
per-character reveal the fade is subtle, and wrapping every word in a span adds
DOM and interferes with heading text extraction and citation markers. Revisit if
the reveal alone is not enough.

## Parser measurements

The same captured text was replayed through the baseline and optimized
renderers at its recorded arrival times, in the same browser and viewport. Both
renderers used the app's components and Markdown plugins. No other verification
jobs ran during the paired measurement.

| Development browser replay           | Baseline | Cached parser |
| ------------------------------------ | -------: | ------------: |
| React commits                        |       77 |            77 |
| Characters passed to Markdown parser |  752,094 |        37,755 |
| Parser calls                         |      146 |            72 |
| Total parser time                    | 1,810 ms |        224 ms |
| Total Markdown subtree render time   | 2,373 ms |      1,083 ms |
| 95th percentile render duration      |  59.8 ms |       25.5 ms |
| Long tasks during replay             |       23 |             0 |
| Frame gaps over 50 ms                |        3 |             0 |

Development Strict Mode repeats work, so these are paired development
measurements, not production application latency claims.

A separate Bun benchmark ran the installed parser and HTML plugins with
`NODE_ENV=production`, one warm-up and five measured runs. It replayed the
captured answer in 140-character increments, then repeated the answer to examine
growth. Times below are medians across the five runs and exclude React and DOM
work. No Next production build was run.

| Workload          | Full parser | Cached parser | Full parser + HTML pipeline | Cached parser + HTML pipeline |
| ----------------- | ----------: | ------------: | --------------------------: | ----------------------------: |
| 2,536 characters  |     15.3 ms |        5.1 ms |                     14.9 ms |                        7.2 ms |
| 10,144 characters |    181.8 ms |       21.5 ms |                    230.9 ms |                       55.2 ms |
| 40,582 characters |  2,738.7 ms |       91.5 ms |                  3,424.1 ms |                      508.0 ms |

For the 40 KB answer, parser input fell from 5,907,282 to 155,586 characters. The
right-hand columns are what the segment cache (layer 3) removes: with segments,
the HTML pipeline and element creation run only for the trailing block.

## Replay with the reveal (development, instrumented)

Real answers were captured and replayed with identical text and timing against
main and this branch in isolated checkouts.

| Metric                          |     Main | This branch |
| ------------------------------- | -------: | ----------: |
| Render p95 near 10 KB           |  63.5 ms |      4.3 ms |
| Total render work, short answer |   2.83 s |      7.30 s |
| Render p95 near 40 KB           | 140.3 ms |      4.9 ms |
| Total render work, long answer  |   35.0 s |      45.8 s |
| Parser time, long answer        |   30.5 s |      17.3 s |
| Frames over 50 ms, long answer  |      267 |           0 |
| Markdown commits, long answer   |      390 |      12,096 |

Per commit the branch is about 24 times cheaper; per frame it commits about 31
times more often, so total work rose by a third while the long frames vanished.

A CPU profile of the pipeline alone (Bun, production mode, a synthetic 26 KB
answer with 25-row tables, 3 characters per step) puts about 80 percent of the
self time in micromark reparsing the trailing block, most of it GFM table rows and
cells; segment bookkeeping does not register. An open table reparses in full on
every step, and nothing below block level can be cached, so cadence is the lever.

### Cost-paced commits

The segment renderer reports how long its last render took, and the reveal loop
spaces commits so that the pipeline's own time stays near 15 percent of wall time
(`RENDER_BUDGET` in `useStreamReveal`). This is a pacing target, not a CPU
guarantee: it measures parsing, rehype and element creation, not React
reconciliation or layout, which is why short answers still cost more than main
per second even though every commit is cheap. The revealed position still
advances every frame; only the commit waits. A paragraph that renders in a millisecond commits
every frame; an open table that renders in 10 ms commits about fifteen times a
second and reveals a few more characters per commit. Frames that arrive late
(over 24 ms apart, the thread busy with something else) drop commits to every
other frame until frames are on time again. The budget is one constant, and total
CPU during streaming follows it; lower it if the share is still too high.

The same replay with pacing in place (development, instrumented):

| Metric                        |     Main | Per-frame commits | Cost-paced |
| ----------------------------- | -------: | ----------------: | ---------: |
| Short-answer render work      |   2.83 s |            7.30 s |     5.90 s |
| Long-answer render work       |   35.0 s |            45.8 s |     34.3 s |
| Long-answer commits           |      390 |            12,096 |      8,087 |
| Render p95 near 40 KB         | 140.3 ms |            4.9 ms |     7.5 ms |
| Long-answer frames over 50 ms |      267 |                 0 |          1 |

The long answer now costs about the same render work as main with none of its
stalls. A short answer costs about twice main's render work: its pipeline is cheap,
so it commits every frame, and the remaining cost is React's per-commit work, which
the target does not see. That is the trade for typing text. If it matters (battery
on mobile), the next step is to include the React commit time in the paced cost or
lower the target. A real mobile keyboard remains unverified.

## Parser cache boundaries and correctness

The cache uses the real parser's top-level nodes and source positions. It keeps
two trailing blocks open because a partial marker can become a continuation of
the preceding block. It checks an overlapping block before reusing the earlier
prefix and reparses the full document when that check disagrees. Changed text,
rewinds, and speculative renders cannot select another document's cached tree.

Reference and footnote definitions can change earlier text, so documents with
definitions use the full parser. Indented code carries parser interruption
context; untagged fences have the same AST shape, so those conservatively use the
full parser too. A document containing a BOM also bypasses prefix reuse because
the parser treats a BOM specially at the start of input. Long unfinished blocks
still need reparsing. These are deliberate correctness limits, not truncated or
partially rendered content.

The verification included streamed-prefix comparisons against the normal parser
for the 652 [CommonMark examples](https://spec.commonmark.org/0.31.2/), mixed
documents, and focused regressions for ambiguous list and code boundaries. Repo
tests compare trees and rendered behavior rather than snapshotting today's parse
counts. Compiler tests exercise the actual renderer as chunks, late citations, and
reference definitions arrive.
