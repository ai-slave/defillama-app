import { batch, createAtom } from '@tanstack/react-store'
import {
	makeStateUpdater,
	type ColumnFiltersState,
	type OnChangeFn,
	type ReactTable,
	type RowData,
	type TableOptions
} from '@tanstack/react-table'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SearchTableFeatures } from '../features/search'
import { useSearchTable } from '../features/searchHook'
import { searchTableContext } from './context'

export type SearchTableOptions<T extends RowData> = Omit<TableOptions<SearchTableFeatures, T>, 'features'>

/** Own table state; controls and renderers subscribe where their output needs it. */
export function SearchTableProvider<T extends RowData>({
	options,
	children
}: {
	options: SearchTableOptions<T>
	children: ReactNode
}) {
	// Filter resets can be meaningful to pending input even when the stored value is unchanged.
	const [filterChanges] = useState(() => createAtom(0))
	const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
		batch(() => {
			const apply = options.onColumnFiltersChange ?? makeStateUpdater('columnFilters', table)
			apply(updater)
			filterChanges.set((version) => version + 1)
		})
	}
	const table = useSearchTable({ ...options, onColumnFiltersChange }, () => null)
	// AppTable reads an internal ref; an explicit value keeps option changes visible to React Compiler.
	return (
		<searchTableContext.Provider
			value={{ table: table as ReactTable<SearchTableFeatures, RowData, null>, filterChanges }}
		>
			{children}
		</searchTableContext.Provider>
	)
}
