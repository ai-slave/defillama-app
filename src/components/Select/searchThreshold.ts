// Lists this short are read at a glance, so pickers open them without a search field, in a drawer that hugs its rows
// (`panel`). From 12 options, or with a server search, they show a search field in the reserved-height `list` sheet.
// SelectWithCombobox and VirtualizedSelect decide through this one rule; Select never searches.
const SEARCH_FROM = 12

export function isSearchable(optionCount: number, serverSearch: boolean) {
	return serverSearch || optionCount >= SEARCH_FROM
}
