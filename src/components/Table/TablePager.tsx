import { Select } from '~/components/Select/Select'
import { Button } from '~/ui/Button'
import { focusRegionOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber } from '~/utils/numberFormat'

/** The pager under every paginated table or grid: first, previous, next and last, the page or row range between them,
    and an optional Rows per page select. The owner keeps the page state and wraps `onPageChange` in a transition or
    URL push as it needs.

    Each button disables itself at the end it moves to and keeps focus while disabled. A pager that leaves while one of
    its buttons has focus (a failed page replaces the list and its pager, a filter empties it) hands focus to the
    region around it. Trade-off: it does not remember the page count through a failure, so the reader pages again
    once Try again restores the list. */
export function TablePager({
	pageIndex,
	pageCount,
	onPageChange,
	range,
	pageSize,
	disabled = false,
	className
}: {
	pageIndex: number
	pageCount: number
	onPageChange: (pageIndex: number) => void
	/** "41–60 of 340" in place of "Page 3 of 17", where the reader counts rows rather than pages. */
	range?: { from: number; to: number; total: number }
	/** Omitted where the page size is fixed. */
	pageSize?: { value: number; options: ReadonlyArray<number>; onChange: (pageSize: number) => void }
	disabled?: boolean
	/** Placement only: a table footer's border and padding, a grid's centering. */
	className?: string
}) {
	const showNavigation = pageCount > 1
	if (!showNavigation && !pageSize) return null
	const lastPage = pageCount - 1
	const label = range
		? `${formatNumber(range.from)}–${formatNumber(range.to)} of ${formatNumber(range.total)}`
		: `Page ${Math.min(pageIndex, lastPage) + 1} of ${Math.max(1, pageCount)}`

	return (
		<div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`.trim()}>
			{showNavigation ? (
				<div className="flex items-center gap-2">
					<PagerButton
						label="Go to first page"
						icon="chevrons-left"
						onClick={() => onPageChange(0)}
						disabled={disabled || pageIndex <= 0}
					/>
					<PagerButton
						label="Go to previous page"
						icon="chevron-left"
						onClick={() => onPageChange(pageIndex - 1)}
						disabled={disabled || pageIndex <= 0}
					/>
					<span className="body-sm text-secondary tabular-nums">{label}</span>
					<PagerButton
						label="Go to next page"
						icon="chevron-right"
						onClick={() => onPageChange(pageIndex + 1)}
						disabled={disabled || pageIndex >= lastPage}
					/>
					<PagerButton
						label="Go to last page"
						icon="chevrons-right"
						onClick={() => onPageChange(lastPage)}
						disabled={disabled || pageIndex >= lastPage}
					/>
				</div>
			) : null}
			{pageSize ? (
				<Select
					allValues={pageSize.options.map(String)}
					selectedValues={String(pageSize.value)}
					setSelectedValues={(value) => pageSize.onChange(Number(value))}
					label="Rows per page"
					labelType="regular"
					variant="filter"
					size="md"
					placement="top-end"
					className="ml-auto"
					triggerProps={{ disabled }}
				/>
			) : null}
		</div>
	)
}

function PagerButton({
	label,
	icon,
	onClick,
	disabled
}: {
	label: string
	icon: 'chevrons-left' | 'chevron-left' | 'chevron-right' | 'chevrons-right'
	onClick: () => void
	disabled: boolean
}) {
	return (
		<Tooltip
			content={label}
			render={
				<Button
					ref={focusRegionOnLeave}
					type="button"
					aria-label={label}
					onClick={onClick}
					disabled={disabled}
					accessibleWhenDisabled
					variant="secondary"
					size="md"
					square
				/>
			}
		>
			<Icon name={icon} className="size-4" />
		</Tooltip>
	)
}
