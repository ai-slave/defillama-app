import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { DialogForm } from '~/components/DialogForm'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { Menu } from '~/components/Menu'
import { ColumnFilters } from '~/containers/Yields/Filters/ColumnFilters'
import { ALL_POOL_COLUMN_QUERY_KEYS } from '~/containers/Yields/Filters/poolColumns'
import { mapPoolToYieldTableRow } from '~/containers/Yields/poolsPipeline'
import { useHolderStats, useVolatility } from '~/containers/Yields/queries.client'
import { YieldsPoolsTable } from '~/containers/Yields/Tables/Pools'
import { DEFAULT_PORTFOLIO_NAME } from '~/contexts/LocalStorage'
import { useBookmarks } from '~/hooks/useBookmarks'
import { useIsClient } from '~/hooks/useIsClient'

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
			<div className="rounded-md border border-(--cards-border) bg-(--cards-bg)">
				<div className="flex flex-wrap items-center gap-2 p-2">
					<h1 className="mr-auto text-base font-semibold">Saved Pools</h1>
					<Menu
						name={selectedPortfolio}
						options={portfolios}
						onItemClick={(value) => {
							setSelectedPortfolio(value)
						}}
						className="relative flex min-w-[100px] cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-md border border-(--form-control-border) px-2 py-1.5 text-xs font-medium text-(--text-form) hover:bg-(--link-hover-bg) focus-visible:bg-(--link-hover-bg)"
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
					<button
						onClick={() => setOpen(true)}
						className="flex items-center gap-1 rounded-md border border-(--form-control-border) px-2 py-1.5 text-xs text-(--text-form) hover:bg-(--link-hover-bg) focus-visible:bg-(--link-hover-bg)"
						title="Create new portfolio"
						data-umami-event="yields-watchlist-portfolio-create"
					>
						<Icon name="folder-plus" height={14} width={14} />
						<span>New</span>
					</button>
					{selectedPortfolio !== DEFAULT_PORTFOLIO_NAME ? (
						<button
							onClick={() => removePortfolio(selectedPortfolio)}
							className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 focus-visible:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 dark:focus-visible:bg-red-900/20"
							title="Delete current portfolio"
							data-umami-event="yields-watchlist-portfolio-delete"
						>
							<Icon name="trash-2" height={14} width={14} />
							<span>Delete</span>
						</button>
					) : null}
					<ColumnFilters enabledColumns={ALL_POOL_COLUMN_QUERY_KEYS} />
				</div>

				{filteredProtocols.length ? (
					<YieldsPoolsTable data={filteredProtocols} />
				) : (
					<p className="flex flex-1 items-center justify-center rounded-md border border-(--cards-border) bg-(--cards-bg) p-5">
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
