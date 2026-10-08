import { matchSorter } from 'match-sorter'
import { lazy, Suspense, useDeferredValue, useMemo, useRef, useState } from 'react'
import { VirtualizedMultiSelect } from '~/components/Select/VirtualizedSelect'
import { useYieldsData } from '~/containers/ProDashboard/components/datasets/YieldsDataset/useYieldsData'
import type { ProYieldRow } from '~/containers/ProDashboard/yieldData'
import { normalizeYieldToken } from '~/containers/Yields/domain/tokenNormalization'
import { useYieldChartData, useYieldChartLendBorrow } from '~/containers/Yields/queries.client'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { formatUsd, formatPercent } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { normalizeYieldChartType, type YieldChartType } from '../../types'
import { getItemIconUrl } from '../../utils'
import { useYieldChartTransformations } from '../useYieldChartTransformations'
import {
	borrowApyCharts,
	netBorrowApyCharts,
	percentTimeChartOptions,
	singlePercentTimeChartOptions,
	supplyApy7dCharts,
	supplyApyCharts,
	tvlApyCharts
} from '../yieldChartConfig'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

interface YieldsChartTabProps {
	selectedYieldPool: {
		configID: string
		name: string
		project: string
		chain: string
	} | null
	onSelectedYieldPoolChange: (
		pool: {
			configID: string
			name: string
			project: string
			chain: string
		} | null
	) => void
	selectedYieldChartType: YieldChartType
	onSelectedYieldChartTypeChange: (chartType: YieldChartType) => void
	selectedYieldChains: Array<string>
	selectedYieldProjects: Array<string>
	selectedYieldCategories: Array<string>
	selectedYieldTokens: Array<string>
	minTvl: number | null
	maxTvl: number | null
	onSelectedYieldChainsChange: (chains: Array<string>) => void
	onSelectedYieldProjectsChange: (projects: Array<string>) => void
	onSelectedYieldCategoriesChange: (categories: Array<string>) => void
	onSelectedYieldTokensChange: (tokens: Array<string>) => void
	onMinTvlChange: (tvl: number | null) => void
	onMaxTvlChange: (tvl: number | null) => void
}

type SortColumn = 'tvl' | 'apy'
type SortDirection = 'desc' | 'asc'

const EMPTY_YIELDS_DATA: Array<ProYieldRow> = []
const BORROW_CHART_TYPES = new Set(['borrow-apy', 'net-borrow-apy'])

export function YieldsChartTab({
	selectedYieldPool,
	onSelectedYieldPoolChange,
	selectedYieldChartType,
	onSelectedYieldChartTypeChange,
	selectedYieldChains,
	selectedYieldProjects,
	selectedYieldCategories,
	selectedYieldTokens,
	minTvl,
	maxTvl,
	onSelectedYieldChainsChange,
	onSelectedYieldProjectsChange,
	onSelectedYieldCategoriesChange,
	onSelectedYieldTokensChange,
	onMinTvlChange,
	onMaxTvlChange
}: YieldsChartTabProps) {
	const yieldsQuery = useYieldsData()
	const yieldsLoading = yieldsQuery.isLoading
	const yieldsData = yieldsQuery.data ?? EMPTY_YIELDS_DATA
	const [poolSearch, setPoolSearch] = useState('')
	const deferredPoolSearch = useDeferredValue(poolSearch)
	const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
		column: 'tvl',
		direction: 'desc'
	})
	const sortColumn = sort.column
	const sortDirection = sort.direction
	// The picker shows until a pool is picked, and again while the reader changes it.
	const [changingPool, setChangingPool] = useState(false)
	const showPoolPicker = !selectedYieldPool || changingPool
	const closePoolPicker = () => {
		setChangingPool(false)
		setPoolSearch('')
	}
	const poolListRef = useRef<HTMLDivElement | null>(null)

	const chainOptions = useMemo(() => {
		const chainTvlMap = new Map<string, number>()
		for (const p of yieldsData) {
			const chain = p.chains[0]
			const currentTvl = chainTvlMap.get(chain) || 0
			chainTvlMap.set(chain, currentTvl + (p.tvl || 0))
		}
		return Array.from(chainTvlMap.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([chain]) => ({ value: chain, label: chain, logo: getItemIconUrl('chain', null, chain) }))
	}, [yieldsData])

	const projectOptions = useMemo(() => {
		const projectTvlMap = new Map<string, number>()
		for (const p of yieldsData) {
			const project = p.project
			if (!project) continue
			const currentTvl = projectTvlMap.get(project) || 0
			projectTvlMap.set(project, currentTvl + (p.tvl || 0))
		}
		return Array.from(projectTvlMap.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([project]) => ({ value: project, label: project, logo: getItemIconUrl('protocol', null, project) }))
	}, [yieldsData])

	const categoryOptions = useMemo(() => {
		const categories = new Set<string>()
		for (const pool of yieldsData) if (pool.category) categories.add(pool.category)
		return [...categories].sort().map((category) => ({ value: category, label: category }))
	}, [yieldsData])

	const tokenOptions = useMemo(() => {
		const tokenTvlMap = new Map<string, number>()
		for (const pool of yieldsData) {
			for (const symbol of pool.tokenSymbols) {
				const token = normalizeYieldToken(symbol)
				tokenTvlMap.set(token, (tokenTvlMap.get(token) ?? 0) + (pool.tvl ?? 0))
			}
		}

		const tokenOptionList = Array.from(tokenTvlMap.entries())
			.sort((a, b) => {
				if (b[1] !== a[1]) return b[1] - a[1]
				return a[0].localeCompare(b[0])
			})
			.map(([token]) => ({ value: token, label: token.toUpperCase() }))

		return tokenOptionList
	}, [yieldsData])

	const normalizedSelectedTokenSet = useMemo(() => {
		const tokens = new Set<string>()
		for (const token of selectedYieldTokens) tokens.add(normalizeYieldToken(token))
		return tokens
	}, [selectedYieldTokens])
	const selectedYieldChainSet = useMemo(() => new Set(selectedYieldChains), [selectedYieldChains])
	const selectedYieldProjectSet = useMemo(() => new Set(selectedYieldProjects), [selectedYieldProjects])
	const selectedYieldCategorySet = useMemo(() => new Set(selectedYieldCategories), [selectedYieldCategories])

	const filteredPools = useMemo(() => {
		return yieldsData.filter((pool) => {
			if (selectedYieldChainSet.size > 0 && !selectedYieldChainSet.has(pool.chains[0])) {
				return false
			}

			if (selectedYieldProjectSet.size > 0 && !selectedYieldProjectSet.has(pool.project)) {
				return false
			}

			if (
				selectedYieldCategorySet.size > 0 &&
				(pool.category === null || !selectedYieldCategorySet.has(pool.category))
			) {
				return false
			}

			if (
				normalizedSelectedTokenSet.size > 0 &&
				!pool.tokenSymbols.some((token) => normalizedSelectedTokenSet.has(normalizeYieldToken(token)))
			) {
				return false
			}

			if (minTvl !== null && (pool.tvl == null || pool.tvl < minTvl)) {
				return false
			}
			if (maxTvl !== null && (pool.tvl == null || pool.tvl > maxTvl)) {
				return false
			}

			return true
		})
	}, [
		yieldsData,
		selectedYieldChainSet,
		selectedYieldProjectSet,
		selectedYieldCategorySet,
		normalizedSelectedTokenSet,
		minTvl,
		maxTvl
	])

	const searchedAndSortedPools = useMemo(() => {
		let result = filteredPools

		if (deferredPoolSearch) {
			result = matchSorter(result, deferredPoolSearch, {
				keys: ['pool', 'project', (item: ProYieldRow) => item.chains[0]]
			})
		}

		return [...result].sort((a, b) => {
			const aVal = (sortColumn === 'tvl' ? a.tvl : a.apy) ?? 0
			const bVal = (sortColumn === 'tvl' ? b.tvl : b.apy) ?? 0
			return sortDirection === 'desc' ? bVal - aVal : aVal - bVal
		})
	}, [filteredPools, deferredPoolSearch, sortColumn, sortDirection])

	const poolListVirtualizer = useVirtualItems({
		count: searchedAndSortedPools.length,
		getScrollElement: () => poolListRef.current,
		estimateSize: () => 64,
		overscan: 8
	})

	const toggleSort = (column: SortColumn) => {
		setSort((previous) =>
			previous.column === column
				? { column, direction: previous.direction === 'desc' ? 'asc' : 'desc' }
				: { column, direction: 'desc' }
		)
	}

	const selectedPoolData = useMemo(() => {
		if (!selectedYieldPool) return null
		return yieldsData.find((pool) => pool.configID === selectedYieldPool.configID) ?? null
	}, [selectedYieldPool, yieldsData])

	const supplyHistory = useYieldChartData(selectedYieldPool?.configID || null)
	const selectedYieldChartData = supplyHistory.data

	const hasBorrowMarket =
		selectedPoolData != null &&
		(selectedPoolData.apyBorrow != null ||
			selectedPoolData.totalBorrowUsd != null ||
			selectedPoolData.totalAvailableUsd != null)
	const borrowHistory = useYieldChartLendBorrow(selectedYieldPool?.configID || null, hasBorrowMarket)
	const borrowChartData = borrowHistory.data
	const borrowChartLoading = borrowHistory.isLoading

	const availableChartTypes = useMemo(() => {
		const types: Array<{ value: YieldChartType; label: string; available: boolean }> = [
			{ value: 'tvl-apy', label: 'TVL & Supply APY', available: true }
		]

		if (selectedYieldChartData) {
			const hasApyComponents = selectedYieldChartData.some(
				(point) =>
					point.apy.avg_1d.base != null || point.apy.avg_1d.reward != null || point.intrinsic?.apy.avg_1d.base != null
			)
			types.push({
				value: 'supply-apy',
				label: 'Supply APY',
				available: hasApyComponents
			})
			types.push({
				value: 'supply-apy-7d',
				label: '7 Day Avg Supply APY',
				available: selectedYieldChartData.some(
					(point) => point.apy.avg_7d.total != null || point.intrinsic?.apy.avg_7d.base != null
				)
			})
		}

		if (borrowChartData?.length) {
			const hasBorrowApy = borrowChartData.some(
				(point) => point.borrow_cost_apy.avg_1d.base != null || point.borrow_cost_apy.avg_1d.reward != null
			)

			types.push({
				value: 'borrow-apy',
				label: 'Borrow Cost APY',
				available: hasBorrowApy
			})
			types.push({
				value: 'net-borrow-apy',
				label: 'Net Borrow Cost',
				available: hasBorrowApy
			})
		}

		return types
	}, [selectedYieldChartData, borrowChartData])

	const { dataset: yieldsChartDataset, latestData: latestYieldData } = useYieldChartTransformations({
		chartType: normalizeYieldChartType(selectedYieldChartType),
		chartData: selectedYieldChartData,
		borrowData: borrowChartData
	})

	const previewHistory = BORROW_CHART_TYPES.has(selectedYieldChartType) ? borrowHistory : supplyHistory
	const isPreviewLoading = previewHistory.isLoading

	return (
		<div className="flex flex-col gap-4">
			{queryReadFailed(yieldsQuery) && !yieldsQuery.data ? (
				<InlineStatus variant="error">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span>Couldn't load the yield pools.</span>
						<Button
							type="button"
							size="sm"
							pendingLabel={yieldsQuery.isFetching ? 'Retrying…' : null}
							onClick={() => void yieldsQuery.refetch()}
						>
							Try again
						</Button>
					</div>
				</InlineStatus>
			) : yieldsLoading ? (
				<div role="status" aria-live="polite" className="flex h-32 items-center justify-center">
					<LoadingIndicator />
				</div>
			) : (
				<div className="flex flex-col gap-4">
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
						<VirtualizedMultiSelect
							label="Chains"
							options={chainOptions}
							selectedValues={selectedYieldChains}
							onChange={onSelectedYieldChainsChange}
							placeholder="All chains"
						/>
						<VirtualizedMultiSelect
							label="Projects"
							options={projectOptions}
							selectedValues={selectedYieldProjects}
							onChange={onSelectedYieldProjectsChange}
							placeholder="All projects"
						/>
						{/* Saved cards may hold tokens in another spelling; the picker reads and writes the normalized ones. */}
						<VirtualizedMultiSelect
							label="Tokens"
							options={tokenOptions}
							selectedValues={[...normalizedSelectedTokenSet]}
							onChange={onSelectedYieldTokensChange}
							placeholder="All tokens"
						/>

						<VirtualizedMultiSelect
							label="Categories"
							options={categoryOptions}
							selectedValues={selectedYieldCategories}
							onChange={onSelectedYieldCategoriesChange}
							placeholder="All categories"
						/>

						<div className="flex flex-col">
							<span className="mb-1 block label-sm text-pro-text-secondary">TVL Range</span>
							<div className="flex gap-1">
								<input
									type="number"
									aria-label="Minimum TVL"
									placeholder="Min"
									value={minTvl ?? ''}
									onChange={(e) => onMinTvlChange(e.target.value ? Number(e.target.value) : null)}
									className="w-full rounded-md border border-pro-cards-border bg-surface-elevated-1 px-2 py-1.5 body-sm text-pro-text-primary placeholder:text-pro-text-tertiary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
								/>
								<input
									type="number"
									aria-label="Maximum TVL"
									placeholder="Max"
									value={maxTvl ?? ''}
									onChange={(e) => onMaxTvlChange(e.target.value ? Number(e.target.value) : null)}
									className="w-full rounded-md border border-pro-cards-border bg-surface-elevated-1 px-2 py-1.5 body-sm text-pro-text-primary placeholder:text-pro-text-tertiary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
								/>
							</div>
						</div>
					</div>

					{selectedYieldPool && !showPoolPicker ? (
						<div className="overflow-hidden rounded-lg border border-pro-cards-border bg-pro-cards-bg">
							<div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
								<div className="flex min-w-0 items-center gap-3">
									{selectedPoolData ? (
										<img
											src={getItemIconUrl('protocol', null, selectedPoolData.project)}
											alt={selectedPoolData.project}
											width={32}
											height={32}
											className="size-8 rounded-full object-cover ring-1 ring-pro-cards-border"
										/>
									) : null}
									<div className="min-w-0">
										<p className="title-md text-pro-text-primary">{selectedYieldPool.name}</p>
										<div className="flex flex-wrap items-center gap-x-2 body-sm text-pro-text-tertiary">
											<span>{selectedYieldPool.project}</span>
											<span>•</span>
											<span>{selectedYieldPool.chain}</span>
											{selectedPoolData ? (
												<>
													<span>•</span>
													<span className="font-medium text-pro-text-secondary">
														TVL:{' '}
														{formatUsd(selectedPoolData.tvl, {
															compact: true,
															minimumCompactValue: 1_000_000,
															compactSuffix: 'lowercase'
														})}
													</span>
													<span>•</span>
													<span className="font-medium text-pro-text-secondary">
														APY:{' '}
														{formatPercent(selectedPoolData.apy, {
															input: 'percent',
															minimumFractionDigits: 2,
															maximumFractionDigits: 2,
															useGrouping: false
														}) ?? '0.00%'}
													</span>
												</>
											) : null}
										</div>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Button size="sm" onClick={() => setChangingPool(true)}>
										Change pool
									</Button>
									<Button
										size="sm"
										onClick={() => {
											onSelectedYieldPoolChange(null)
											setChangingPool(false)
										}}
									>
										Clear
									</Button>
								</div>
							</div>
						</div>
					) : (
						<div className="overflow-hidden rounded-lg border border-pro-cards-border">
							<div className="flex items-center justify-between border-b border-pro-cards-border bg-pro-cards-bg px-3 py-2 label-sm">
								<div className="flex items-center gap-3">
									<div className="relative">
										<Icon
											name="search"
											width={12}
											height={12}
											className="absolute top-1/2 left-2.5 -translate-y-1/2 text-pro-text-tertiary"
										/>
										<input
											onInput={(e) => setPoolSearch(e.currentTarget.value)}
											placeholder="Search pools…"
											aria-label="Search pools"
											className="w-36 rounded-md border border-pro-cards-border bg-surface-elevated-1 py-1.5 pr-2.5 pl-7 label-sm transition-colors focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden sm:w-48"
										/>
									</div>
									<span className="label-sm text-pro-text-tertiary">
										{filteredPools.length} pool
										{filteredPools.length !== 1 ? 's' : ''}
									</span>
								</div>
								{selectedYieldPool ? (
									<Button variant="link" onClick={closePoolPicker}>
										Cancel
									</Button>
								) : null}
							</div>

							<div className="grid grid-cols-[1fr_72px_72px] gap-2 border-b border-pro-cards-border px-3 py-2 label-sm sm:grid-cols-[1fr_100px_100px_80px]">
								<p className="text-pro-text-tertiary">Pool</p>
								<button
									type="button"
									aria-pressed={sortColumn === 'tvl'}
									onClick={() => toggleSort('tvl')}
									className={`flex items-center justify-end gap-1 ${
										sortColumn === 'tvl' ? 'text-link' : 'text-pro-text-tertiary hover:text-pro-text-primary'
									}`}
								>
									TVL
									<Icon
										name={sortColumn === 'tvl' && sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
										width={10}
										height={10}
										className={sortColumn === 'tvl' ? 'opacity-100' : 'opacity-30'}
									/>
								</button>
								<button
									type="button"
									aria-pressed={sortColumn === 'apy'}
									onClick={() => toggleSort('apy')}
									className={`flex items-center justify-end gap-1 ${
										sortColumn === 'apy' ? 'text-link' : 'text-pro-text-tertiary hover:text-pro-text-primary'
									}`}
								>
									APY
									<Icon
										name={sortColumn === 'apy' && sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
										width={10}
										height={10}
										className={sortColumn === 'apy' ? 'opacity-100' : 'opacity-30'}
									/>
								</button>
								<p className="text-right text-pro-text-tertiary max-sm:hidden">Category</p>
							</div>

							<div ref={poolListRef} className="h-[240px] overflow-y-auto">
								{searchedAndSortedPools.length === 0 ? (
									<div className="flex h-full items-center justify-center body-sm text-pro-text-tertiary">
										No pools match your search
									</div>
								) : (
									<div
										style={{
											height: poolListVirtualizer.totalSize,
											position: 'relative'
										}}
									>
										{poolListVirtualizer.items.map((row) => {
											const pool = searchedAndSortedPools[row.index]
											if (!pool) return null
											const isSelected = selectedYieldPool?.configID === pool.configID
											const iconUrl = getItemIconUrl('protocol', null, pool.project)
											return (
												<button
													type="button"
													key={pool.configID}
													aria-pressed={isSelected}
													onClick={() => {
														onSelectedYieldPoolChange({
															configID: pool.configID,
															name: pool.pool,
															project: pool.project,
															chain: pool.chains[0]
														})
														closePoolPicker()
													}}
													className={`grid w-full grid-cols-[1fr_72px_72px] items-center gap-2 px-3 py-2 text-left label-sm transition-all sm:grid-cols-[1fr_100px_100px_80px] ${
														isSelected ? 'bg-brand/10' : ''
													}`}
													style={{
														position: 'absolute',
														top: 0,
														left: 0,
														width: '100%',
														transform: `translateY(${row.start}px)`
													}}
												>
													<div className="flex min-w-0 items-center gap-2">
														{iconUrl ? (
															<img
																src={iconUrl}
																alt={pool.project}
																width={24}
																height={24}
																className="size-6 shrink-0 rounded-full object-cover ring-1 ring-pro-cards-border"
															/>
														) : null}
														<div className="min-w-0">
															<div
																className={`truncate font-medium ${isSelected ? 'text-link' : 'text-pro-text-primary'}`}
															>
																{pool.pool}
															</div>
															<div className="truncate body-sm text-pro-text-tertiary">
																{pool.project} • {pool.chains[0]}
															</div>
														</div>
													</div>

													<div
														className={`text-right font-medium ${isSelected ? 'text-link' : 'text-pro-text-primary'}`}
													>
														{formatUsd(pool.tvl, {
															compact: true,
															minimumCompactValue: 1_000_000,
															compactSuffix: 'lowercase'
														})}
													</div>

													<div className="text-right">
														<div className={`font-medium ${isSelected ? 'text-link' : 'text-pro-text-primary'}`}>
															{formatPercent(pool.apy, {
																input: 'percent',
																minimumFractionDigits: 2,
																maximumFractionDigits: 2,
																useGrouping: false
															}) ?? '0.00%'}
														</div>
														{pool.apyMean30d != null ? (
															<div className="body-sm text-pro-text-tertiary">
																30d:{' '}
																{formatPercent(pool.apyMean30d, {
																	input: 'percent',
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
																	useGrouping: false
																})}
															</div>
														) : null}
													</div>

													<div className="text-right max-sm:hidden">
														{pool.category ? (
															<span className="inline-block truncate rounded-sm px-1.5 py-0.5 body-sm text-pro-text-tertiary">
																{pool.category}
															</span>
														) : null}
													</div>
												</button>
											)
										})}
									</div>
								)}
							</div>
						</div>
					)}

					{/* Chart Preview */}
					<div className="overflow-hidden rounded-lg border border-pro-cards-border">
						<div className="flex items-center justify-between border-b border-pro-cards-border bg-pro-cards-bg px-3 py-2">
							<span className="label-sm text-pro-text-secondary">
								{selectedYieldPool ? selectedYieldPool.name : 'Preview'}
							</span>
						</div>

						{selectedYieldPool ? (
							<div className="border-b border-pro-cards-border bg-pro-cards-bg px-3 py-2">
								<SegmentedControl
									label="Chart type"
									variant="chips"
									size="sm"
									value={selectedYieldChartType}
									onValueChange={onSelectedYieldChartTypeChange}
									options={availableChartTypes.map((type) => {
										const isLoading = borrowChartLoading && BORROW_CHART_TYPES.has(type.value)
										return {
											value: type.value,
											label: isLoading ? `${type.label}...` : type.label,
											disabled: !type.available || isLoading
										}
									})}
								/>
							</div>
						) : null}

						{selectedYieldPool ? (
							<div className="bg-pro-cards-bg p-3">
								<div className="mb-2 flex items-center gap-2 body-sm">
									<span className="text-pro-text-tertiary">{selectedYieldPool.project}</span>
									<span className="text-pro-text-tertiary">•</span>
									<span className="text-pro-text-tertiary">{selectedYieldPool.chain}</span>
								</div>

								{selectedYieldChartType === 'tvl-apy' &&
								latestYieldData.apy !== null &&
								latestYieldData.tvl !== null ? (
									<div className="mb-3 flex gap-4">
										<div className="flex flex-col">
											<span className="body-sm text-pro-text-tertiary uppercase">Latest APY</span>
											<span className="mono-md-bold" style={{ color: '#cc3e82' }}>
												{formatPercent(latestYieldData.apy, { input: 'percent' })}
											</span>
										</div>
										<div className="flex flex-col">
											<span className="body-sm text-pro-text-tertiary uppercase">TVL</span>
											<span className="mono-md-bold" style={{ color: '#3e79cc' }}>
												{formatUsd(latestYieldData.tvl, {
													compact: true,
													minimumCompactValue: 1_000_000,
													compactSuffix: 'lowercase'
												})}
											</span>
										</div>
									</div>
								) : null}

								<div className="h-[280px]">
									{queryReadFailed(previewHistory) && !previewHistory.data ? (
										<div role="alert" className="flex h-full flex-col items-center justify-center gap-2">
											<p className="body-md text-data-down">Couldn't load this pool's history.</p>
											<Button
												type="button"
												size="sm"
												pendingLabel={previewHistory.isFetching ? 'Retrying…' : null}
												onClick={() => void previewHistory.refetch()}
											>
												Try again
											</Button>
										</div>
									) : isPreviewLoading ? (
										<div role="status" aria-live="polite" className="flex h-full items-center justify-center">
											<LoadingIndicator />
										</div>
									) : (
										<Suspense
											fallback={
												<div role="status" aria-live="polite" className="flex h-full items-center justify-center">
													<LoadingIndicator />
												</div>
											}
										>
											{selectedYieldChartType === 'tvl-apy' ? (
												<MultiSeriesChart
													height="280px"
													dataset={yieldsChartDataset}
													charts={tvlApyCharts}
													valueSymbol=""
													alwaysShowTooltip={false}
												/>
											) : null}
											{selectedYieldChartType === 'supply-apy' ? (
												<MultiSeriesChart
													height="280px"
													dataset={yieldsChartDataset}
													charts={supplyApyCharts}
													chartOptions={percentTimeChartOptions}
													title="Supply APY"
													valueSymbol="%"
													hideDefaultLegend={false}
												/>
											) : null}
											{selectedYieldChartType === 'supply-apy-7d' ? (
												<MultiSeriesChart
													height="280px"
													dataset={yieldsChartDataset}
													charts={supplyApy7dCharts}
													chartOptions={singlePercentTimeChartOptions}
													title="7 Day Avg Supply APY"
													valueSymbol="%"
												/>
											) : null}
											{selectedYieldChartType === 'borrow-apy' ? (
												<MultiSeriesChart
													height="280px"
													dataset={yieldsChartDataset}
													charts={borrowApyCharts}
													chartOptions={percentTimeChartOptions}
													title="Borrow Cost APY"
													valueSymbol="%"
													hideDefaultLegend={false}
												/>
											) : null}
											{selectedYieldChartType === 'net-borrow-apy' ? (
												<MultiSeriesChart
													height="280px"
													dataset={yieldsChartDataset}
													charts={netBorrowApyCharts}
													chartOptions={singlePercentTimeChartOptions}
													title="Net Borrow Cost"
													valueSymbol="%"
												/>
											) : null}
										</Suspense>
									)}
								</div>
							</div>
						) : (
							<div className="flex h-[280px] items-center justify-center bg-pro-cards-bg text-center text-pro-text-tertiary">
								<div>
									<Icon name="bar-chart-2" height={32} width={32} className="mx-auto mb-1" />
									<p className="body-sm">Select a yield pool to see preview</p>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
