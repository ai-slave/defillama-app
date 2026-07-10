import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { DialogForm } from '~/components/DialogForm'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { Menu } from '~/components/Menu'
import { selectTriggerStyles } from '~/components/Select/types'
import { ColumnFilters } from '~/containers/Yields/Filters/ColumnFilters'
import { ALL_POOL_COLUMN_QUERY_KEYS } from '~/containers/Yields/Filters/poolColumns'
import { mapPoolToYieldTableRow } from '~/containers/Yields/poolsPipeline'
import { useHolderStats, useVolatility } from '~/containers/Yields/queries.client'
import { YieldsPoolsTable } from '~/containers/Yields/Tables/Pools'
import { DEFAULT_PORTFOLIO_NAME } from '~/contexts/LocalStorage'
import { useBookmarks } from '~/hooks/useBookmarks'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'

export function YieldsWatchlistContainer({ protocolsDict }) {
	const isClient = useIsClient()
	const { portfolios, selectedPortfolio, savedProtocols, addPortfolio, removePortfolio, setSelectedPortfolio } =
		useBookmarks('yields')
	const { data: volatility } = useVolatility()
	const savedPoolIds = useMemo(() => {
		if (!isClient) return undefined
		const ids: string[] = []
		for (const pool of protocolsDict) {
			if (savedProtocols.has(pool.pool)) ids.push(pool.pool)
		}
		return ids
	}, [isClient, protocolsDict, savedProtocols])
	const { data: holderStats } = useHolderStats(savedPoolIds)

	const filteredProtocols = useMemo(() => {
		if (isClient) {
			const rows = []
			for (const pool of protocolsDict) {
				if (savedProtocols.has(pool.pool)) rows.push(mapPoolToYieldTableRow(pool, { volatility, holderStats }))
			}
			return rows
		} else return []
	}, [isClient, savedProtocols, protocolsDict, volatility, holderStats])
	const [open, setOpen] = useState(false)

	return (
		<>
			<WatchListTabs />
			<div className="rounded-md border border-(--legacy-cards-border) bg-(--legacy-cards-bg)">
				<div className="flex flex-wrap items-center gap-2 p-2">
					<h1 className="mr-auto heading-xs">Saved Pools</h1>
					<Menu
						name={selectedPortfolio}
						options={portfolios}
						onItemClick={(value) => {
							setSelectedPortfolio(value)
						}}
						className={`${selectTriggerStyles('filter-responsive', 'md')} min-w-[100px]`}
						popoverVariant="legacy"
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
						type="button"
						onClick={() => setOpen(true)}
						size="md"
						title="Create new portfolio"
						data-umami-event="yields-watchlist-portfolio-create"
					>
						<Icon name="folder-plus" height={16} width={16} />
						<span>New</span>
					</Button>
					{selectedPortfolio !== DEFAULT_PORTFOLIO_NAME ? (
						<button
							type="button"
							onClick={() => removePortfolio(selectedPortfolio)}
							className="flex min-h-8 items-center gap-1 rounded-lg border border-data-down px-3 py-1.5 label-sm text-data-down hover:bg-hover-row focus-visible:bg-hover-row"
							title="Delete current portfolio"
							data-umami-event="yields-watchlist-portfolio-delete"
						>
							<Icon name="trash-2" height={16} width={16} />
							<span>Delete</span>
						</button>
					) : null}
					<ColumnFilters enabledColumns={ALL_POOL_COLUMN_QUERY_KEYS} />
				</div>

				{filteredProtocols.length ? (
					<YieldsPoolsTable data={filteredProtocols} />
				) : (
					<p className="flex flex-1 items-center justify-center rounded-md border border-(--legacy-cards-border) bg-(--legacy-cards-bg) p-5">
						You have not saved any pools.
					</p>
				)}
			</div>
		</>
	)
}

export const WatchListTabs = () => {
	const router = useRouter()
	const isTokensTab = router.pathname === '/watchlist' && router.query.tab === 'tokens'
	return (
		<nav className="relative flex w-full max-w-fit items-center gap-2 border-b border-subtle">
			<BasicLink
				href={'/watchlist'}
				data-active={router.pathname === '/watchlist' && !isTokensTab}
				className="relative shrink-0 cursor-pointer px-3 py-2 label-md whitespace-nowrap text-tertiary after:absolute after:right-1 after:bottom-0 after:left-1 after:h-0.5 after:rounded-t-xs after:bg-brand after:opacity-0 hover:text-secondary focus-visible:text-secondary data-[active=true]:text-primary data-[active=true]:after:opacity-100"
			>
				DeFi
			</BasicLink>

			<BasicLink
				href={'/yields/watchlist'}
				data-active={router.pathname === '/yields/watchlist'}
				className="relative shrink-0 cursor-pointer px-3 py-2 label-md whitespace-nowrap text-tertiary after:absolute after:right-1 after:bottom-0 after:left-1 after:h-0.5 after:rounded-t-xs after:bg-brand after:opacity-0 hover:text-secondary focus-visible:text-secondary data-[active=true]:text-primary data-[active=true]:after:opacity-100"
			>
				Yields
			</BasicLink>

			<BasicLink
				href={'/watchlist?tab=tokens'}
				data-active={isTokensTab}
				className="relative shrink-0 cursor-pointer px-3 py-2 label-md whitespace-nowrap text-tertiary after:absolute after:right-1 after:bottom-0 after:left-1 after:h-0.5 after:rounded-t-xs after:bg-brand after:opacity-0 hover:text-secondary focus-visible:text-secondary data-[active=true]:text-primary data-[active=true]:after:opacity-100"
			>
				Tokens
			</BasicLink>
		</nav>
	)
}
