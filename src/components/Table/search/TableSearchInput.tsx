import { useSelector } from '@tanstack/react-store'
import { useDeferredValue, useEffect, useState } from 'react'
import { searchFieldWrapperStyles } from '~/ui/Input'
import { SearchField } from '~/ui/SearchField'
import { useSearchTableScope } from './context'

/**
 * Search input for a `SearchTableProvider` column.
 *
 * - The draft text updates urgently; a deferred copy applies it to the table filter after the input commit.
 * - Filter changes carry the provider's change counter, because TanStack suppresses equal state updates and a
 *   reset of an already-empty filter must still cancel pending text.
 * - An external reset or replacement supersedes the draft; acknowledging the input's own write keeps newer typing.
 * - A column missing from dynamic column definitions leaves the filter untouched instead of crashing.
 */
export function TableSearchInput({
	columnId,
	placeholder,
	className = searchFieldWrapperStyles
}: {
	columnId: string
	placeholder: string
	className?: string
}) {
	const { table, filterChanges } = useSearchTableScope()
	const change = useSelector(filterChanges)
	const filters = useSelector(table.atoms.columnFilters)
	const appliedFilter = filters.find((filter) => filter.id === columnId)
	const appliedValue = (appliedFilter?.value as string | undefined) ?? ''
	// Keep urgent text separate from applied filters. The snapshot identifies external
	// changes, including resetting an already-empty filter while typing is pending.
	const [draft, setDraft] = useState({ value: appliedValue, filters, columnId, change, pending: false })
	if (draft.filters !== filters || draft.columnId !== columnId || draft.change !== change) {
		const previousFilter = draft.filters.find((filter) => filter.id === columnId)
		const reset =
			draft.columnId !== columnId ||
			previousFilter !== appliedFilter ||
			filters.length === 0 ||
			(draft.change !== change && draft.filters === filters)
		setDraft({
			value: reset ? appliedValue : draft.value,
			filters,
			columnId,
			change,
			pending: reset ? false : draft.pending
		})
	}
	const deferred = useDeferredValue(draft)
	useEffect(() => {
		if (
			!deferred.pending ||
			filterChanges.get() !== deferred.change ||
			deferred !== draft ||
			deferred.columnId !== columnId ||
			table.atoms.columnFilters.get() !== deferred.filters
		)
			return
		if (deferred.value === appliedValue) return
		// Dynamic column definitions may temporarily remove the searched column.
		const column = table.getColumn(columnId)
		if (!column) return
		column.setFilterValue(deferred.value)
		const nextFilters = table.atoms.columnFilters.get()
		// Acknowledge the external store write without discarding newer input.
		// oxlint-disable-next-line react/set-state-in-effect -- synchronize the draft with the store command just applied
		setDraft((current) =>
			current.filters === deferred.filters
				? {
						...current,
						filters: nextFilters,
						change: filterChanges.get(),
						pending: current === deferred ? false : current.pending
					}
				: current
		)
	}, [appliedValue, columnId, deferred, draft, filterChanges, table])
	return (
		<SearchField
			label={placeholder}
			value={draft.value}
			onChange={(value) =>
				setDraft({
					value,
					filters: table.atoms.columnFilters.get(),
					columnId,
					change: filterChanges.get(),
					pending: true
				})
			}
			placeholder={placeholder}
			className={className}
		/>
	)
}
