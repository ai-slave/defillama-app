// Lists this short are read at a glance, so pickers open them without a search field, in a drawer that hugs its rows
// (design.md → Popover surface: a search from 12).
const SEARCH_FROM = 12

export function isSearchable(optionCount: number, serverSearch: boolean) {
	return serverSearch || optionCount >= SEARCH_FROM
}
