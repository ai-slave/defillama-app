import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, type ReactNode, useEffect, useMemo, useState } from 'react'
import { createSingleSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { EmissionsDataset } from '~/containers/Unlocks/api.types'
import { getAllProtocolEmissions, getProtocolEmissons } from '~/containers/Unlocks/queries'
import { useSeriesSelection } from '~/hooks/useSeriesSelection'
import { Icon } from '~/ui/Icon'
import { LocalLoader } from '~/ui/Loaders'
import { slug, toNiceDayMonthYear } from '~/utils'
import { AriakitSelect } from '../AriakitSelect'
import { AriakitVirtualizedSelect, type VirtualizedSelectOption } from '../AriakitVirtualizedSelect'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

const EMPTY_DATASET: EmissionsDataset = { source: [], dimensions: ['timestamp'] }

interface UnlocksChartTabProps {
	selectedUnlocksProtocol: string | null
	selectedUnlocksProtocolName: string | null
	selectedUnlocksChartType: 'total' | 'schedule' | 'allocation' | 'locked-unlocked'
	onSelectedUnlocksProtocolChange: (protocol: string | null) => void
	onSelectedUnlocksProtocolNameChange: (name: string | null) => void
	onSelectedUnlocksChartTypeChange: (type: 'total' | 'schedule' | 'allocation' | 'locked-unlocked') => void
	protocolOptions: VirtualizedSelectOption[]
	protocolsLoading: boolean
}

const UNLOCKS_CHART_TYPES = [
	{ value: 'total', label: 'Total Unlocks' },
	{ value: 'schedule', label: 'Unlocks Schedule' },
	{ value: 'allocation', label: 'Allocation' },
	{ value: 'locked-unlocked', label: 'Locked/Unlocked %' }
]

const EMPTY_CHART_DATA: Array<{ name: string; value: number }> = []
const EMPTY_CHART_COLORS: Record<string, string> = {}
const EMPTY_STACKS: string[] = []
const LOCKED_UNLOCKED_COLORS = {
	Unlocked: '#0c5dff',
	Locked: '#ff4e21'
}
const TOTAL_UNLOCKS_SERIES_NAME = 'Total Unlocks'
const TOTAL_UNLOCKS_CHART_OPTIONS = createSingleSeriesChartOptions('$')
const EMPTY_TOTAL_UNLOCKS_DATASET: MultiSeriesChartDataset = {
	source: [],
	dimensions: ['timestamp', TOTAL_UNLOCKS_SERIES_NAME]
}

function createRandomColor() {
	return '#' + ((Math.random() * 0xffffff) << 0).toString(16).padStart(6, '0')
}

export function UnlocksChartTab({
	selectedUnlocksProtocol,
	selectedUnlocksProtocolName,
	selectedUnlocksChartType,
	onSelectedUnlocksProtocolChange,
	onSelectedUnlocksProtocolNameChange,
	onSelectedUnlocksChartTypeChange,
	protocolOptions,
	protocolsLoading
}: UnlocksChartTabProps) {
	const [unlocksEndDate] = useState(() => Date.now() / 1000 + 30 * 24 * 60 * 60)
	const [todayTimestamp] = useState(() => Math.floor(Date.now() / 1000))
	const [totalUnlocksColor] = useState(createRandomColor)
	const todayHallmarks = useMemo<[number, string][]>(
		() => [[todayTimestamp, toNiceDayMonthYear(todayTimestamp)]],
		[todayTimestamp]
	)
	const { data: unlocksProtocols, isLoading: unlocksProtocolsLoading } = useQuery({
		queryKey: ['pro-dashboard', 'unlocks-protocols', unlocksEndDate],
		queryFn: () => getAllProtocolEmissions({ endDate: unlocksEndDate, getHistoricalPrices: false }),
		staleTime: 60 * 60 * 1000
	})

	const protocolLogoBySlug = useMemo(() => {
		const map = new Map<string, string>()
		for (const option of protocolOptions) {
			if (option.logo) {
				map.set(option.value, option.logo)
			}
		}
		return map
	}, [protocolOptions])

	const unlocksProtocolOptions = useMemo(() => {
		const map = new Map<string, VirtualizedSelectOption>()
		for (const protocol of unlocksProtocols || []) {
			if (!protocol?.name) continue
			const value = slug(protocol.name)
			if (!value) continue
			if (!map.has(value)) {
				map.set(value, {
					value,
					label: protocol.name,
					logo: protocolLogoBySlug.get(value)
				})
			}
		}
		if (selectedUnlocksProtocol && !map.has(selectedUnlocksProtocol)) {
			map.set(selectedUnlocksProtocol, {
				value: selectedUnlocksProtocol,
				label: selectedUnlocksProtocolName || selectedUnlocksProtocol
			})
		}
		return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
	}, [unlocksProtocols, protocolLogoBySlug, selectedUnlocksProtocol, selectedUnlocksProtocolName])

	const { data, isLoading } = useQuery({
		queryKey: ['pro-dashboard', 'unlocks-preview', selectedUnlocksProtocol],
		queryFn: () => getProtocolEmissons(slug(selectedUnlocksProtocol || '')),
		enabled: Boolean(selectedUnlocksProtocol),
		staleTime: 60 * 60 * 1000
	})

	// Pre-built from the API — no need to reconstruct dataset/charts from scratch.
	const scheduleDataset = data?.datasets?.documented ?? EMPTY_DATASET
	const scheduleCharts = data?.chartsConfigs?.documented

	const stacks = useMemo(() => {
		if (scheduleCharts?.length) return scheduleCharts.map((chart) => chart.name)
		const categories = data?.categories?.documented ?? EMPTY_STACKS
		if (categories.length > 0) return categories
		return EMPTY_STACKS
	}, [scheduleCharts, data])
	const scheduleSelection = useSeriesSelection({
		availableSeries: stacks,
		selectionKey: `${selectedUnlocksProtocol}:schedule`
	})

	const allocationPieChart = useMemo(() => {
		const source = data?.pieChartData?.documented ?? EMPTY_CHART_DATA
		const shouldBuildChartData = selectedUnlocksChartType === 'allocation'
		const chartData: Array<{ name: string; value: number }> = shouldBuildChartData ? [] : EMPTY_CHART_DATA
		let available = false
		for (const item of source) {
			if (!item.name || item.value <= 0) continue
			available = true
			if (shouldBuildChartData) chartData.push(item)
		}
		return { available, chartData }
	}, [data, selectedUnlocksChartType])

	const allocationPieChartColors = data?.stackColors?.documented ?? EMPTY_CHART_COLORS

	const unlockedPercent = useMemo(() => {
		const totalLocked = data?.meta?.totalLocked
		const maxSupply = data?.meta?.maxSupply
		if (totalLocked == null || maxSupply == null) return null
		if (maxSupply === 0) return null
		const percent = 100 - (totalLocked / maxSupply) * 100
		return Math.min(100, Math.max(0, percent))
	}, [data])

	const lockedUnlockedPieChartData = useMemo(
		() =>
			unlockedPercent == null || selectedUnlocksChartType !== 'locked-unlocked'
				? []
				: [
						{ name: 'Unlocked', value: unlockedPercent },
						{ name: 'Locked', value: 100 - unlockedPercent }
					],
		[unlockedPercent, selectedUnlocksChartType]
	)

	const totalCharts = useMemo<NonNullable<IMultiSeriesChartProps['charts']>>(
		() => [
			{
				type: 'line',
				name: TOTAL_UNLOCKS_SERIES_NAME,
				encode: { x: 'timestamp', y: TOTAL_UNLOCKS_SERIES_NAME },
				color: totalUnlocksColor,
				stack: 'value'
			}
		],
		[totalUnlocksColor]
	)

	const totalDataset = useMemo<MultiSeriesChartDataset>(() => {
		if (selectedUnlocksChartType !== 'total') return EMPTY_TOTAL_UNLOCKS_DATASET
		const source = scheduleDataset.source
		if (!source.length) return EMPTY_TOTAL_UNLOCKS_DATASET
		const dimensions = scheduleDataset.dimensions
		const totalSource = new Array<MultiSeriesChartDataset['source'][number]>(source.length)
		for (let i = 0; i < source.length; i++) {
			const entry = source[i]
			let total = 0
			for (let j = 1; j < dimensions.length; j++) total += (entry[j] as number | null) ?? 0
			totalSource[i] = [entry[0], total]
		}
		return { source: totalSource, dimensions: ['timestamp', TOTAL_UNLOCKS_SERIES_NAME] }
	}, [scheduleDataset, selectedUnlocksChartType])

	const availableChartTypes = useMemo(() => {
		const available = new Set<'total' | 'schedule' | 'allocation' | 'locked-unlocked'>()
		if (scheduleDataset.source.length > 0) available.add('total')
		if (scheduleDataset.source.length > 0 && stacks.length > 0) available.add('schedule')
		if (allocationPieChart.available) available.add('allocation')
		if (unlockedPercent != null) available.add('locked-unlocked')
		return available
	}, [scheduleDataset.source.length, stacks.length, allocationPieChart.available, unlockedPercent])

	const chartTypeOptions = useMemo(
		() =>
			UNLOCKS_CHART_TYPES.map((type) => ({
				...type,
				disabled: !availableChartTypes.has(type.value as 'total' | 'schedule' | 'allocation' | 'locked-unlocked')
			})),
		[availableChartTypes]
	)

	useEffect(() => {
		if (!availableChartTypes.has(selectedUnlocksChartType)) {
			const nextType = UNLOCKS_CHART_TYPES.find((type) =>
				availableChartTypes.has(type.value as 'total' | 'schedule' | 'allocation' | 'locked-unlocked')
			)
			if (nextType) {
				onSelectedUnlocksChartTypeChange(nextType.value as 'total' | 'schedule' | 'allocation' | 'locked-unlocked')
			}
		}
	}, [availableChartTypes, selectedUnlocksChartType, onSelectedUnlocksChartTypeChange])

	const handleProtocolChange = (option: VirtualizedSelectOption) => {
		onSelectedUnlocksProtocolChange(option.value)
		onSelectedUnlocksProtocolNameChange(option.label)
		onSelectedUnlocksChartTypeChange('total')
	}

	const hasSelection = Boolean(selectedUnlocksProtocol)
	const previewTitle = selectedUnlocksProtocolName || selectedUnlocksProtocol || ''
	const selectedChartLabel = UNLOCKS_CHART_TYPES.find((t) => t.value === selectedUnlocksChartType)?.label || ''
	let chartContent: ReactNode
	if (isLoading) {
		chartContent = (
			<div className="flex h-[320px] items-center justify-center">
				<LocalLoader />
			</div>
		)
	} else if (selectedUnlocksChartType === 'total') {
		if (totalDataset.source.length === 0) {
			chartContent = (
				<div className="flex h-[320px] items-center justify-center text-center text-pro-text-tertiary">
					No unlocks data.
				</div>
			)
		} else {
			chartContent = (
				<Suspense fallback={<div className="h-[320px]" />}>
					<MultiSeriesChart
						dataset={totalDataset}
						charts={totalCharts}
						valueSymbol="$"
						hideDataZoom
						hallmarks={todayHallmarks}
						hallmarkStyle="mark-line"
						chartOptions={TOTAL_UNLOCKS_CHART_OPTIONS}
						exportButtons="hidden"
					/>
				</Suspense>
			)
		}
	} else if (selectedUnlocksChartType === 'schedule') {
		if (scheduleDataset.source.length === 0 || stacks.length === 0) {
			chartContent = (
				<div className="flex h-[320px] items-center justify-center text-center text-pro-text-tertiary">
					No unlocks data.
				</div>
			)
		} else {
			chartContent = (
				<Suspense fallback={<div className="h-[320px]" />}>
					<MultiSeriesChart
						dataset={scheduleDataset}
						charts={scheduleCharts}
						selectedCharts={scheduleSelection.selectedCharts}
						hideDataZoom
						hallmarks={todayHallmarks}
						valueSymbol=""
					/>
				</Suspense>
			)
		}
	} else if (selectedUnlocksChartType === 'allocation') {
		if (allocationPieChart.chartData.length === 0) {
			chartContent = (
				<div className="flex h-[320px] items-center justify-center text-center text-pro-text-tertiary">
					No unlocks data.
				</div>
			)
		} else {
			chartContent = (
				<Suspense fallback={<div className="h-[320px]" />}>
					<PieChart chartData={allocationPieChart.chartData} stackColors={allocationPieChartColors} />
				</Suspense>
			)
		}
	} else if (selectedUnlocksChartType === 'locked-unlocked') {
		if (lockedUnlockedPieChartData.length === 0) {
			chartContent = (
				<div className="flex h-[320px] items-center justify-center text-center text-pro-text-tertiary">
					No unlocks data.
				</div>
			)
		} else {
			chartContent = (
				<Suspense fallback={<div className="h-[320px]" />}>
					<PieChart chartData={lockedUnlockedPieChartData} stackColors={LOCKED_UNLOCKED_COLORS} valueSymbol="%" />
				</Suspense>
			)
		}
	} else {
		chartContent = (
			<div className="flex h-[320px] items-center justify-center text-center text-pro-text-tertiary">
				No unlocks data.
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="space-y-3">
				<AriakitVirtualizedSelect
					label="Protocol"
					options={unlocksProtocolOptions}
					selectedValue={selectedUnlocksProtocol || ''}
					onChange={handleProtocolChange}
					placeholder="Select protocol..."
					isLoading={protocolsLoading || unlocksProtocolsLoading}
				/>

				<div className={`grid grid-cols-1 gap-3 ${!hasSelection ? 'pointer-events-none opacity-50' : ''}`}>
					<AriakitSelect
						label="Chart Type"
						options={chartTypeOptions}
						selectedValue={selectedUnlocksChartType}
						onChange={(option) =>
							onSelectedUnlocksChartTypeChange(option.value as 'total' | 'schedule' | 'allocation' | 'locked-unlocked')
						}
						placeholder="Select chart type..."
					/>
				</div>

				{hasSelection && !isLoading && availableChartTypes.size === 0 ? (
					<p className="text-xs text-pro-text-tertiary">No unlocks data available for this protocol.</p>
				) : null}
			</div>

			<div className="overflow-hidden rounded-lg border pro-border">
				<h4 className="border-b border-pro-cards-border px-3 py-2 text-xs font-medium text-pro-text-secondary">
					Preview
				</h4>
				{hasSelection ? (
					<div className="bg-pro-cards-bg p-3">
						<div className="mb-3 flex flex-wrap items-start justify-between gap-2">
							<div>
								<h3 className="mb-1 text-sm font-semibold text-pro-text-primary">
									{previewTitle} - {selectedChartLabel}
								</h3>
								<p className="text-xs text-pro-text-secondary">Unlocks</p>
							</div>
							{selectedUnlocksChartType === 'schedule' && stacks.length > 1 ? (
								<SelectWithCombobox
									allValues={stacks}
									selectedValues={scheduleSelection.activeSeries}
									setSelectedValues={scheduleSelection.setSelectedSeries}
									label="Category"
									labelType="smol"
									variant="filter"
									size="md"
								/>
							) : null}
						</div>
						{chartContent}
					</div>
				) : (
					<div className="flex h-[320px] items-center justify-center text-center text-pro-text-tertiary">
						<div>
							<Icon name="linear-unlock" height={32} width={32} className="mx-auto mb-1" />
							<p className="text-xs">Select a protocol to preview unlocks</p>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
