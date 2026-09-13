import type { Atom } from '@tanstack/react-store'
import type { ReactTable, RowData } from '@tanstack/react-table'
import { createContext, useContext } from 'react'
import type { SearchTableFeatures } from '../features/search'

// Row types are checked at SearchTableProvider's options boundary. Context erases that type;
// consumers receive RowData and must keep row-dependent callbacks with the typed owner.
export const searchTableContext = createContext<{
	table: ReactTable<SearchTableFeatures, RowData, null>
	filterChanges: Atom<number>
} | null>(null)

export function useSearchTableScope() {
	const scope = useContext(searchTableContext)
	if (!scope) throw new Error('Search table controls must be rendered inside <SearchTableProvider>.')
	return scope
}

export function useSearchTableContext() {
	return useSearchTableScope().table
}
