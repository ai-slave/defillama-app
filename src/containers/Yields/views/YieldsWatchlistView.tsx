import * as React from 'react'
import { DialogForm } from '~/components/DialogForm'
import { Menu } from '~/components/Menu'
import { DEFAULT_PORTFOLIO_NAME } from '~/contexts/LocalStorage'
import { useBookmarks } from '~/hooks/useBookmarks'
import { useIsClient } from '~/hooks/useIsClient'
import { Button, buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { YIELD_EARN_DATASET_API } from '../constants'
import { useYieldsPaginatedTable } from '../queries.client'
import { PaginatedYieldsPoolTable } from '../Tables/Pools'
import type { IYieldTableRow } from '../Tables/types'
import { WatchListTabs } from './WatchlistView'

// /yields/watchlist. Uses useBookmarks('yields') over the shared portfolio localStorage
// and the portfolio-management UI (named lists). The bookmarked earn pools are fetched in
// ONE request via the earn route's `id` filter (`?id=...&pageSize=all`) and rendered
// client-side with the pools table.

// Fetch the bookmarked pools by id in a single request; sort ids for a stable cache key.
function buildEarnByIdQueryString(ids: string[]): string | null {
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

	const rowsQuery = useYieldsPaginatedTable<IYieldTableRow>(YIELD_EARN_DATASET_API, queryString)
	const rows = rowsQuery.data?.rows ?? []

	const [open, setOpen] = React.useState(false)

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
						className={`${buttonStyles({ variant: 'secondary', size: 'md' })} min-w-[100px] justify-between`}
						data-umami-event="yields-watchlist-portfolio-switch"
					/>
					<DialogForm
						title="New Portfolio"
						description="Enter the name of your new portfolio"
						open={open}
						setOpen={setOpen}
						onSubmit={addPortfolio}
					/>
					<Button
						onClick={() => setOpen(true)}
						variant="secondary"
						size="md"
						data-umami-event="yields-watchlist-portfolio-create"
					>
						<Icon name="folder-plus" className="size-3.5" />
						<span>New</span>
					</Button>
					{selectedPortfolio !== DEFAULT_PORTFOLIO_NAME ? (
						<Button
							onClick={() => removePortfolio(selectedPortfolio)}
							variant="destructive"
							size="md"
							data-umami-event="yields-watchlist-portfolio-delete"
						>
							<Icon name="trash-2" className="size-3.5" />
							<span>Delete</span>
						</Button>
					) : null}
				</PanelHeader>

				{!isClient || (savedPoolIds.length > 0 && rowsQuery.isLoading && !rowsQuery.data) ? (
					<SurfaceBodyLoadingStatus label="Loading saved pools" />
				) : rows.length > 0 ? (
					<PaginatedYieldsPoolTable data={rows} appearance="embedded" />
				) : (
					<SurfaceBodyStatus variant="empty">You have not saved any pools.</SurfaceBodyStatus>
				)}
			</Panel>
		</>
	)
}
