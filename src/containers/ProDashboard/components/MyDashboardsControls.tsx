import type { RefObject } from 'react'
import { Select } from '~/components/Select/Select'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tooltip } from '~/ui/Tooltip'
import { proInputStyles } from '../ui'
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
			<div className="relative w-full max-w-xs min-w-0">
				<Icon
					name="search"
					height={14}
					width={14}
					className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-pro-text-tertiary"
				/>
				<input
					ref={ref}
					type="text"
					aria-label="Search my dashboards"
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					placeholder="Search my dashboards…"
					className={`${proInputStyles} pr-8 pl-8`}
				/>
				{query ? (
					<Tooltip
						content="Clear search"
						render={
							<Button
								variant="ghost"
								size="sm"
								square
								aria-label="Clear search"
								// The button leaves with the text it clears; focus goes back to the search box.
								onClick={() =>
									keepFocus(
										() => onQueryChange(''),
										() => ref.current
									)
								}
								className="absolute top-1/2 right-1.5 -translate-y-1/2"
							/>
						}
					>
						<Icon name="x" height={16} width={16} />
					</Tooltip>
				) : null}
			</div>

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
						<span className="text-pro-text-tertiary">Sort by:</span>
						<span className="truncate">{selectedSort.name}</span>
					</>
				}
				labelType="none"
				triggerProps={{ 'aria-label': 'Sort my dashboards' }}
			/>
		</div>
	)
}
