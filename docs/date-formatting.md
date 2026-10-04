# Date formatting

A date's formatter follows what the value means, not the shape the API returns. Generic UI dates come from `src/utils/dateFormat.ts`, imported directly from `~/utils/dateFormat`. Chart time axes and period grouping are in `docs/charts.md`.

`scripts/policies/check-date-formatting.ts` enforces the import and raw-formatter boundaries, and `scripts/policies/check-hydration.ts` enforces the render-clock rules it can see. CI runs both over the whole tree; the pre-commit hook runs them on staged `src/` files. This page covers the choices the checks cannot make.

## What to use

| To show this                                                                 | Use                                                                                                  | Example                                                            |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A calendar date (`Jul 24, 2026`)                                             | `formatDate(value, { input: 'seconds' })`, in UTC so the day cannot move with the viewer's zone      | `src/containers/Token/TokenOverviewSection.tsx`                    |
| An exact instant (`Jul 24, 2026, 4:30 PM`)                                   | `formatDateTime(value, { timeZone: 'UTC' })`, or `timeZone: 'local'` on a hydration-safe client path | `src/containers/ProDashboard/components/SqlChart/SqlFreshness.tsx` |
| A local clock time (`4:30 PM`)                                               | `formatLocalTime(date)`, on a hydration-safe client path                                             | `src/containers/LlamaAI/components/ResponseControls.tsx`           |
| A month (`Jul 2026`)                                                         | `formatMonthYear(value)`, a UTC calendar period                                                      | `src/containers/ProtocolOverview/IncomeStatement.tsx`              |
| A machine date for an API, URL, form, CSV or serialization (`2026-07-24`)    | `formatIsoDate(value)`; never a display label                                                        | `src/components/ECharts/shared/csv.ts`                             |
| A timestamp parsed from a date value, with no display formatting             | `parseDateTimestamp(value)`                                                                          |                                                                    |
| Relative time (`3h ago`)                                                     | `<RelativeTime>` from `src/ui/RelativeTime.tsx`                                                      | `src/ui/DataFreshness.tsx`                                         |
| A value about the period the page data describes                             | `usePageClockSec()` from `src/hooks/usePageClock.tsx`                                                | `src/containers/Hacks/index.tsx`                                   |
| A value about now (countdown, expiry, "ago")                                 | `useNowSeconds(seed?, tickMs?)` from `src/hooks/useNowSeconds.ts`                                    | `src/auth/VerifyEmailDialog.tsx`                                   |
| Text the server may render differently (a cached price, a build-frozen year) | `<StaleText>` from `src/ui/StaleText.tsx`                                                            | `src/ui/HeroMetric.tsx`                                            |
| The visitor's "today"                                                        | Mark it after mount with `useIsClient()` from `src/hooks/useIsClient.tsx`, or compare in UTC         | `src/containers/Unlocks/CalendarView.tsx`                          |
| A date range input seeded from the clock                                     | `useDateRangeValidation` from `src/hooks/useDateRangeValidation.tsx`                                 | `src/containers/Bridges/Transactions.tsx`                          |
| A domain range (`Jan 1 - Mar 31, 2026`)                                      | The domain formatter that owns the range and its inclusivity rules                                   |                                                                    |

## Values

- A numeric timestamp declares `input: 'seconds'` or `input: 'milliseconds'` at the formatting boundary. A formatter never guesses from the magnitude.
- A date-only string (`YYYY-MM-DD`) is a UTC calendar day. Date keys, picked dates and daily points are UTC days too, and must not shift a day in any UTC offset.
- A string that represents an instant includes `Z` or a numeric UTC offset. Offsetless date-time strings are rejected, because the server and the browser read them in different zones.
- A `Date` object is an exact instant. An exact instant never loses its time.
- Generic formatters use the app's one display locale, never the host's implicit locale.
- Exact-instant callers choose `UTC` or `local`; there is no implicit zone. A local display may add `timeZoneName: 'short'` when the UI must name the viewer's zone. Local output varies by host, so it follows "Render clock and hydration".
- Relative time stays compact through six days, then shows an absolute UTC date, with the exact instant in a title. `RelativeTime` does this, renders a deterministic server fallback and ticks after hydration. Call `formatRelativeTime` directly only from a client-clock owner that does the same.
- Invalid or missing values return `null`. The caller picks the UI copy, such as `?? '-'`.
- Never reuse a display label as machine output.
- Never re-export date formatters from a barrel, alias a canonical import, or wrap one only to supply a fallback.
- Day.js works in the visitor's zone: `dayjs('2026-10-01')` is local midnight, and `startOf('year')` or `format('YYYY-MM-DD')` on a local value names the visitor's day. Parse with `dayjs.utc`, take calendar boundaries in UTC, or compare `YYYY-MM-DD` strings. The "today" that caps a date input or ends a preset is the UTC day.
- Keep a raw formatter only when it owns domain semantics the canonical API does not express. Allowlisted domain formatters in `check-date-formatting.ts` keep their own range and zone rules, but not their bugs, such as dropping a meaningful time or including one extra day in an inclusive preset.

## Render clock and hydration

Most pages are static with a long revalidate, so the HTML a visitor receives was rendered hours earlier. React compares that HTML with the first client render; any text derived from the live clock, the visitor's zone or the visitor's locale differs, React logs a hydration mismatch and rebuilds the subtree.

**The first client render uses the server's clock. After hydration, live displays may advance, but never by overwriting a choice the reader made.**

- Every data function that goes through `withPerformanceLogging` or `withServerSidePropsTelemetry` stamps `pageClockSec` into its props, and `_app` provides it as the page clock. A page without a data function has no clock, and time-dependent content there renders after mount.
- Pick the clock by the question the value answers:
  - **Which period does this data describe?** The last completed day, a 7-day window ending at the data, whether a rolling stat is from today, trimming today's partial point. The clock is the time the data was built: `usePageClockSec()` for page props, the query's `dataUpdatedAt` for data a client query fetched. Old data measured against the visitor's today has no rows for it and shows zeros. A client navigation brings the next page's clock with its data.
  - **How does now relate to something?** A countdown, an "ago" label, a cooldown, an expiry, a staleness warning, a date input's max, a "today" marker. The clock is `useNowSeconds`: the first render uses the page clock (or the seed), so the HTML hydrates, then it ticks on the browser clock. Pass a seed only when the first render must use a time tied to the data, such as the time a dataset was built.
- A query seeded from props sets `initialDataUpdatedAt` from the page clock, or the server and the hydrating client disagree about its time.
- Never freeze the clock at mount: a mounted page keeps that second across client navigations, so the next page's data is measured against the wrong day.
- Derive a default from the clock (the month a calendar opens on) during render. Only the reader's own choice goes in state.
- Never read `Date.now()`, `new Date()` or `dayjs()` while rendering: not in a component or hook body, a `useMemo` or `useState` initializer, or a helper a render path calls. Effects, event handlers, query functions and data functions may read it.
- No helper defaults or falls back to the clock (`now = Date.now()`, `options.now ?? Date.now()`). Its caller passes the clock it means: a data function reads `Date.now()` once and passes it down, and render code passes one of the two hooks.
- `check-hydration.ts` does not trace a clock read through an imported helper, so keep clock reads out of helpers that render code imports.
- When a render value moves to the page clock, move everything compared against it too, including helpers in other modules. A range built from `useNowSeconds` and checked against `new Date()` in an imported helper agrees on the server and disagrees in the browser once the HTML crosses midnight.
- Date arithmetic uses the UTC methods (`getUTCMonth`, `setUTCDate`). The local-zone methods belong to the modules `check-hydration.ts` lists with their reason.
- Server-rendered date text names a literal locale and a `timeZone`. `~/utils/dateFormat` does this; an approved raw formatter must too, unless the surface renders after interaction.
- `StaleText` carries the one `suppressHydrationWarning` in the app and accepts text only. React keeps the server's text until a later render changes the value, so suppression cannot show the visitor's zone: render a local-zone time after mount or in UTC.
- A form default seeded from the page clock follows the clock after hydration while a value the reader picked stays. Derive the shown value from the selection when there is one, else from the live default (`useDateRangeValidation`).
- Prove the whole path with `renderHydrated`; `docs/testing.md`, "Clock and hydration", covers how.
