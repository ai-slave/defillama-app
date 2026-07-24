import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useRouter } from 'next/router'
import * as React from 'react'
import { lazy, Suspense } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { buildSelectedAdditiveChart, buildSelectedSeriesCsv } from '~/components/ECharts/MultiSeriesChart/selection'
import type { IMultiSeriesChartProps, MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useWatchlistManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useSeriesSelection } from '~/hooks/useSeriesSelection'
import { Button } from '~/ui/Button'
import { ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { TagGroup } from '~/ui/SegmentedControl'
import { formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import { CalendarDayCell } from './CalendarDayCell'
import type { CalendarViewProps, CalendarUnlockEvent, DailyUnlocks, DayInfo } from './calendarTypes'
import { generateCalendarDays, generateWeekDays } from './calendarUtils'
import { DAYS_OF_WEEK } from './constants'
import { UnlocksListView } from './UnlocksListView'
import { useUnlockChartData } from './useUnlockChartData'
import { WeekDayColumn } from './WeekDayColumn'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const UnlocksTreemapChart = lazy(() => import('./TreemapChart'))

const VIEW_MODES = ['Month', 'Week', 'TreeMap', 'List'] as const

export const CalendarView: React.FC<CalendarViewProps> = ({ initialUnlocksData, precomputedData }) => {
	const router = useRouter()

	const viewParam = readSingleQueryValue(router.query.view)
	const viewMode: (typeof VIEW_MODES)[number] =
		viewParam && (VIEW_MODES as readonly string[]).includes(viewParam)
			? (viewParam as (typeof VIEW_MODES)[number])
			: 'Month'

	const showOnlyWatchlist = readSingleQueryValue(router.query.watchlist) === 'true'
	const showOnlyInsider = readSingleQueryValue(router.query.insiders) === 'true'

	const dateParam = readSingleQueryValue(router.query.date)
	const currentDate = React.useMemo(() => {
		if (!dateParam) return dayjs()
		const parsed = dayjs(dateParam)
		return parsed.isValid() ? parsed : dayjs()
	}, [dateParam])

	const setQueryParams = React.useCallback(
		(updates: Record<string, string | undefined>) => {
			void pushShallowQuery(router, updates)
		},
		[router]
	)

	const { savedProtocols } = useWatchlistManager('defi')

	const unlocksData: {
		[date: string]: DailyUnlocks
	} = React.useMemo(() => {
		let filteredData = initialUnlocksData
		if (!filteredData) return {}

		if (showOnlyWatchlist || showOnlyInsider) {
			filteredData = {}
			for (const date in initialUnlocksData) {
				const dailyData = initialUnlocksData[date]
				const filteredEvents = dailyData.events.filter(
					(event) =>
						(!showOnlyWatchlist || savedProtocols.has(event.protocol)) &&
						(!showOnlyInsider || event.category === 'insiders')
				)

				if (filteredEvents.length > 0) {
					let totalValue = 0
					for (const event of filteredEvents) totalValue += event.value
					filteredData[date] = { ...dailyData, events: filteredEvents, totalValue }
				}
			}
		}

		return filteredData
	}, [initialUnlocksData, showOnlyWatchlist, showOnlyInsider, savedProtocols])

	const calendarDays = React.useMemo(() => {
		if (viewMode === 'TreeMap' || viewMode === 'List') return []

		if (viewMode === 'Week') {
			return generateWeekDays(currentDate) as DayInfo[]
		}
		return generateCalendarDays(currentDate) as DayInfo[]
	}, [currentDate, viewMode])

	const listEventsData = React.useMemo(() => {
		if (viewMode !== 'List') return []

		const startKey = currentDate.startOf('day').format('YYYY-MM-DD')

		// Only use server-precomputed list when unfiltered.
		// Watchlist/insider filters must be computed client-side.
		if (!showOnlyWatchlist && !showOnlyInsider && precomputedData?.listEvents[startKey]) {
			return precomputedData.listEvents[startKey].map(({ date, event }) => ({
				date: dayjs(date),
				event
			}))
		}

		const endKey = currentDate.startOf('day').add(30, 'days').format('YYYY-MM-DD')
		const events: Array<{ date: Dayjs; event: CalendarUnlockEvent }> = []

		for (const dateStr in unlocksData) {
			if (dateStr >= startKey && dateStr < endKey) {
				const date = dayjs(dateStr)
				for (const event of unlocksData[dateStr].events) {
					events.push({ date, event })
				}
			}
		}

		return events.toSorted((a, b) => a.date.valueOf() - b.date.valueOf())
	}, [currentDate, viewMode, unlocksData, precomputedData, showOnlyWatchlist, showOnlyInsider])

	const { weeklyChart, monthlyChart } = useUnlockChartData({
		currentDate,
		viewMode,
		unlocksData,
		// Only use server-precomputed chart payloads for the unfiltered view.
		// Filtered modes (watchlist/insiders) must be computed client-side.
		precomputedData: showOnlyWatchlist || showOnlyInsider ? undefined : precomputedData
	})
	const currentChart = viewMode === 'Week' ? weeklyChart : viewMode === 'Month' ? monthlyChart : null
	const protocolSeries = React.useMemo(
		() => currentChart?.charts.map((chart) => chart.name) ?? [],
		[currentChart?.charts]
	)
	const { activeSeries, selectedCharts, setSelectedSeries } = useSeriesSelection({
		availableSeries: protocolSeries,
		selectionKey: 'calendar-protocols'
	})
	const selectedChart = React.useMemo(
		() =>
			currentChart
				? buildSelectedAdditiveChart({
						dataset: currentChart.dataset,
						charts: currentChart.charts,
						seriesOrder: protocolSeries,
						selectedCharts
					})
				: null,
		[currentChart, protocolSeries, selectedCharts]
	)

	const maxMonthlyValue = React.useMemo(() => {
		if (viewMode !== 'Month') return 0

		// precomputedData uses 0-indexed month keys (e.g. "2026-01" for February)
		const cacheKey = `${currentDate.year()}-${currentDate.month().toString().padStart(2, '0')}`
		if (precomputedData?.monthlyMaxValues[cacheKey] !== undefined) {
			return precomputedData.monthlyMaxValues[cacheKey]
		}

		// unlocksData keys are YYYY-MM-DD (1-indexed month from dayjs .format())
		const datePrefix = `${currentDate.year()}-${(currentDate.month() + 1).toString().padStart(2, '0')}`
		let max = 0
		for (const dateStr in unlocksData) {
			if (dateStr.startsWith(datePrefix)) {
				const val = unlocksData[dateStr].totalValue
				if (val > max) max = val
			}
		}
		return max
	}, [currentDate, viewMode, unlocksData, precomputedData])

	const navigate = (direction: 1 | -1) => {
		const duration = viewMode === 'List' ? 30 : 1
		const unit = (viewMode === 'List' ? 'day' : viewMode === 'TreeMap' ? 'year' : viewMode.toLowerCase()) as
			| 'day'
			| 'week'
			| 'month'
			| 'year'
		const newDate = currentDate.add(duration * direction, unit)
		setQueryParams({ date: newDate.format('YYYY-MM-DD') })
	}

	const { chartInstance: exportChartInstance, handleChartReady: onChartReady } = useGetChartInstance()

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<div className="flex min-h-8 items-center rounded-lg border border-medium label-sm text-primary">
						<button
							onClick={() => navigate(-1)}
							className="flex min-h-8 shrink-0 items-center px-3 hover:bg-hover-row focus-visible:bg-hover-row"
							aria-label="Previous"
						>
							←
						</button>
						<span className="min-w-28 px-2 text-center label-sm text-primary">
							{viewMode === 'Month'
								? currentDate.format('MMM YYYY')
								: viewMode === 'Week'
									? `${currentDate.startOf('week').format('MMM D')} – ${currentDate.endOf('week').format('D')}`
									: viewMode === 'TreeMap'
										? currentDate.format('YYYY')
										: `${currentDate.format('MMM D')} – ${currentDate.add(30, 'day').format('MMM D')}`}
						</span>
						<button
							onClick={() => navigate(1)}
							className="flex min-h-8 shrink-0 items-center px-3 hover:bg-hover-row focus-visible:bg-hover-row"
							aria-label="Next"
						>
							→
						</button>
					</div>
					<Button
						type="button"
						onClick={() => {
							void router.push({ pathname: router.pathname }, undefined, { shallow: true })
						}}
						size="md"
					>
						Reset
					</Button>
				</div>
				<TagGroup
					variant="default"
					size="md"
					selectedValue={viewMode}
					setValue={(value) => {
						setQueryParams({ view: value === 'Month' ? undefined : value })
					}}
					values={[...VIEW_MODES]}
					className="ml-auto"
				/>
				{protocolSeries.length > 1 ? (
					<SelectWithCombobox
						allValues={protocolSeries}
						selectedValues={activeSeries}
						setSelectedValues={setSelectedSeries}
						label="Protocol"
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				<Button
					type="button"
					onClick={() => setQueryParams({ watchlist: showOnlyWatchlist ? undefined : 'true' })}
					size="md"
					aria-pressed={showOnlyWatchlist}
				>
					<Icon
						name="bookmark"
						height={16}
						width={16}
						style={{ fill: showOnlyWatchlist ? 'var(--text-primary)' : 'none' }}
					/>
					{showOnlyWatchlist ? 'Show All' : 'Show Watchlist'}
				</Button>
				<Button
					type="button"
					onClick={() => setQueryParams({ insiders: showOnlyInsider ? undefined : 'true' })}
					size="md"
					aria-pressed={showOnlyInsider}
				>
					<Icon name="key" height={16} width={16} style={{ fill: showOnlyInsider ? 'var(--text-primary)' : 'none' }} />
					{showOnlyInsider ? 'Show All' : 'Show Insiders Only'}
				</Button>
				{viewMode === 'Week' || viewMode === 'Month' ? (
					<ChartExportButtons
						chartInstance={exportChartInstance}
						filename={`unlocks-${viewMode.toLowerCase()}-view`}
						title={`Unlocks ${viewMode} View`}
						prepareCsvDirect={
							selectedChart
								? () =>
										buildSelectedSeriesCsv({
											dataset: selectedChart.dataset,
											charts: selectedChart.charts,
											selectedCharts: new Set(selectedChart.charts.map((chart) => chart.name)),
											filename: `unlocks-${viewMode.toLowerCase()}-view`
										})
								: undefined
						}
					/>
				) : null}
			</div>

			{viewMode === 'Week' && selectedChart ? (
				<Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart
						dataset={selectedChart.dataset}
						charts={selectedChart.charts}
						hideDefaultLegend={selectedChart.charts.length < 2}
						chartOptions={chartOptions}
						tooltipMaxItems={30}
						exportButtons="hidden"
						onReady={onChartReady}
					/>
				</Suspense>
			) : null}

			{viewMode === 'TreeMap' ? (
				<Suspense fallback={<div className="min-h-[600px]" />}>
					<UnlocksTreemapChart unlocksData={unlocksData} height="600px" filterYear={currentDate.year()} />
				</Suspense>
			) : viewMode === 'Month' ? (
				<>
					{selectedChart ? (
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								dataset={selectedChart.dataset}
								charts={selectedChart.charts}
								hideDefaultLegend={selectedChart.charts.length < 2}
								chartOptions={chartOptions}
								tooltipMaxItems={30}
								exportButtons="hidden"
								onReady={onChartReady}
							/>
						</Suspense>
					) : null}
					<div className="grid grid-cols-7 py-1 text-center label-sm text-secondary">
						{DAYS_OF_WEEK.map((day) => (
							<span key={day} role="columnheader">
								{day}
							</span>
						))}
					</div>
					<div className="grid grid-cols-7 grid-rows-6 gap-px border border-medium bg-border-medium">
						{calendarDays.map((day, i) => (
							<React.Fragment key={day.date?.format('YYYY-MM-DD') ?? i}>
								<CalendarDayCell dayInfo={day} unlocksData={unlocksData} maxUnlockValue={maxMonthlyValue} />
							</React.Fragment>
						))}
					</div>
				</>
			) : viewMode === 'Week' ? (
				<>
					<div className="grid grid-cols-1 gap-px border border-medium bg-border-medium md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
						{calendarDays.map((day) => (
							<React.Fragment key={day.date!.format('YYYY-MM-DD')}>
								<WeekDayColumn dayInfo={day as { date: Dayjs; isCurrentMonth: boolean }} unlocksData={unlocksData} />
							</React.Fragment>
						))}
					</div>
				</>
			) : (
				<UnlocksListView events={listEventsData} />
			)}
		</div>
	)
}

const chartOptions = {
	tooltip: {
		trigger: 'axis',
		formatter: (formatterParams: unknown) => {
			if (!Array.isArray(formatterParams) || formatterParams.length === 0) return ''
			const params = formatterParams as Array<{
				data?: unknown
				value?: unknown
				axisValue?: number | string
				seriesName?: string
				marker?: string
			}>

			const first = params[0]
			const ts =
				first?.data && typeof first.data === 'object' && !Array.isArray(first.data) && 'timestamp' in first.data
					? Number((first.data as Record<string, unknown>).timestamp)
					: Array.isArray(first?.value)
						? Number(first.value[0])
						: typeof first?.axisValue === 'number'
							? first.axisValue
							: Number.NaN

			const dateStr = Number.isFinite(ts) ? dayjs(ts).format('MMM D, YYYY') : ''
			let tooltipContent = `<div class="font-semibold mb-1">${dateStr}</div>`
			let totalValue = 0

			const getValue = (param: { data?: unknown; value?: unknown; seriesName?: string }) => {
				const dataObj =
					param?.data && typeof param.data === 'object' && !Array.isArray(param.data)
						? (param.data as Record<string, unknown>)
						: null
				const name = param?.seriesName
				const raw =
					dataObj && name && name in dataObj ? dataObj[name] : Array.isArray(param?.value) ? param.value[1] : null
				const v = typeof raw === 'number' ? raw : Number(raw)
				return Number.isFinite(v) ? v : 0
			}

			const validParams = params
				.map((param) => [param, getValue(param)] as const)
				.filter(([, v]) => v > 0)
				.toSorted((a, b) => b[1] - a[1])

			if (validParams.length === 0) {
				tooltipContent += 'No unlocks'
			} else {
				for (const [param, value] of validParams) {
					totalValue += value
					tooltipContent += `<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
					<span>${param.marker} ${param.seriesName}</span>
					<span style="font-weight: 500;">${formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</span>
				</div>`
				}
				if (validParams.length > 1) {
					tooltipContent += `<div style="border-top: 1px solid var(--border-subtle); margin-top: 4px; padding-top: 4px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
					<span><strong>Total</strong></span>
					<span style="font-weight: 600;">${formatUsd(totalValue, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</span>
				</div>`
				}
			}

			return `<div style="font-size: 0.75rem; line-height: 1rem;">${tooltipContent}</div>`
		}
	}
} satisfies MultiSeriesChartOptions
