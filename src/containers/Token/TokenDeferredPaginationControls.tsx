import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
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

	return (
		<div className="flex flex-wrap items-center justify-between gap-2">
			<div className="flex items-center gap-2">
				<Button type="button" variant="ghost" square size="md" aria-label="Go to first page" disabled>
					<Icon name="chevrons-left" height={16} width={16} />
				</Button>
				<Button type="button" variant="ghost" square size="md" aria-label="Go to previous page" disabled>
					<Icon name="chevron-left" height={16} width={16} />
				</Button>
				<span className="label-sm text-secondary">{`Page 1 of ${pageCount}`}</span>
				<Button
					type="button"
					variant="ghost"
					square
					size="md"
					aria-label="Go to next page"
					onClick={() => onRequestPage(1)}
					disabled={isLoading}
					accessibleWhenDisabled
				>
					<Icon name="chevron-right" height={16} width={16} />
				</Button>
				<Button
					type="button"
					variant="ghost"
					square
					size="md"
					aria-label="Go to last page"
					onClick={() => onRequestPage(pageCount - 1)}
					disabled={isLoading}
					accessibleWhenDisabled
				>
					<Icon name="chevrons-right" height={16} width={16} />
				</Button>
			</div>
			{isLoading ? (
				<div className="flex items-center gap-2 label-sm text-secondary">
					<LoadingSpinner size={12} />
					<span>Loading full table...</span>
				</div>
			) : null}
		</div>
	)
}
