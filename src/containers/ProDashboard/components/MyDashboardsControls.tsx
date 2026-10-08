import type { RefObject } from 'react'
import { Select } from '~/components/Select/Select'
import { SearchField } from '~/ui/SearchField'
import { SegmentedControl } from '~/ui/SegmentedControl'
import {
	isMyDashboardsSort,
	MY_DASHBOARDS_SORT_OPTIONS,
	MY_DASHBOARDS_VISIBILITY_OPTIONS,
	type MyDashboardsSort,
	type MyDashboardsVisibility
} from './myDashboardsControls.utils'

interface MyDashboardsControlsProps {
	/** The search input; the page hands focus to it when a control it removed (Clear filters) had focus. */
	ref: RefObject<HTMLInputElement | null>
	query: string
	sort: MyDashboardsSort
	visibility: MyDashboardsVisibility
	onQueryChange: (query: string) => void
	onSortChange: (sort: MyDashboardsSort) => void
	onVisibilityChange: (visibility: MyDashboardsVisibility) => void
}

export function MyDashboardsControls({
	ref,
	query,
	sort,
	visibility,
	onQueryChange,
	onSortChange,
	onVisibilityChange
}: MyDashboardsControlsProps) {
	const selectedSort = MY_DASHBOARDS_SORT_OPTIONS.find((option) => option.key === sort) ?? MY_DASHBOARDS_SORT_OPTIONS[0]

	return (
		<div className="flex flex-wrap items-center gap-2">
			<SearchField
				ref={ref}
				label="Search my dashboards"
				value={query}
				onChange={onQueryChange}
				placeholder="Search my dashboards…"
				className="w-full max-w-xs min-w-0"
			/>

			<SegmentedControl
				variant="default"
				options={MY_DASHBOARDS_VISIBILITY_OPTIONS}
				label="Visibility"
				value={visibility}
				onValueChange={onVisibilityChange}
				size="md"
			/>
			<Select
				heading="Sort by"
				variant="filter"
				size="md"
				allValues={MY_DASHBOARDS_SORT_OPTIONS}
				selectedValues={selectedSort.key}
				setSelectedValues={(value: string) => {
					if (isMyDashboardsSort(value)) onSortChange(value)
				}}
				label={
					<>
						<span className="text-tertiary">Sort by:</span>
						<span className="truncate">{selectedSort.name}</span>
					</>
				}
				labelType="none"
				triggerProps={{ 'aria-label': 'Sort my dashboards' }}
			/>
		</div>
	)
}
