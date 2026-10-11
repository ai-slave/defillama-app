import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { Select, type SelectBaseProps } from '~/ui/Select'
import { describeSelection, SelectWithCombobox, type SelectWithComboboxBaseProps } from '~/ui/SelectWithCombobox'
import { type ExcludeQueryKey, readSelectionFromQuery, updateQueryFromSelected } from './query'

/* Pickers whose selection lives in the URL. Each reads it with `readSelectionFromQuery`, the same reader pages use,
   and writes it through `updateQueryFromSelected`, so the checkmarks, rows, requests and exports all see one
   selection (the rules are in ./query.ts). Select all and "None" become the writer's own forms: no keys for the
   default, `include=None` for nothing. */

type UrlKeys = {
	includeQueryKey: string
	excludeQueryKey: ExcludeQueryKey
}

export function UrlSelect({ includeQueryKey, excludeQueryKey, ...props }: SelectBaseProps & UrlKeys) {
	const router = useRouter()
	// A disabled option can never be picked, so the full set leaves it out, as the writer does: an empty query never
	// selects it.
	const allKeys = useMemo(
		() => props.allValues.flatMap((v) => (typeof v === 'string' ? [v] : v.disabled ? [] : [v.key])),
		[props.allValues]
	)
	const selectedValues = useMemo(
		() => readSelectionFromQuery(router.query, includeQueryKey, excludeQueryKey, allKeys),
		[router.query, includeQueryKey, excludeQueryKey, allKeys]
	)
	return (
		<Select
			{...props}
			selectedValues={selectedValues}
			setSelectedValues={(values) => updateQueryFromSelected(router, includeQueryKey, excludeQueryKey, allKeys, values)}
		/>
	)
}

export function UrlSelectWithCombobox({
	includeQueryKey,
	excludeQueryKey,
	defaultSelectedValues,
	resetPageOnQueryChange,
	pushQueryUpdates,
	...props
}: SelectWithComboboxBaseProps &
	UrlKeys & {
		/** Rendered as selected while the URL holds no selection; defaults to every option. */
		defaultSelectedValues?: Array<string>
		resetPageOnQueryChange?: boolean
		pushQueryUpdates?: (updates: Record<string, string | Array<string> | undefined>) => void
	}) {
	const router = useRouter()
	const allKeys = useMemo(() => props.allValues.map((v) => (typeof v === 'string' ? v : v.key)), [props.allValues])
	const selectedValues = useMemo(
		() => readSelectionFromQuery(router.query, includeQueryKey, excludeQueryKey, allKeys, defaultSelectedValues),
		[router.query, includeQueryKey, excludeQueryKey, allKeys, defaultSelectedValues]
	)
	return (
		<SelectWithCombobox
			{...props}
			selectedValues={selectedValues}
			// The trigger says when nothing or "all except" is selected, so an active filter never looks like the default.
			selectedLabels={[describeSelection(props.allValues, selectedValues)]}
			setSelectedValues={(values) =>
				updateQueryFromSelected(router, includeQueryKey, excludeQueryKey, allKeys, values, defaultSelectedValues, {
					resetPage: resetPageOnQueryChange,
					pushQueryUpdates
				})
			}
		/>
	)
}
