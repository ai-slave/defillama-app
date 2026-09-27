# Date formatting policy

Dates in the app represent different kinds of data. The formatter must follow the
meaning of the value rather than the shape returned by an API.

## Display categories

| Category      | Example                 | Policy                                                                                                                                 |
| ------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Calendar date | `Jul 24, 2026`          | Treat as a UTC calendar fact so the day cannot move with the viewer's timezone.                                                        |
| Exact instant | `Jul 24, 2026, 4:30 PM` | Preserve the time. Use UTC for SSR-stable output or render the viewer's timezone through an explicitly hydration-safe client path.     |
| Relative time | `3h ago`                | Use compact relative text through six days, then an absolute UTC date. Keep the exact instant available in a title or adjacent detail. |
| Month         | `Jul 2026`              | Treat as a UTC calendar period.                                                                                                        |
| Domain range  | `Jan 1 - Mar 31, 2026`  | Keep the domain formatter that owns the range and its inclusivity rules.                                                               |
| Machine date  | `2026-07-24`            | Preserve the API, URL, form, CSV, or serialization contract; do not apply display formatting.                                          |

Numeric timestamps must declare whether they are seconds or milliseconds at the
formatting boundary. A formatter must never guess from the magnitude.

## Canonical API

Generic UI dates are formatted by `src/utils/dateFormat.ts` and imported directly
from `~/utils/dateFormat`. Callers own presentation fallbacks such as `?? '-'`.
The intended API is:

```ts
formatDate(value, { input: 'seconds' })
formatDateTime(value, { input: 'milliseconds', timeZone: 'UTC' })
formatMonthYear(value)
formatRelativeTime(value, { now })
formatIsoDate(value)
```

The input option is required for numbers. Date-only strings (`YYYY-MM-DD`) are UTC
calendar facts. Strings representing instants must include `Z` or a numeric UTC
offset; offsetless date-time strings are not accepted because the server and browser
can interpret them in different timezones. `Date` objects already represent an exact
instant. Generic formatters use the app's centrally chosen locale rather than the
host's implicit locale.

Exact-instant callers must choose `UTC` or `local`; there is no implicit timezone.
Local displays may request `timeZoneName: 'short'` when the surrounding UI needs to
state the viewer's zone explicitly. Because local output varies by host, callers must
handle server rendering and hydration explicitly.

Relative output is clock-dependent. UI should use `src/ui/RelativeTime.tsx`, which
provides a deterministic server fallback, updates after hydration, refreshes over
time, and exposes the exact UTC instant. Direct `formatRelativeTime` calls are reserved
for client-clock owners that provide equivalent behavior.

## Chart time axes

ECharts time axes run in UTC. `MultiSeriesChart` sends `useUTC: true` unless a
caller sets `chartOptions.useUTC: false`, and `CandlestickChart` always sets it. Tick
placement and default tick labels then agree with the UTC tooltip, zoom, and hallmark
labels, and daily points stamped at UTC midnight sit on their day's tick in every
viewer timezone. Without it, ECharts places and labels ticks in the viewer's local
time, so one chart would show two timezones.

Chart timestamps for calendar dates must be UTC midnight, for example
``Date.parse(`${date}T00:00:00Z`)``. Do not stamp a date key with local midnight
(`dayjs(date)`, `new Date(y, m, d)`, an offsetless date-time string): a chart built
on the server and one built in the browser would then disagree.

A chart that deliberately shows the viewer's local time must opt out as a whole. Set
`useUTC: false`, and replace the tooltip and zoom-label formatters with local ones.
`useUTC` only changes ECharts' own time handling; the shared tooltip and zoom
formatters stay UTC. Rendering local time must also follow the hydration rules for
local exact instants above.

## Grouped chart periods

Weekly, monthly, quarterly, and yearly charts bucket daily points into UTC calendar
periods. A week runs Monday to Sunday and is keyed by its Sunday; every other period
is keyed by its first day (`getBucketTimestampSec`). The tooltip reads that key as
the period it names, for example "14 - 20 Sep 2026" or "Sep 1 - 30, 2026", and CSV
exports write the period's start and end dates.

- Flows and counts that add up across days sum the period (`formatBarChart`).
- Balances and running totals keep the period's last available value
  (`formatLineChart`), on the same key as the bars, so one period label describes
  every series in the chart.
- Daily counts that do not add up across days, such as active addresses, average the
  period's observed days (`formatDailyAverageChart`) and say so in their series name.
  Cumulative mode leaves them out.
- A grouped chart passes `groupBy` together with its rows, in the same memo or
  deferred snapshot, so the tooltip and CSV never label one grouping's rows with
  another.
- An API payload that is already grouped keeps its values. A week the API stamps on
  its Monday moves to that week's Sunday (`lastDayOfWeek`) instead of being summed
  again.
- Fiscal reporting periods, such as equities fundamentals, are the provider's periods,
  not calendar buckets. Name them by their period end, for example "Quarter ending
  Jul 2025".

## Protected domain behavior

The following behavior is intentionally not redefined by the generic policy:

- ECharts daily tooltips, UTC timestamps with a time component, weekly/monthly/quarterly/yearly ranges, emphasis labels, and hallmark ranges.
- Unlock calendar labels, query date keys, and timestamps with explicit GMT offsets.
- Article header publication times, scheduling inputs, revision times, and article-card dates.
- Alert scheduling and timezone-offset calculations.
- Download date-range labels. “Last N days” means exactly N inclusive calendar dates ending today; YTD includes January 1 and today.
- iCalendar fields, chart CSV timestamps, SQL results, dataset snapshots, API payloads, URLs, and form values.

These implementations may use canonical primitives where that preserves their exact
output. They remain domain-owned when their range, timezone, or serialization rules
are more specific than a generic display date. Domain ownership does not preserve a
confirmed correctness bug, such as dropping a meaningful time component or including
one extra day in an inclusive preset.

## Render clock and hydration

Most pages are static with a long revalidate, so the HTML a visitor receives was rendered hours earlier. React
compares that HTML with the first client render; any text derived from the live clock, the visitor's zone or the
visitor's locale differs, React logs a hydration mismatch and rebuilds the subtree. The rule is:

**The first client render uses the server's clock. After hydration, live displays may advance, but never by
overwriting a choice the reader made.**

- Every data function that goes through `withPerformanceLogging` or `withServerSidePropsTelemetry` stamps
  `pageClockSec` into its props, and `_app` provides it as the page clock. A page without a data function has no
  clock, and time-dependent content there renders after mount.
- Read the clock through `useNowSeconds(seed?, tickMs?)` from `src/hooks/useNowSeconds.ts`. Without a seed it
  uses the page clock for the first render and the browser clock afterwards. Pass a seed only when the value is
  tied to the data, such as the time a dataset was built or React Query's `dataUpdatedAt`. `useNowSecondsOnce(seed?)`
  has the same first render but then reads the browser clock once at mount and never moves; use it for values that
  feed memoized transforms or a per-view decision.
  A bare call on a page with no clock throws outside production: there is no safe guess.
- Never read `Date.now()`, `new Date()` or `dayjs()` while rendering: not in a component or hook body, not in a
  `useMemo` or `useState` initializer, not in a default parameter value, and not in a helper a render path calls.
  Effects, event handlers, query functions and data functions may read it.
- When a render value moves to the page clock, move everything compared against it too, including helpers in other
  modules. A range built from `useNowSeconds` and checked against `new Date()` in an imported helper agrees on the
  server and disagrees in the browser once the HTML crosses midnight.
- "Today" for the visitor is their local day, which the server cannot know. Mark it after mount with
  `useIsClient()`, or compare in UTC.
- Date arithmetic uses the UTC methods (`getUTCMonth`, `setUTCDate`); the local-zone methods belong to the few
  modules listed in `scripts/policies/check-hydration.ts` with their reason.
- Server-rendered date text names a literal locale and a `timeZone`. `~/utils/dateFormat` does this; an approved
  raw formatter must too, unless the surface renders after interaction.
- Text the server may legitimately render differently, a cached price, a build-frozen copyright year, goes through
  `StaleText` from `src/ui/StaleText.tsx`. It carries the one `suppressHydrationWarning` in the app and accepts text
  only, because the flag covers an element's own text and nothing nested. React keeps the server's text until a
  later render changes the value, so suppression is not a way to show the visitor's zone: a local-zone time is the
  same on every client render and would stay as the server wrote it. Render it after mount or in UTC.
- A form default seeded from the page clock must follow the clock after hydration while a value the reader picked
  stays: derive the shown value from the selection when there is one, else from the live default
  (`useDateRangeValidation` is the reference).
- Test the whole path with `renderHydrated` from `src/utils/testing/hydration.tsx`: render on the server at a
  stale clock and zone, hydrate at the visitor's, assert no errors, then assert the displayed values after the live
  clock takes over and that a selection survives it. The helper renders the server side under the page clock
  and gives both renders the same element, so build per-render state such as a `QueryClient` inside the tree: a
  shared instance hands the browser the server's cache and hides the mismatch. A component that hydrates cleanly
  can still freeze on the
  server's day.

`scripts/policies/check-hydration.ts` enforces the flag, the render-time reads it can see and the local-zone
methods; it does not trace a clock read through an imported helper, so keep clock reads out of helpers that
render code imports.

## Enforcement rules

- Do not re-export date formatters from `~/utils` or another barrel.
- Do not alias canonical imports or add wrappers that only supply a fallback.
- Keep a local formatter only when it owns documented domain semantics that the canonical API does not express.
- Date-only API fields must not shift a day in negative or positive UTC offsets.
- Exact instants must not lose their time.
- Display labels must not be reused for machine output.
- Invalid or missing values return `null`; the consumer chooses the appropriate UI copy.
- Raw `Intl.DateTimeFormat`, Date locale methods, and Day.js display formatting are limited to reviewed domain-owned paths.
- Approved raw formatters name a literal locale and a `timeZone` unless the surface renders after interaction.
- Render-time clock reads and `suppressHydrationWarning` outside `StaleText` fail `check-hydration.ts` (see "Render clock and hydration").

`scripts/policies/check-date-formatting.ts` enforces these boundaries. CI runs it over
the whole tree; the pre-commit hook runs it on the staged `src/` TypeScript files by
passing their paths as arguments. Its allowlists are exceptions for the protected
behavior above, not alternative generic formatting APIs.
