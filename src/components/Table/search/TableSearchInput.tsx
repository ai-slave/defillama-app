import { useSelector } from '@tanstack/react-store'
import { useDeferredValue, useEffect, useState } from 'react'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles, searchFieldWrapperStyles } from '~/ui/Input'
import { useSearchTableScope } from './context'

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
		<label className={className}>
			<span className="sr-only">{placeholder}</span>
			<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
			<Input
				value={draft.value}
				onInput={(event) =>
					setDraft({
						value: event.currentTarget.value,
						filters: table.atoms.columnFilters.get(),
						columnId,
						change: filterChanges.get(),
						pending: true
					})
				}
				placeholder={placeholder}
				className={searchFieldInputPlacementStyles}
			/>
		</label>
	)
}
