import { Button } from '~/ui/Button'
import { focusRegionOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { DEFAULT_TABLE_PAGE_SIZE } from './tableUtils'

export function TokenDeferredPaginationControls({
	totalCount,
	pageSize = DEFAULT_TABLE_PAGE_SIZE,
	isLoading,
	onRequestPage
}: {
	totalCount: number
	pageSize?: number
	isLoading?: boolean
	onRequestPage: (pageIndex: number) => void
}) {
	const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))

	if (pageCount <= 1) return null

	// Next and Last load the full table, which replaces this pager with the table's own. The pager hands focus to the
	// section around it (a `tabIndex={-1}` region), which stays through the swap and an empty result alike.
	return (
		<div ref={focusRegionOnLeave} className="flex flex-wrap items-center justify-between gap-2">
			<div className="flex items-center gap-2">
				<Tooltip
					content="Go to first page"
					render={<Button type="button" variant="ghost" square size="md" aria-label="Go to first page" disabled />}
				>
					<Icon name="chevrons-left" height={16} width={16} />
				</Tooltip>
				<Tooltip
					content="Go to previous page"
					render={<Button type="button" variant="ghost" square size="md" aria-label="Go to previous page" disabled />}
				>
					<Icon name="chevron-left" height={16} width={16} />
				</Tooltip>
				<span className="label-sm text-secondary">{`Page 1 of ${pageCount}`}</span>
				<Tooltip
					content="Go to next page"
					render={
						<Button
							type="button"
							variant="ghost"
							square
							size="md"
							aria-label="Go to next page"
							onClick={() => onRequestPage(1)}
							disabled={isLoading}
							accessibleWhenDisabled
						/>
					}
				>
					<Icon name="chevron-right" height={16} width={16} />
				</Tooltip>
				<Tooltip
					content="Go to last page"
					render={
						<Button
							type="button"
							variant="ghost"
							square
							size="md"
							aria-label="Go to last page"
							onClick={() => onRequestPage(pageCount - 1)}
							disabled={isLoading}
							accessibleWhenDisabled
						/>
					}
				>
					<Icon name="chevrons-right" height={16} width={16} />
				</Tooltip>
			</div>
			{isLoading ? (
				<div className="flex items-center gap-2 label-sm text-secondary">
					<LoadingSpinner size={12} />
					<span>Loading full table…</span>
				</div>
			) : null}
		</div>
	)
}
