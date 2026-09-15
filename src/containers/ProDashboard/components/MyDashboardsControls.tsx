import { useEffect, useRef, useState } from 'react'
import { Select } from '~/components/Select/Select'
import { Icon } from '~/ui/Icon'
import { ProSegmented, proInputStyles } from '../ui'
import {
	isMyDashboardsSort,
	MY_DASHBOARDS_SORT_OPTIONS,
	MY_DASHBOARDS_VISIBILITY_OPTIONS,
	type MyDashboardsSort,
	type MyDashboardsVisibility
} from './myDashboardsControls.utils'

const SEARCH_DEBOUNCE_MS = 200

interface MyDashboardsControlsProps {
	query: string
	sort: MyDashboardsSort
	visibility: MyDashboardsVisibility
	onQueryChange: (query: string) => void
	onSortChange: (sort: MyDashboardsSort) => void
	onVisibilityChange: (visibility: MyDashboardsVisibility) => void
}

export function MyDashboardsControls({
	query,
	sort,
	visibility,
	onQueryChange,
	onSortChange,
	onVisibilityChange
}: MyDashboardsControlsProps) {
	const [draft, setDraft] = useState(query)
	const publishedRef = useRef(query)
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		if (query === publishedRef.current) return
		publishedRef.current = query
		setDraft(query)
	}, [query])

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current)
		}
	}, [])

	const publish = (value: string) => {
		publishedRef.current = value
		onQueryChange(value)
	}

	const handleChange = (value: string) => {
		setDraft(value)
		if (timeoutRef.current) clearTimeout(timeoutRef.current)
		timeoutRef.current = setTimeout(() => publish(value), SEARCH_DEBOUNCE_MS)
	}

	const handleClear = () => {
		setDraft('')
		if (timeoutRef.current) clearTimeout(timeoutRef.current)
		publish('')
	}

	const selectedSort = MY_DASHBOARDS_SORT_OPTIONS.find((option) => option.key === sort) ?? MY_DASHBOARDS_SORT_OPTIONS[0]

	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="relative w-full max-w-xs min-w-0">
				<Icon
					name="search"
					height={14}
					width={14}
					className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-pro-text-tertiary"
				/>
				<input
					type="text"
					aria-label="Search my dashboards"
					value={draft}
					onChange={(event) => handleChange(event.target.value)}
					placeholder="Search my dashboards…"
					className={`${proInputStyles} pr-8 pl-8`}
				/>
				{draft ? (
					<button
						type="button"
						onClick={handleClear}
						className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-pro-text-tertiary transition-colors hover:bg-pro-hover-fill hover:text-pro-text-primary"
					>
						<Icon name="x" height={12} width={12} />
						<span className="sr-only">Clear search</span>
					</button>
				) : null}
			</div>

			<ProSegmented
				options={MY_DASHBOARDS_VISIBILITY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
				label="Visibility"
				value={visibility}
				onValueChange={onVisibilityChange}
				size="md"
			/>
			<Select
				variant="pro"
				size="md"
				allValues={MY_DASHBOARDS_SORT_OPTIONS}
				selectedValues={selectedSort.key}
				setSelectedValues={(value: string) => {
					if (isMyDashboardsSort(value)) onSortChange(value)
				}}
				label={
					<>
						<span className="text-pro-text-tertiary">Sort by:</span>
						<span className="truncate">{selectedSort.name}</span>
					</>
				}
				labelType="none"
				popoverVariant="legacy"
				triggerProps={{ 'aria-label': 'Sort my dashboards' }}
			/>
		</div>
	)
}
