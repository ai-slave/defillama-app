# URL state

A choice that decides which data a page or section shows keeps its value in the URL, so a reload, the back button and a shared link open the same view. A choice about how one chart draws that data, or how one reader scans a table, stays in React state.

A folder README that records a decision for its own pages wins over this page, such as Rewards keeping sort, search and pagination local in `src/containers/Rewards/README.md`. A list picker, whether it filters page data or picks one chart's series, follows `docs/charts.md` and the `src/components/Select/README.md` rules.

## Where a control's value lives

Example paths are under `src/containers/`.

| The control                                                                           | Value lives in | Example                                                                                                                                             |
| ------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Picks the metric, period, grouping, denomination or "Rank by" a page or section shows | The URL        | `groupBy` and `denomination` in `ProtocolOverview/ProtocolChartPanel.tsx`; `period` in `Equities/SectorsPage.tsx`; `rankBy` in `Equities/index.tsx` |
| Toggles rows in or out, or groups them: Hide tail, Tight windows only, By sector      | The URL        | `showTail` and `mapGroup` in `Equities/IndustriesPage.tsx`                                                                                          |
| Picks the entity, date or week in view                                                | The URL        | `week` in `Equities/EarningsCalendarPage.tsx`                                                                                                       |
| Switches one chart's type (line, area, bar, pie)                                      | State          | `view` in `ProtocolOverview/BreakdownCards.tsx`                                                                                                     |
| Sorts a table by a column header, sets its page size or page, or searches inside it   | State          | `usePaginatedTable` `initialState` in `Equities/SectorsPage.tsx`                                                                                    |
| Expands one card or row, opens a menu or popover, or tracks hover                     | State          | `expanded` in `EarningsDayPanel`                                                                                                                    |
| Holds a draft before submit, or search text whose result already lands in the URL     | State          | `searchQuery` in `Equities/EarningsCalendarPage.tsx`                                                                                                |

A column-header sort stays local and a "Rank by" control goes in the URL: the header reorders rows one reader is scanning, while "Rank by" names the ranking the section presents.

## How

- Read the value during render from `router.query`; the control's handler writes it with `pushShallowQuery` from `src/utils/routerQuery.ts` (`docs/effects.md`). Never mirror the URL into state.
- A pick from a fixed list finds the query value among the control's own options, so a missing or unknown value falls back to the default with no cast: `OPTIONS.find((option) => option.value === router.query.period)?.value ?? '1d'`. A toggle compares to its one value or uses `isTrueQueryParam`.
- The handler writes `undefined` for the default, so the plain route stays the default view and the canonical link.
- Reuse the key name a sibling page uses for the same choice, such as `mapSize` and `mapGroup` on the equities maps.
- A shallow push to the same route does not scroll, so a control halfway down the page stays in view.
- A static page renders the default first and the linked value after hydration; see "First render" in `docs/effects.md`.
- Test the reader through the real writer: click the control, then open the page with the query it pushed (`docs/testing.md`).
