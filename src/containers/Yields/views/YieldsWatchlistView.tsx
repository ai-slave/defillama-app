import * as React from 'react'
import { DeletePortfolioButton } from '~/components/DeletePortfolioButton'
import { Menu } from '~/components/Menu'
import { NewPortfolioDialog } from '~/components/NewPortfolioDialog'
import { useBookmarks } from '~/hooks/useBookmarks'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { focusRegionOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { queryReadFailed } from '~/utils/query'
import { YIELD_EARN_DATASET_API, YIELD_EARN_PRIVATE_API } from '../constants'
import { resolveEarnColumnAccess } from '../Filters/columnOptions'
import { useYieldsPaginatedTable } from '../queries.client'
import { PaginatedYieldsPoolTable } from '../Tables/Pools'
import type { IYieldTableRow } from '../Tables/types'
import { useVerifiedAccess } from '../useVerifiedAccess'
import { WatchListTabs } from './WatchlistView'

// /yields/watchlist. Uses useBookmarks('yields') over the shared portfolio localStorage
// and the portfolio-management UI (named lists). The bookmarked earn pools are fetched in
// ONE request via the earn route's `id` filter (`?id=...&pageSize=all`) and rendered
// client-side with the pools table.

// Fetch the bookmarked pools by id in a single request; sort ids for a stable cache key.
function buildEarnByIdQueryString(ids: Array<string>): string | null {
	if (ids.length === 0) return null
	const params = new URLSearchParams()
	for (const id of [...ids].sort()) params.append('id', id)
	params.set('pageSize', 'all')
	return `?${params.toString()}`
}

export function YieldsWatchlistContainer() {
	const isClient = useIsClient()
	const { portfolios, selectedPortfolio, savedProtocols, addPortfolio, removePortfolio, setSelectedPortfolio } =
		useBookmarks('yields')

	const savedPoolIds = isClient ? Array.from(savedProtocols) : []
	const queryString = buildEarnByIdQueryString(savedPoolIds)

	const { hasAccess, isDenied } = useVerifiedAccess()
	const { defaultColumns } = resolveEarnColumnAccess({ hasAccess, initialVerifiedAccess: false, isDenied })
	const rowsQuery = useYieldsPaginatedTable<IYieldTableRow>(
		YIELD_EARN_DATASET_API,
		queryString,
		undefined,
		YIELD_EARN_PRIVATE_API
	)
	const rows = rowsQuery.data?.rows ?? []

	const [open, setOpen] = React.useState(false)
	const newButtonRef = React.useRef<HTMLButtonElement>(null)

	return (
		<>
			<WatchListTabs />
			<Panel padding="none">
				<PanelHeader>
					<PanelTitle as="h1">Saved Pools</PanelTitle>
					<Menu
						name={selectedPortfolio}
						options={portfolios}
						onItemClick={(value) => {
							setSelectedPortfolio(value)
						}}
						className="min-w-[100px]"
						data-umami-event="yields-watchlist-portfolio-switch"
					/>
					<NewPortfolioDialog open={open} setOpen={setOpen} portfolios={portfolios} onCreate={addPortfolio} />
					<Button
						ref={newButtonRef}
						onClick={() => setOpen(true)}
						variant="secondary"
						size="md"
						data-umami-event="yields-watchlist-portfolio-create"
					>
						<Icon name="folder-plus" className="size-3.5" />
						<span>New</span>
					</Button>
					<DeletePortfolioButton
						portfolio={selectedPortfolio}
						onDelete={removePortfolio}
						finalFocus={newButtonRef}
						umamiEvent="yields-watchlist-portfolio-delete"
					/>
				</PanelHeader>

				{savedPoolIds.length > 0 && queryReadFailed(rowsQuery) ? (
					<SurfaceBodyStatus variant="error" contentClassName="flex flex-col items-center gap-2">
						<p>Couldn&apos;t load your saved pools. They are still saved.</p>
						<Button
							ref={focusRegionOnLeave}
							size="sm"
							pendingLabel="Retrying…"
							pending={rowsQuery.isFetching}
							onClick={() => void rowsQuery.refetch()}
						>
							Try again
						</Button>
					</SurfaceBodyStatus>
				) : !isClient || (savedPoolIds.length > 0 && !rowsQuery.data) ? (
					<SurfaceBodyLoadingStatus label="Loading saved pools" />
				) : rows.length > 0 ? (
					<PaginatedYieldsPoolTable data={rows} appearance="embedded" defaultColumns={defaultColumns} />
				) : (
					<SurfaceBodyStatus variant="empty">You have not saved any pools.</SurfaceBodyStatus>
				)}
			</Panel>
		</>
	)
}
