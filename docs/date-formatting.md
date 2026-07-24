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

## Enforcement rules

- Do not re-export date formatters from `~/utils` or another barrel.
- Do not alias canonical imports or add wrappers that only supply a fallback.
- Keep a local formatter only when it owns documented domain semantics that the canonical API does not express.
- Date-only API fields must not shift a day in negative or positive UTC offsets.
- Exact instants must not lose their time.
- Display labels must not be reused for machine output.
- Invalid or missing values return `null`; the consumer chooses the appropriate UI copy.
- Raw `Intl.DateTimeFormat`, Date locale methods, and Day.js display formatting are limited to reviewed domain-owned paths.

`scripts/policies/check-date-formatting.ts` enforces these boundaries in CI. Its
allowlists are exceptions for the protected behavior above, not alternative generic
formatting APIs.
