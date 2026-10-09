# Pickers

The pickers in this folder share one surface (`ComboboxSurface` in `src/ui/PopoverSurface.tsx`), one trigger (`ComboboxSelectTrigger`) and the row and check recipes in `src/ui/Popover.ts`. Where a selection lives, the URL or local state, is decided in `docs/charts.md` and the headers of `query.ts` and `localSelection.ts`.

## Which picker

| To do this                                           | Use                                                                            | Example                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Pick from a short list shown whole                   | `Select`                                                                       | `src/containers/RWA/OverviewChartPanel.tsx`                                                             |
| Pick one or many from a list that may need a search  | `SelectWithCombobox`                                                           | `src/containers/Token/TokenUsageSection.tsx`                                                            |
| Offer preset selections (Only EVM chains)            | `quickActions` on `SelectWithCombobox`                                         | `src/containers/Yields/Filters/Chains.tsx`                                                              |
| Pick from a long list (protocols, chains, tokens)    | `VirtualizedSelect`, `VirtualizedMultiSelect`                                  | `src/containers/ProDashboard/components/ComparisonWizard/steps/SelectItemsStep.tsx`                     |
| Cap how many options can be picked                   | `maxSelections` on `VirtualizedMultiSelect`                                    | `src/containers/ProDashboard/components/AddChartModal/UnifiedTableTab/components/SimpleTableConfig.tsx` |
| Search with the input on the page and picks as chips | `MultiSelectCombobox` (`search-results` surface)                               | `src/containers/Exchanges/ExchangeTokenFinder.tsx`                                                      |
| Keep the selection in the URL                        | `includeQueryKey` + `excludeQueryKey`; read rows with `readSelectionFromQuery` | `query.ts`                                                                                              |
| Keep a selection that only changes one chart         | `useLocalSelection` with a `scope`                                             | `localSelection.ts`                                                                                     |

## Triggers

- Callers choose the trigger `variant` and `size`; product surfaces pin their own values instead of inheriting a default.
- The trigger's `className` appends placement and layout classes (`ml-auto`, `w-full`, `flex-1`). `triggerProps` cannot carry a `className`, because replacing the trigger's classes would override its `variant` and `size`.
- Every trigger is `ComboboxSelectTrigger`, so Escape on an open list closes only the list, inside a dialog too.
- A trigger is named `{label} dropdown` unless `triggerProps` gives it an `id`: inside a `Field` the visible label names it, so never also pass an `aria-label` there. With `labelType="none"`, an empty single pick shows its `label` as a tertiary placeholder.

## Search and sheet height

- `isSearchable` in `searchThreshold.ts` decides for `SelectWithCombobox` and the virtualized pickers: below 12 options there is no search field and the phone drawer hugs its rows (`panel`); from 12 options, or with a server search, a search field sits in the reserved-height `list` sheet. `Select` never searches.
- Nested filter menus keep their search and full height, because a nested flyout covers its parent sheet.
- A list opens scrolled to its last selected option, which is Ariakit's behavior; multi-selects keep it too.

## Select all and caps

- A multi-select list leads with the tri-state "Select all" row (`SelectAll.tsx`): checked when every option is selected, a brand dash when some are, empty when none. A click selects all unless all are selected, then clears.
- With a search typed and `selectAllScope="matches"`, the row reads "Select all shown" and acts on the shown options.
- `quickActions` render as link-colored rows under Select all. There are no separate Select All / Deselect All buttons.
- A capped list (`maxSelections`) says "N of M picked" under its search field, leads with Select all only while every option in view fits under the cap, and at the cap disables the rest with the reason.

## Long lists

Never build a long list from a plain input over buttons, or cap it with `slice()`. Use the virtualized pickers; their header in `VirtualizedSelect.tsx` covers measured rows, trigger variants and server search.

An option with `muted: true` is drawn on the secondary tier: a value the page's current settings leave out, still selectable, with its `help` saying what brings it back.

An option with `disabled: true` stays in the list but cannot be picked: arrow keys still reach it, so a screen reader announces it as unavailable, and its `help` shows under the name as the reason ("Invite the bot to this private channel"). Select all and a URL selection's full set leave it out. A picker never drops an option the reader would look for; it disables it and says why.
