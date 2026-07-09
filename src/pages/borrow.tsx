import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import * as React from 'react'
import { Announcement } from '~/components/Announcement'
import { Icon } from '~/components/Icon'
import { TokenLogo } from '~/components/TokenLogo'
import { buildBorrowRowsQueryString, type BorrowPageRow } from '~/containers/Yields/borrowSimple'
import { disclaimer } from '~/containers/Yields/constants'
import { useBorrowRows } from '~/containers/Yields/queries.client'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { inputStyles } from '~/ui/Input'
import {
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName,
	popoverRowStyles,
	popoverSearchBlockWithBottomPaddingStyles,
	popoverSeeMoreStyles,
	popoverSingleSelectCheckStyles,
	popoverSurfaceStyles
} from '~/ui/Popover'
import { Switch } from '~/ui/Switch'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { getQueryValue, pushShallowQuery } from '~/utils/routerQuery'

export const getStaticProps = withPerformanceLogging('borrow', async () => {
	const { getBorrowPageMetadata } = await import('~/containers/Yields/server/dataset')
	const metadata = await getBorrowPageMetadata()

	return {
		props: metadata,
		revalidate: maxAgeForNext([23])
	}
})

const pageName = ['Borrow Aggregator: Simple']

export default function YieldBorrow(data) {
	const router = useRouter()

	const includeIncentives = router.query['incentives'] === 'true'

	const borrowToken = getQueryValue(router.query, 'borrow')

	const collateralToken = getQueryValue(router.query, 'collateral')
	const rowsQueryString = React.useMemo(() => buildBorrowRowsQueryString(router.query), [router.query])
	const { data: rowsData, isLoading, isError } = useBorrowRows(rowsQueryString)
	const filteredPools = rowsData?.rows ?? []

	const handleSwap = () => {
		const newBorrow = collateralToken ?? ''
		const newCollateral = borrowToken ?? ''

		void pushShallowQuery(router, {
			borrow: newBorrow || undefined,
			collateral: newCollateral || undefined
		})
	}

	const hasSelection = borrowToken || collateralToken

	return (
		<Layout
			title="Borrow Rate Aggregator - Best DeFi Lending Rates - DefiLlama"
			description="Find optimal DeFi lending and borrowing routes. Compare borrow rates across Aave, Compound, Morpho, and 50+ lending protocols. Calculate net APY with collateral on Ethereum, Solana, and all major chains."
			canonicalUrl={`/borrow`}
			pageName={pageName}
		>
			<Announcement announcementId="yields-disclaimer" version="2026-03">
				{disclaimer}
			</Announcement>
			<div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-start">
				<Card className="w-full shrink-0 lg:w-[340px]" padding="none">
					<div className="relative flex flex-col p-4">
						<TokensSelect
							label="Borrow"
							searchData={data.searchData}
							queryParam={'borrow'}
							placeholder="Select token to borrow"
						/>

						<div className="relative z-10 flex items-center justify-center pt-2">
							<button
								aria-label="Swap borrow and collateral"
								onClick={handleSwap}
								className="inline-flex size-8 items-center justify-center rounded-full border border-medium bg-surface text-tertiary transition-all hover:scale-105 hover:border-brand hover:text-link focus-visible:border-brand focus-visible:text-link active:scale-95"
								title="Swap borrow and collateral"
							>
								<Icon name="repeat" className="size-4" />
							</button>
						</div>

						<TokensSelect
							label="Collateral"
							searchData={data.searchData}
							queryParam={'collateral'}
							placeholder="Select token for collateral"
						/>
					</div>

					{borrowToken && !collateralToken ? (
						<p className="border-t border-subtle px-4 py-2.5 text-center body-sm text-(--warning)">
							Select collateral to see real borrow cost
						</p>
					) : null}

					{hasSelection ? (
						<div className="border-t border-subtle px-4 py-3 hover:bg-hover-row">
							<Switch
								label="Include Incentives"
								value="includeIncentives"
								checked={includeIncentives}
								onChange={() => {
									void pushShallowQuery(router, { incentives: includeIncentives ? undefined : 'true' })
								}}
								className="flex-row-reverse justify-between"
							/>
						</div>
					) : null}
				</Card>

				<div className="min-w-0 flex-1">
					{hasSelection && isLoading && !rowsData ? (
						<div
							role="status"
							className="flex flex-1 items-center justify-center rounded-[8px] border border-subtle bg-surface p-5 body-sm text-secondary"
						>
							<p className="text-tertiary">Loading borrow routes...</p>
						</div>
					) : hasSelection && isError ? (
						<div
							role="alert"
							className="flex flex-1 items-center justify-center rounded-[8px] border border-subtle bg-surface p-5 body-sm text-secondary"
						>
							<p className="text-data-down">Couldn't load borrow routes.</p>
						</div>
					) : hasSelection ? (
						<PoolsList pools={filteredPools} />
					) : (
						<div className="flex flex-col items-center justify-center rounded-[8px] border border-subtle bg-surface px-6 py-16 text-center">
							<p className="body-sm text-secondary">
								Select a token to borrow and collateral to compare rates across protocols
							</p>
						</div>
					)}
				</div>
			</div>
		</Layout>
	)
}

const TokensSelect = ({
	searchData,
	label,
	queryParam,
	placeholder
}: {
	searchData: { [token: string]: { name: string; symbol: string; image: string; image2: string } }
	label: string
	queryParam: string
	placeholder: string
}) => {
	const router = useRouter()

	const onChange = (value) => {
		void pushShallowQuery(router, { [queryParam]: value || undefined }, '/borrow')
	}

	const selectedValue: string = getQueryValue(router.query, queryParam) ?? ''

	const tokenInSearchData = selectedValue !== '' ? searchData[selectedValue.toUpperCase()] : null

	const searchDataArray = Object.values(searchData)

	const [searchValue, setSearchValue] = React.useState('')
	const matches = React.useMemo(() => {
		if (!searchValue) return searchDataArray
		return matchSorter(searchDataArray, searchValue, {
			keys: ['name', 'symbol'],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [searchDataArray, searchValue])

	const [viewableMatches, setViewableMatches] = React.useState(20)

	const comboboxRef = React.useRef<HTMLDivElement>(null)

	const handleSeeMore = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.stopPropagation()
		const previousCount = viewableMatches
		setViewableMatches((prev) => prev + 20)

		// Focus on the first newly loaded item after a brief delay
		setTimeout(() => {
			const items = comboboxRef.current?.querySelectorAll('[role="option"]')
			if (items && items.length > previousCount) {
				const firstNewItem = items[previousCount] as HTMLElement
				firstNewItem?.focus()
			}
		}, 0)
	}

	return (
		<div className="flex w-full flex-col gap-1">
			<Ariakit.ComboboxProvider
				resetValueOnHide
				setValue={(value) => {
					React.startTransition(() => {
						setSearchValue(value)
					})
				}}
			>
				<Ariakit.SelectProvider value={selectedValue} setValue={onChange}>
					<Ariakit.SelectLabel className="label-xs tracking-widest text-tertiary uppercase">
						{label}
					</Ariakit.SelectLabel>
					<Ariakit.Select
						className={`group hover-wash flex cursor-pointer flex-nowrap items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-all ${
							tokenInSearchData
								? 'border border-brand bg-brand-muted font-semibold text-primary'
								: 'border border-medium bg-page text-tertiary'
						} focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand/30`}
					>
						{tokenInSearchData ? (
							<span className="truncate">
								{tokenInSearchData.symbol === 'USD_STABLES' ? tokenInSearchData.name : tokenInSearchData.symbol}
							</span>
						) : (
							<span>{placeholder}</span>
						)}
						<Icon
							name="chevron-down"
							className="ml-auto size-4 shrink-0 opacity-40 transition-transform group-aria-expanded:rotate-180"
						/>
					</Ariakit.Select>
					<Ariakit.SelectPopover
						unmountOnHide
						hideOnInteractOutside
						sameWidth
						gutter={4}
						wrapperProps={{
							className: popoverMobileWrapperClassName
						}}
						className={popoverSurfaceStyles}
						portal
					>
						<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
							<Icon name="x" className="size-5" />
						</Ariakit.PopoverDismiss>

						<div className={popoverSearchBlockWithBottomPaddingStyles}>
							<Ariakit.Combobox placeholder="Search tokens..." className={`w-full ${inputStyles}`} />
						</div>

						{matches.length > 0 ? (
							<Ariakit.ComboboxList ref={comboboxRef}>
								{matches.slice(0, viewableMatches).map((option) => (
									<Ariakit.SelectItem
										key={`${queryParam}-${option.symbol}`}
										value={option.symbol}
										className={popoverRowStyles}
										render={<Ariakit.ComboboxItem />}
									>
										<span className="truncate">
											{option.symbol === 'USD_STABLES' ? searchData[option.symbol].name : option.symbol}
										</span>
										{option.symbol === selectedValue ? (
											<span className={popoverSingleSelectCheckStyles(true)} aria-hidden>
												<Icon name="check" className="size-3" />
											</span>
										) : null}
									</Ariakit.SelectItem>
								))}
								{matches.length > viewableMatches ? (
									<Ariakit.ComboboxItem
										value="__see_more__"
										setValueOnClick={false}
										hideOnClick={false}
										className={popoverSeeMoreStyles}
										onClick={handleSeeMore}
									>
										See more...
									</Ariakit.ComboboxItem>
								) : null}
							</Ariakit.ComboboxList>
						) : (
							<p className="px-3 py-6 text-center body-sm text-tertiary">No results found</p>
						)}
					</Ariakit.SelectPopover>
				</Ariakit.SelectProvider>
			</Ariakit.ComboboxProvider>
		</div>
	)
}

const safeProjects = [
	'AAVE',
	'AAVE V2',
	'AAVE V3',
	'AAVE V1',
	'MakerDAO',
	'Sky',
	'Spark',
	'Compound',
	'Compound V1',
	'Compound V2',
	'Compound V3'
].map((x) => x.toLowerCase())

const getAPY = (
	pool: BorrowPageRow,
	borrow: string | string[],
	collateral: string | string[],
	incentives: string | string[]
): number => {
	const withIncentives = incentives === 'true'

	const supplyApy = withIncentives ? pool.apy : pool.apyBase
	const borrowApy = withIncentives ? pool.borrow.apyBorrow : pool.borrow.apyBaseBorrow

	if (borrow && collateral) {
		return supplyApy + borrowApy * pool.ltv
	}

	// borrow only
	if (borrow) {
		return borrowApy ?? 0
	}

	// supply only
	return supplyApy ?? 0
}

const PoolsList = ({ pools }: { pools: Array<BorrowPageRow> }) => {
	const [tab, setTab] = React.useState('safe')

	const filteredPools = pools
		.filter(
			(pool) =>
				(tab === 'safe'
					? safeProjects.includes(pool.projectName.toLowerCase())
					: !safeProjects.includes(pool.projectName.toLowerCase())) && pool.borrow.totalAvailableUsd
		)
		.sort((a, b) => b.tvlUsd - a.tvlUsd)

	const router = useRouter()
	const { borrow, collateral, incentives } = router.query

	const filteredPools2 = {}

	for (const pool of filteredPools) {
		if (!filteredPools2[pool.projectName + pool.chain]) {
			filteredPools2[pool.projectName + pool.chain] = pool
		}
	}

	const finalPools: Array<BorrowPageRow> = Object.values(filteredPools2)

	const apyLabel = borrow && collateral ? 'Net APY' : borrow ? 'Net Borrow APY' : 'Net Supply APY'
	const showAvailable = Boolean(borrow)

	return (
		<Card className="flex w-full flex-col overflow-hidden" padding="none">
			<div className="flex items-center border-b border-subtle">
				<button
					className="px-4 py-2.5 label-sm transition-colors data-[selected=false]:text-tertiary data-[selected=true]:text-primary data-[selected=true]:shadow-[inset_0_-2px_0_var(--color-brand)]"
					onClick={() => setTab('safe')}
					data-selected={tab === 'safe'}
				>
					Safe
				</button>
				<button
					className="px-4 py-2.5 label-sm transition-colors data-[selected=false]:text-tertiary data-[selected=true]:text-primary data-[selected=true]:shadow-[inset_0_-2px_0_var(--color-brand)]"
					onClick={() => setTab('degen')}
					data-selected={tab === 'degen'}
				>
					Degen
				</button>
				<span className="ml-auto pr-4 label-sm text-tertiary">
					{finalPools.length} {finalPools.length === 1 ? 'result' : 'results'}
				</span>
			</div>

			{finalPools.length === 0 ? (
				<p className="px-4 py-12 text-center body-sm text-tertiary">No pools found for this pair</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-b border-subtle text-left label-sm text-tertiary">
								<th className="px-4 py-2.5 font-medium">Protocol</th>
								<th className="px-4 py-2.5 font-medium">{apyLabel}</th>
								<th className="px-4 py-2.5 font-medium">Chain</th>
								{showAvailable ? <th className="px-4 py-2.5 text-right font-medium">Available</th> : null}
							</tr>
						</thead>
						<tbody>
							{finalPools.map((pool) => {
								const apy = getAPY(pool, borrow, collateral, incentives)
								return (
									<tr
										key={pool.projectName + pool.chain}
										className="border-b border-subtle transition-colors last:border-b-0 hover:bg-hover-row"
									>
										<td className="px-4 py-3">
											<span className="flex items-center gap-2">
												<TokenLogo name={pool.projectName} kind="token" size={20} alt={`Logo of ${pool.projectName}`} />
												<span className="label-md">{pool.projectName}</span>
											</span>
										</td>
										<td className="px-4 py-3">
											<span className={`label-md tabular-nums ${apy >= 0 ? 'text-data-up' : 'text-data-down'}`}>
												{apy.toLocaleString(undefined, { maximumFractionDigits: 2 })}%
											</span>
										</td>
										<td className="px-4 py-3">
											<span className="flex items-center gap-2">
												<TokenLogo name={pool.chain} kind="chain" size={18} alt={`Logo of ${pool.chain}`} />
												<span className="body-md text-secondary">{pool.chain}</span>
											</span>
										</td>
										{showAvailable ? (
											<td className="px-4 py-3 text-right">
												<span className="body-md text-secondary tabular-nums">
													{pool.borrow.totalAvailableUsd
														? `$${(pool.borrow.totalAvailableUsd / 1e6).toLocaleString(undefined, {
																maximumFractionDigits: 1
															})}M`
														: '—'}
												</span>
											</td>
										) : null}
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	)
}
