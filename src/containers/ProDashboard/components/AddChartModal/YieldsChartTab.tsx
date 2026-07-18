import { Popover, PopoverDisclosure, usePopoverStore } from '@ariakit/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { matchSorter } from 'match-sorter'
import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useReducer, useRef } from 'react'
import { formatTvlApyTooltip } from '~/components/ECharts/formatters'
import type { IBarChartProps, IChartProps, IMultiSeriesChart2Props } from '~/components/ECharts/types'
import { CHART_COLORS } from '~/constants/colors'
import type { ProYieldRow } from '~/containers/ProDashboard/components/datasets/YieldsDataset/data'
import { useYieldsData } from '~/containers/ProDashboard/components/datasets/YieldsDataset/useYieldsData'
import { normalizeYieldToken } from '~/containers/Yields/domain/tokenNormalization'
import { useYieldChartData, useYieldChartLendBorrow } from '~/containers/Yields/queries.client'
import { Icon } from '~/ui/Icon'
import { LocalLoader } from '~/ui/Loaders'
import { formattedNum } from '~/utils'
import { getItemIconUrl } from '../../utils'
import { AriakitMultiSelect } from '../AriakitMultiSelect'
import { useYieldChartTransformations } from '../useYieldChartTransformations'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
const BarChart = lazy(() => import('~/components/ECharts/BarChart')) as React.FC<IBarChartProps>
const AreaChart = lazy(() => import('~/components/ECharts/AreaChart')) as React.FC<IChartProps>

interface YieldsChartTabProps {
	selectedYieldPool: { configID: string; name: string; project: string; chain: string } | null
	onSelectedYieldPoolChange: (pool: { configID: string; name: string; project: string; chain: string } | null) => void
	selectedYieldChartType: string
	onSelectedYieldChartTypeChange: (chartType: string) => void
	selectedYieldChains: string[]
	selectedYieldProjects: string[]
	selectedYieldCategories: string[]
	selectedYieldTokens: string[]
	minTvl: number | null
	maxTvl: number | null
	onSelectedYieldChainsChange: (chains: string[]) => void
	onSelectedYieldProjectsChange: (projects: string[]) => void
	onSelectedYieldCategoriesChange: (categories: string[]) => void
	onSelectedYieldTokensChange: (tokens: string[]) => void
	onMinTvlChange: (tvl: number | null) => void
	onMaxTvlChange: (tvl: number | null) => void
}

type SortColumn = 'tvl' | 'apy'
type SortDirection = 'desc' | 'asc'

interface YieldsChartUiState {
	chainSearch: string
	projectSearch: string
	tokenSearch: string
	poolSearch: string
	sortColumn: SortColumn
	sortDirection: SortDirection
	showPoolPicker: boolean
}

type YieldsChartUiAction =
	| { type: 'set_chain_search'; value: string }
	| { type: 'set_project_search'; value: string }
	| { type: 'set_token_search'; value: string }
	| { type: 'set_pool_search'; value: string }
	| { type: 'toggle_sort'; column: SortColumn }
	| { type: 'set_show_pool_picker'; value: boolean }

const getInitialYieldsChartUiState = (
	selectedYieldPool: YieldsChartTabProps['selectedYieldPool']
): YieldsChartUiState => ({
	chainSearch: '',
	projectSearch: '',
	tokenSearch: '',
	poolSearch: '',
	sortColumn: 'tvl',
	sortDirection: 'desc',
	showPoolPicker: !selectedYieldPool
})

const yieldsChartUiReducer = (state: YieldsChartUiState, action: YieldsChartUiAction): YieldsChartUiState => {
	switch (action.type) {
		case 'set_chain_search':
			return { ...state, chainSearch: action.value }
		case 'set_project_search':
			return { ...state, projectSearch: action.value }
		case 'set_token_search':
			return { ...state, tokenSearch: action.value }
		case 'set_pool_search':
			return { ...state, poolSearch: action.value }
		case 'toggle_sort':
			if (state.sortColumn === action.column) {
				return {
					...state,
					sortDirection: state.sortDirection === 'desc' ? 'asc' : 'desc'
				}
			}
			return { ...state, sortColumn: action.column, sortDirection: 'desc' }
		case 'set_show_pool_picker':
			return action.value ? { ...state, showPoolPicker: true } : { ...state, poolSearch: '', showPoolPicker: false }
		default:
			return state
	}
}

const tvlApyCharts = [
	{
		type: 'line' as const,
		name: 'APY',
		encode: { x: 'timestamp', y: 'APY' },
		color: '#cc3e82',
		yAxisIndex: 0,
		valueSymbol: '%'
	},
	{
		type: 'line' as const,
		name: 'TVL',
		encode: { x: 'timestamp', y: 'TVL' },
		color: '#3e79cc',
		yAxisIndex: 1,
		valueSymbol: '$'
	}
]
const tvlApyChartOptions = { tooltip: { formatter: formatTvlApyTooltip } }

const supplyChartStacks = { Base: 'a', Reward: 'a', Intrinsic: 'a' }
const supplyChartColors = { Base: CHART_COLORS[0], Reward: CHART_COLORS[1], Intrinsic: CHART_COLORS[2] }
const borrowChartStacks = { 'Base cost': 'a', 'Reward offset': 'a', Intrinsic: 'a' }
const borrowChartColors = { 'Base cost': CHART_COLORS[0], 'Reward offset': CHART_COLORS[1], Intrinsic: CHART_COLORS[2] }
const EMPTY_YIELDS_DATA: ProYieldRow[] = []

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
	const { data: yieldsDataResponse, isLoading: yieldsLoading } = useYieldsData()
	const yieldsData = yieldsDataResponse ?? EMPTY_YIELDS_DATA
	const [uiState, dispatchUi] = useReducer(yieldsChartUiReducer, selectedYieldPool, getInitialYieldsChartUiState)
	const { chainSearch, projectSearch, tokenSearch, poolSearch, sortColumn, sortDirection, showPoolPicker } = uiState
	const deferredChainSearch = useDeferredValue(chainSearch)
	const deferredProjectSearch = useDeferredValue(projectSearch)
	const deferredTokenSearch = useDeferredValue(tokenSearch)
	const deferredPoolSearch = useDeferredValue(poolSearch)
	const chainListRef = useRef<HTMLDivElement | null>(null)
	const projectListRef = useRef<HTMLDivElement | null>(null)
	const tokenListRef = useRef<HTMLDivElement | null>(null)
	const poolListRef = useRef<HTMLDivElement | null>(null)
	const tokenSearchInputRef = useRef<HTMLInputElement | null>(null)
	const chainPopover = usePopoverStore({ placement: 'bottom-start' })
	const projectPopover = usePopoverStore({ placement: 'bottom-start' })
	const tokenPopover = usePopoverStore({ placement: 'bottom-start' })

	const chainOptions = useMemo(() => {
		const chainTvlMap = new Map<string, number>()
		for (const p of yieldsData) {
			const chain = p.chains[0]
			if (!chain) continue
			const currentTvl = chainTvlMap.get(chain) || 0
			chainTvlMap.set(chain, currentTvl + (p.tvl || 0))
		}
		return Array.from(chainTvlMap.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([chain]) => ({ value: chain, label: chain }))
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
			.map(([project]) => ({ value: project, label: project }))
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

	const filteredChainOptions = useMemo(() => {
		if (!deferredChainSearch) return chainOptions
		return matchSorter(chainOptions, deferredChainSearch, { keys: ['label'] })
	}, [chainOptions, deferredChainSearch])

	const filteredProjectOptions = useMemo(() => {
		if (!deferredProjectSearch) return projectOptions
		return matchSorter(projectOptions, deferredProjectSearch, { keys: ['label'] })
	}, [projectOptions, deferredProjectSearch])

	const filteredTokenOptions = useMemo(() => {
		if (!deferredTokenSearch) return tokenOptions
		return matchSorter(tokenOptions, deferredTokenSearch, { keys: ['label'] })
	}, [tokenOptions, deferredTokenSearch])

	const chainVirtualizer = useVirtualizer({
		count: filteredChainOptions.length,
		getScrollElement: () => chainListRef.current,
		estimateSize: () => 44,
		overscan: 8
	})

	const projectVirtualizer = useVirtualizer({
		count: filteredProjectOptions.length,
		getScrollElement: () => projectListRef.current,
		estimateSize: () => 44,
		overscan: 8
	})

	const tokenVirtualizer = useVirtualizer({
		count: filteredTokenOptions.length,
		getScrollElement: () => tokenListRef.current,
		estimateSize: () => 44,
		overscan: 8
	})

	const handleChainPopoverToggle = () => {
		setTimeout(() => chainVirtualizer.measure(), 0)
	}

	const handleProjectPopoverToggle = () => {
		setTimeout(() => projectVirtualizer.measure(), 0)
	}

	const handleTokenPopoverToggle = () => {
		setTimeout(() => tokenVirtualizer.measure(), 0)
	}

	const toggleChain = (value: string) => {
		if (selectedYieldChains.includes(value)) {
			onSelectedYieldChainsChange(selectedYieldChains.filter((v) => v !== value))
		} else {
			onSelectedYieldChainsChange([...selectedYieldChains, value])
		}
	}

	const toggleProject = (value: string) => {
		if (selectedYieldProjects.includes(value)) {
			onSelectedYieldProjectsChange(selectedYieldProjects.filter((v) => v !== value))
		} else {
			onSelectedYieldProjectsChange([...selectedYieldProjects, value])
		}
	}

	const normalizedSelectedTokens = useMemo(
		() => selectedYieldTokens.map((token) => normalizeYieldToken(token)),
		[selectedYieldTokens]
	)
	const normalizedSelectedTokenSet = useMemo(() => new Set(normalizedSelectedTokens), [normalizedSelectedTokens])

	const toggleToken = (value: string) => {
		const normalizedValue = normalizeYieldToken(value)

		if (normalizedSelectedTokenSet.has(normalizedValue)) {
			onSelectedYieldTokensChange(selectedYieldTokens.filter((token) => normalizeYieldToken(token) !== normalizedValue))
		} else {
			onSelectedYieldTokensChange([...selectedYieldTokens, normalizedValue])
		}
	}

	const filteredPools = useMemo(() => {
		return yieldsData.filter((pool) => {
			if (selectedYieldChains.length > 0 && !selectedYieldChains.includes(pool.chains[0])) {
				return false
			}

			if (selectedYieldProjects.length > 0 && !selectedYieldProjects.includes(pool.project)) {
				return false
			}

			if (selectedYieldCategories.length > 0 && !selectedYieldCategories.includes(pool.category)) {
				return false
			}

			if (normalizedSelectedTokens.length > 0) {
				const tokensInPool = new Set(pool.tokenSymbols.map(normalizeYieldToken))
				const matchesToken = normalizedSelectedTokens.some((token) => tokensInPool.has(token))

				if (!matchesToken) {
					return false
				}
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
		selectedYieldChains,
		selectedYieldProjects,
		selectedYieldCategories,
		normalizedSelectedTokens,
		minTvl,
		maxTvl
	])

	const searchedAndSortedPools = useMemo(() => {
		let result = filteredPools

		if (deferredPoolSearch) {
			result = matchSorter(result, deferredPoolSearch, {
				keys: ['pool', 'project', (item: ProYieldRow) => item.chains[0] ?? '']
			})
		}

		return [...result].sort((a, b) => {
			const aVal = (sortColumn === 'tvl' ? a.tvl : a.apy) ?? 0
			const bVal = (sortColumn === 'tvl' ? b.tvl : b.apy) ?? 0
			return sortDirection === 'desc' ? bVal - aVal : aVal - bVal
		})
	}, [filteredPools, deferredPoolSearch, sortColumn, sortDirection])

	const poolListVirtualizer = useVirtualizer({
		count: searchedAndSortedPools.length,
		getScrollElement: () => poolListRef.current,
		estimateSize: () => 64,
		overscan: 8
	})

	const toggleSort = (column: SortColumn) => {
		dispatchUi({ type: 'toggle_sort', column })
	}

	const selectedPoolData = useMemo(() => {
		if (!selectedYieldPool) return null
		return yieldsData.find((pool) => pool.configID === selectedYieldPool.configID) ?? null
	}, [selectedYieldPool, yieldsData])

	const { data: selectedYieldChartData, isLoading: selectedYieldChartLoading } = useYieldChartData(
		selectedYieldPool?.configID || null
	)

	const hasBorrowMarket =
		selectedPoolData != null &&
		(selectedPoolData.apyBorrow != null ||
			selectedPoolData.totalBorrowUsd != null ||
			selectedPoolData.totalAvailableUsd != null)
	const { data: borrowChartData, isLoading: borrowChartLoading } = useYieldChartLendBorrow(
		selectedYieldPool?.configID || null,
		hasBorrowMarket
	)

	const availableChartTypes = useMemo(() => {
		const types: Array<{ value: string; label: string; available: boolean }> = [
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

	useEffect(() => {
		if (!selectedYieldPool) return

		const borrowTypes = ['borrow-apy', 'net-borrow-apy']
		const isBorrowType = borrowTypes.includes(selectedYieldChartType)

		if (isBorrowType && borrowChartLoading) return
		if (!isBorrowType && selectedYieldChartLoading) return

		const currentTypeAvailable = availableChartTypes.find((t) => t.value === selectedYieldChartType && t.available)
		if (!currentTypeAvailable) {
			onSelectedYieldChartTypeChange('tvl-apy')
		}
	}, [
		selectedYieldPool,
		availableChartTypes,
		selectedYieldChartType,
		onSelectedYieldChartTypeChange,
		borrowChartLoading,
		selectedYieldChartLoading
	])

	const {
		// oxlint-disable-next-line no-unused-vars
		tvlApyData: yieldsChartData,
		tvlApyDataset: yieldsChartDataset,
		supplyApyBarData,
		supplyApy7dData,
		borrowApyBarData,
		netBorrowApyData,
		latestData: latestYieldData
	} = useYieldChartTransformations({
		chartData: selectedYieldChartData,
		borrowData: borrowChartData
	})

	const borrowTypes = ['borrow-apy', 'net-borrow-apy']
	const isPreviewLoading = borrowTypes.includes(selectedYieldChartType) ? borrowChartLoading : selectedYieldChartLoading

	return (
		<div className="flex flex-col gap-4">
			{yieldsLoading ? (
				<div className="flex h-32 items-center justify-center">
					<LocalLoader />
				</div>
			) : (
				<div className="flex flex-col gap-4">
					<div className="grid grid-cols-5 gap-2">
						<div className="flex flex-col">
							<span className="mb-1 block text-[11px] font-medium text-pro-text-secondary">Chains</span>
							<PopoverDisclosure
								store={chainPopover}
								onClick={handleChainPopoverToggle}
								className="flex w-full items-center justify-between rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-2 py-1.5 text-xs transition-colors hover:border-brand/40 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
							>
								<span className={selectedYieldChains.length > 0 ? 'text-pro-text-primary' : 'text-pro-text-tertiary'}>
									{selectedYieldChains.length > 0
										? `${selectedYieldChains.length} chain${selectedYieldChains.length > 1 ? 's' : ''} selected`
										: 'All chains'}
								</span>
								<Icon name="chevron-down" width={12} height={12} className="ml-2 shrink-0 opacity-70" />
							</PopoverDisclosure>
							<Popover
								store={chainPopover}
								modal={false}
								portal={true}
								gutter={4}
								flip={false}
								className="z-50 rounded-md border border-pro-cards-border bg-pro-cards-bg shadow-xl"
								style={{ width: 'var(--popover-anchor-width)' }}
							>
								<div className="p-2.5">
									<div className="relative mb-2.5">
										<Icon
											name="search"
											width={12}
											height={12}
											className="absolute top-1/2 left-2.5 -translate-y-1/2 text-pro-text-tertiary"
										/>
										<input
											onInput={(e) => dispatchUi({ type: 'set_chain_search', value: e.currentTarget.value })}
											placeholder="Search chains..."
											className="w-full rounded-md border border-pro-form-control-border bg-surface-elevated-1 py-1.5 pr-2.5 pl-7 text-xs transition-colors focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
										/>
									</div>
									<div className="h-[240px] overflow-y-auto rounded-md" ref={chainListRef}>
										<div
											className="p-1"
											style={{
												height: chainVirtualizer.getTotalSize(),
												position: 'relative'
											}}
										>
											{chainVirtualizer.getVirtualItems().map((row) => {
												const option = filteredChainOptions[row.index]
												if (!option) return null
												const isActive = selectedYieldChains.includes(option.value)
												const iconUrl = getItemIconUrl('chain', null, option.value)
												return (
													<button
														key={option.value}
														onClick={() => toggleChain(option.value)}
														className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-all ${
															isActive
																? 'bg-brand/10 font-semibold text-brand shadow-sm'
																: 'text-pro-text-secondary hover:text-pro-text-primary'
														}`}
														style={{
															position: 'absolute',
															top: 0,
															left: 0,
															width: '100%',
															transform: `translateY(${row.start}px)`
														}}
													>
														<div className="flex min-w-0 items-center gap-2.5">
															{iconUrl ? (
																<img
																	src={iconUrl}
																	alt={option.label}
																	width={20}
																	height={20}
																	className="size-5 rounded-full object-cover ring-1 ring-pro-cards-border"
																/>
															) : null}
															<span className="truncate">{option.label}</span>
														</div>
														{isActive ? (
															<Icon name="check" width={14} height={14} className="ml-2 shrink-0 text-brand" />
														) : null}
													</button>
												)
											})}
										</div>
									</div>
									{selectedYieldChains.length > 0 ? (
										<div className="mt-2.5 flex items-center justify-between rounded-md border border-pro-cards-border px-2.5 py-2">
											<span className="text-[11px] font-medium text-pro-text-secondary">
												{selectedYieldChains.length} selected
											</span>
											<button
												type="button"
												onClick={() => onSelectedYieldChainsChange([])}
												className="text-[11px] font-medium text-pro-text-tertiary transition-colors hover:text-brand"
											>
												Clear
											</button>
										</div>
									) : null}
								</div>
							</Popover>
						</div>

						<div className="flex flex-col">
							<span className="mb-1 block text-[11px] font-medium text-pro-text-secondary">Projects</span>
							<PopoverDisclosure
								store={projectPopover}
								onClick={handleProjectPopoverToggle}
								className="flex w-full items-center justify-between rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-2 py-1.5 text-xs transition-colors hover:border-brand/40 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
							>
								<span className={selectedYieldProjects.length > 0 ? 'text-pro-text-primary' : 'text-pro-text-tertiary'}>
									{selectedYieldProjects.length > 0
										? `${selectedYieldProjects.length} project${selectedYieldProjects.length > 1 ? 's' : ''} selected`
										: 'All projects'}
								</span>
								<Icon name="chevron-down" width={12} height={12} className="ml-2 shrink-0 opacity-70" />
							</PopoverDisclosure>
							<Popover
								store={projectPopover}
								modal={false}
								portal={true}
								gutter={4}
								flip={false}
								className="z-50 rounded-md border border-pro-cards-border bg-pro-cards-bg shadow-xl"
								style={{ width: 'var(--popover-anchor-width)' }}
							>
								<div className="p-2.5">
									<div className="relative mb-2.5">
										<Icon
											name="search"
											width={12}
											height={12}
											className="absolute top-1/2 left-2.5 -translate-y-1/2 text-pro-text-tertiary"
										/>
										<input
											onInput={(e) => dispatchUi({ type: 'set_project_search', value: e.currentTarget.value })}
											placeholder="Search projects..."
											className="w-full rounded-md border border-pro-form-control-border bg-surface-elevated-1 py-1.5 pr-2.5 pl-7 text-xs transition-colors focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
										/>
									</div>
									<div className="h-[240px] overflow-y-auto rounded-md" ref={projectListRef}>
										<div
											className="p-1"
											style={{
												height: projectVirtualizer.getTotalSize(),
												position: 'relative'
											}}
										>
											{projectVirtualizer.getVirtualItems().map((row) => {
												const option = filteredProjectOptions[row.index]
												if (!option) return null
												const isActive = selectedYieldProjects.includes(option.value)
												const iconUrl = getItemIconUrl('protocol', null, option.value)
												return (
													<button
														key={option.value}
														onClick={() => toggleProject(option.value)}
														className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-all ${
															isActive
																? 'bg-brand/10 font-semibold text-brand shadow-sm'
																: 'text-pro-text-secondary hover:text-pro-text-primary'
														}`}
														style={{
															position: 'absolute',
															top: 0,
															left: 0,
															width: '100%',
															transform: `translateY(${row.start}px)`
														}}
													>
														<div className="flex min-w-0 items-center gap-2.5">
															{iconUrl ? (
																<img
																	src={iconUrl}
																	alt={option.label}
																	width={20}
																	height={20}
																	className="size-5 rounded-full object-cover ring-1 ring-pro-cards-border"
																/>
															) : null}
															<span className="truncate">{option.label}</span>
														</div>
														{isActive ? (
															<Icon name="check" width={14} height={14} className="ml-2 shrink-0 text-brand" />
														) : null}
													</button>
												)
											})}
										</div>
									</div>
									{selectedYieldProjects.length > 0 ? (
										<div className="mt-2.5 flex items-center justify-between rounded-md border border-pro-cards-border px-2.5 py-2">
											<span className="text-[11px] font-medium text-pro-text-secondary">
												{selectedYieldProjects.length} selected
											</span>
											<button
												type="button"
												onClick={() => onSelectedYieldProjectsChange([])}
												className="text-[11px] font-medium text-pro-text-tertiary transition-colors hover:text-brand"
											>
												Clear
											</button>
										</div>
									) : null}
								</div>
							</Popover>
						</div>

						<div className="flex flex-col">
							<span className="mb-1 block text-[11px] font-medium text-pro-text-secondary">Tokens</span>
							<PopoverDisclosure
								store={tokenPopover}
								onClick={handleTokenPopoverToggle}
								className="flex w-full items-center justify-between rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-2 py-1.5 text-xs transition-colors hover:border-brand/40 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
							>
								<span className={selectedYieldTokens.length > 0 ? 'text-pro-text-primary' : 'text-pro-text-tertiary'}>
									{selectedYieldTokens.length > 0
										? `${selectedYieldTokens.length} token${selectedYieldTokens.length > 1 ? 's' : ''} selected`
										: 'All tokens'}
								</span>
								<Icon name="chevron-down" width={12} height={12} className="ml-2 shrink-0 opacity-70" />
							</PopoverDisclosure>
							<Popover
								store={tokenPopover}
								modal={false}
								portal={true}
								gutter={4}
								flip={false}
								className="z-50 rounded-md border border-pro-cards-border bg-pro-cards-bg shadow-xl"
								style={{ width: 'var(--popover-anchor-width)' }}
							>
								<div className="p-2.5">
									<div className="relative mb-2.5">
										<Icon
											name="search"
											width={12}
											height={12}
											className="absolute top-1/2 left-2.5 -translate-y-1/2 text-pro-text-tertiary"
										/>
										<input
											ref={tokenSearchInputRef}
											onInput={(e) => dispatchUi({ type: 'set_token_search', value: e.currentTarget.value })}
											placeholder="Search tokens..."
											className="w-full rounded-md border border-pro-form-control-border bg-surface-elevated-1 py-1.5 pr-2.5 pl-7 text-xs transition-colors focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
										/>
									</div>
									<div className="h-[240px] overflow-y-auto rounded-md" ref={tokenListRef}>
										<div
											className="p-1"
											style={{
												height: tokenVirtualizer.getTotalSize(),
												position: 'relative'
											}}
										>
											{tokenVirtualizer.getVirtualItems().map((row) => {
												const option = filteredTokenOptions[row.index]
												if (!option) return null
												const isActive = normalizedSelectedTokenSet.has(option.value)
												return (
													<button
														key={option.value}
														onClick={() => toggleToken(option.value)}
														className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-all ${
															isActive
																? 'bg-brand/10 font-semibold text-brand shadow-sm'
																: 'text-pro-text-secondary hover:text-pro-text-primary'
														}`}
														style={{
															position: 'absolute',
															top: 0,
															left: 0,
															width: '100%',
															transform: `translateY(${row.start}px)`
														}}
													>
														<span className="truncate">{option.label}</span>
														{isActive ? (
															<Icon name="check" width={14} height={14} className="ml-2 shrink-0 text-brand" />
														) : null}
													</button>
												)
											})}
										</div>
									</div>
									{selectedYieldTokens.length > 0 ? (
										<div className="mt-2.5 flex items-center justify-between rounded-md border border-pro-cards-border px-2.5 py-2">
											<span className="text-[11px] font-medium text-pro-text-secondary">
												{selectedYieldTokens.length} selected
											</span>
											<button
												type="button"
												onClick={() => {
													onSelectedYieldTokensChange([])
													if (tokenSearchInputRef.current) tokenSearchInputRef.current.value = ''
													dispatchUi({ type: 'set_token_search', value: '' })
												}}
												className="text-[11px] font-medium text-pro-text-tertiary transition-colors hover:text-brand"
											>
												Clear
											</button>
										</div>
									) : null}
								</div>
							</Popover>
						</div>

						<AriakitMultiSelect
							label="Categories"
							options={categoryOptions}
							selectedValues={selectedYieldCategories}
							onChange={onSelectedYieldCategoriesChange}
							placeholder="All categories"
						/>

						<div className="flex flex-col">
							<span className="mb-1 block text-[11px] font-medium text-pro-text-secondary">TVL Range</span>
							<div className="flex gap-1">
								<input
									type="number"
									placeholder="Min"
									value={minTvl ?? ''}
									onChange={(e) => onMinTvlChange(e.target.value ? Number(e.target.value) : null)}
									className="w-full rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-2 py-1.5 text-xs text-pro-text-primary placeholder:text-pro-text-tertiary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
								/>
								<input
									type="number"
									placeholder="Max"
									value={maxTvl ?? ''}
									onChange={(e) => onMaxTvlChange(e.target.value ? Number(e.target.value) : null)}
									className="w-full rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-2 py-1.5 text-xs text-pro-text-primary placeholder:text-pro-text-tertiary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
								/>
							</div>
						</div>
					</div>

					{selectedYieldPool && !showPoolPicker ? (
						<div className="overflow-hidden rounded-lg border border-pro-cards-border bg-pro-cards-bg">
							<div className="flex items-center justify-between px-3 py-2.5">
								<div className="flex items-center gap-3">
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
										<p className="text-sm font-semibold text-pro-text-primary">{selectedYieldPool.name}</p>
										<div className="flex items-center gap-2 text-xs text-pro-text-tertiary">
											<span>{selectedYieldPool.project}</span>
											<span>•</span>
											<span>{selectedYieldPool.chain}</span>
											{selectedPoolData ? (
												<>
													<span>•</span>
													<span className="font-medium text-pro-text-secondary">
														TVL: {formattedNum(selectedPoolData.tvl, true)}
													</span>
													<span>•</span>
													<span className="font-medium text-pro-text-secondary">
														APY: {selectedPoolData.apy?.toFixed(2) || '0.00'}%
													</span>
												</>
											) : null}
										</div>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => dispatchUi({ type: 'set_show_pool_picker', value: true })}
										className="rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-2.5 py-1.5 text-xs font-medium text-pro-text-secondary transition-colors hover:border-brand/40 hover:text-pro-text-primary"
									>
										Change pool
									</button>
									<button
										type="button"
										onClick={() => {
											onSelectedYieldPoolChange(null)
											dispatchUi({ type: 'set_show_pool_picker', value: true })
										}}
										className="rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-2.5 py-1.5 text-xs font-medium text-pro-text-tertiary transition-colors hover:border-error/40 hover:text-error"
									>
										Clear
									</button>
								</div>
							</div>
						</div>
					) : (
						<div className="overflow-hidden rounded-lg border border-pro-cards-border">
							<div className="flex items-center justify-between border-b border-pro-cards-border bg-pro-cards-bg px-3 py-2">
								<div className="flex items-center gap-3">
									<div className="relative">
										<Icon
											name="search"
											width={12}
											height={12}
											className="absolute top-1/2 left-2.5 -translate-y-1/2 text-pro-text-tertiary"
										/>
										<input
											onInput={(e) => dispatchUi({ type: 'set_pool_search', value: e.currentTarget.value })}
											placeholder="Search pools..."
											className="w-48 rounded-md border border-pro-form-control-border bg-surface-elevated-1 py-1.5 pr-2.5 pl-7 text-xs transition-colors focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
										/>
									</div>
									<span className="text-xs text-pro-text-tertiary">
										{filteredPools.length} pool{filteredPools.length !== 1 ? 's' : ''}
									</span>
								</div>
								{selectedYieldPool ? (
									<button
										type="button"
										onClick={() => dispatchUi({ type: 'set_show_pool_picker', value: false })}
										className="text-xs font-medium text-brand transition-colors hover:text-brand/80"
									>
										Cancel
									</button>
								) : null}
							</div>

							<div className="grid grid-cols-[1fr_100px_100px_80px] gap-2 border-b border-pro-cards-border px-3 py-2 text-[11px] font-medium">
								<p className="text-pro-text-tertiary">Pool</p>
								<button
									onClick={() => toggleSort('tvl')}
									className={`flex items-center justify-end gap-1 ${
										sortColumn === 'tvl' ? 'text-brand' : 'text-pro-text-tertiary hover:text-pro-text-primary'
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
									onClick={() => toggleSort('apy')}
									className={`flex items-center justify-end gap-1 ${
										sortColumn === 'apy' ? 'text-brand' : 'text-pro-text-tertiary hover:text-pro-text-primary'
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
								<p className="text-right text-pro-text-tertiary">Category</p>
							</div>

							<div ref={poolListRef} className="h-[240px] overflow-y-auto">
								{searchedAndSortedPools.length === 0 ? (
									<div className="flex h-full items-center justify-center text-xs text-pro-text-tertiary">
										No pools match your search
									</div>
								) : (
									<div
										style={{
											height: poolListVirtualizer.getTotalSize(),
											position: 'relative'
										}}
									>
										{poolListVirtualizer.getVirtualItems().map((row) => {
											const pool = searchedAndSortedPools[row.index]
											if (!pool) return null
											const isSelected = selectedYieldPool?.configID === pool.configID
											const iconUrl = getItemIconUrl('protocol', null, pool.project)
											return (
												<button
													key={pool.configID}
													onClick={() => {
														onSelectedYieldPoolChange({
															configID: pool.configID,
															name: pool.pool,
															project: pool.project,
															chain: pool.chains[0]
														})
														dispatchUi({ type: 'set_show_pool_picker', value: false })
													}}
													className={`grid w-full grid-cols-[1fr_100px_100px_80px] items-center gap-2 px-3 py-2 text-left text-xs transition-all ${
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
																className={`truncate font-medium ${isSelected ? 'text-brand' : 'text-pro-text-primary'}`}
															>
																{pool.pool}
															</div>
															<div className="truncate text-[10px] text-pro-text-tertiary">
																{pool.project} • {pool.chains[0]}
															</div>
														</div>
													</div>

													<div
														className={`text-right font-medium ${isSelected ? 'text-brand' : 'text-pro-text-primary'}`}
													>
														{formattedNum(pool.tvl, true)}
													</div>

													<div className="text-right">
														<div className={`font-medium ${isSelected ? 'text-brand' : 'text-pro-text-primary'}`}>
															{pool.apy?.toFixed(2) || '0.00'}%
														</div>
														{pool.apyMean30d != null ? (
															<div className="text-[10px] text-pro-text-tertiary">
																30d: {pool.apyMean30d.toFixed(2)}%
															</div>
														) : null}
													</div>

													<div className="text-right">
														{pool.category ? (
															<span className="inline-block truncate rounded-sm px-1.5 py-0.5 text-[10px] text-pro-text-tertiary">
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
							<span className="text-xs font-medium text-pro-text-secondary">
								{selectedYieldPool ? selectedYieldPool.name : 'Preview'}
							</span>
						</div>

						{/* Chart Type Pills */}
						{selectedYieldPool ? (
							<div className="flex flex-wrap gap-1.5 border-b border-pro-cards-border bg-pro-cards-bg px-3 py-2">
								{availableChartTypes.map((type) => {
									const isLoading = borrowChartLoading && ['borrow-apy', 'net-borrow-apy'].includes(type.value)
									const isActive = selectedYieldChartType === type.value
									return (
										<button
											key={type.value}
											onClick={() => type.available && onSelectedYieldChartTypeChange(type.value)}
											disabled={!type.available || isLoading}
											className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
												isActive
													? 'bg-brand text-on-brand shadow-sm'
													: type.available
														? 'text-pro-text-secondary hover:text-pro-text-primary'
														: 'cursor-not-allowed text-pro-text-tertiary opacity-50'
											}`}
										>
											{type.label}
											{isLoading ? '...' : null}
										</button>
									)
								})}
							</div>
						) : null}

						{selectedYieldPool ? (
							<div className="bg-pro-cards-bg p-3">
								<div className="mb-2 flex items-center gap-2 text-xs">
									<span className="text-pro-text-tertiary">{selectedYieldPool.project}</span>
									<span className="text-pro-text-tertiary">•</span>
									<span className="text-pro-text-tertiary">{selectedYieldPool.chain}</span>
								</div>

								{selectedYieldChartType === 'tvl-apy' &&
								latestYieldData.apy !== null &&
								latestYieldData.tvl !== null ? (
									<div className="mb-3 flex gap-4">
										<div className="flex flex-col">
											<span className="text-[10px] text-pro-text-tertiary uppercase">Latest APY</span>
											<span className="font-jetbrains text-base font-semibold" style={{ color: '#cc3e82' }}>
												{latestYieldData.apy}%
											</span>
										</div>
										<div className="flex flex-col">
											<span className="text-[10px] text-pro-text-tertiary uppercase">TVL</span>
											<span className="font-jetbrains text-base font-semibold" style={{ color: '#3e79cc' }}>
												{formattedNum(latestYieldData.tvl, true)}
											</span>
										</div>
									</div>
								) : null}

								<div className="h-[280px]">
									{isPreviewLoading ? (
										<div className="flex h-full items-center justify-center">
											<LocalLoader />
										</div>
									) : (
										<Suspense
											fallback={
												<div className="flex h-full items-center justify-center">
													<LocalLoader />
												</div>
											}
										>
											{selectedYieldChartType === 'tvl-apy' ? (
												<MultiSeriesChart2
													height="280px"
													dataset={yieldsChartDataset}
													charts={tvlApyCharts}
													chartOptions={tvlApyChartOptions}
													valueSymbol=""
													alwaysShowTooltip={false}
												/>
											) : null}
											{selectedYieldChartType === 'supply-apy' ? (
												<BarChart
													height="280px"
													chartData={supplyApyBarData}
													stacks={supplyChartStacks}
													stackColors={supplyChartColors}
													title="Supply APY"
													valueSymbol="%"
												/>
											) : null}
											{selectedYieldChartType === 'supply-apy-7d' ? (
												<AreaChart
													height="280px"
													chartData={supplyApy7dData}
													title="7 Day Avg Supply APY"
													valueSymbol="%"
													color={CHART_COLORS[0]}
												/>
											) : null}
											{selectedYieldChartType === 'borrow-apy' ? (
												<BarChart
													height="280px"
													chartData={borrowApyBarData}
													stacks={borrowChartStacks}
													stackColors={borrowChartColors}
													title="Borrow Cost APY"
													valueSymbol="%"
												/>
											) : null}
											{selectedYieldChartType === 'net-borrow-apy' ? (
												<AreaChart
													height="280px"
													chartData={netBorrowApyData}
													title="Net Borrow Cost"
													valueSymbol="%"
													color={CHART_COLORS[0]}
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
									<p className="text-xs">Select a yield pool to see preview</p>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
