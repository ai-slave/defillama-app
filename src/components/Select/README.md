# Selections

Where a picker's selection lives. The pickers themselves are parts in `src/ui` (design.md, "Which component for which job"), and take a value and its setter. `docs/charts.md` decides which home below a selection gets.

| To do this                                                                         | Use                                                                                                                             | Rules               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Keep a selection that filters page data, or must survive a reload or a shared link | `UrlSelect` / `UrlSelectWithCombobox` with `includeQueryKey` + `excludeQueryKey`; pages read rows with `readSelectionFromQuery` | `query.ts`          |
| Keep a selection that only changes what one chart draws                            | `useLocalSelection` with a `scope`, handed to the picker's `selectedValues` and `setSelectedValues`                             | `localSelection.ts` |
