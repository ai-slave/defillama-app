import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useRouter } from 'next/router'
import * as React from 'react'
import { lazy, Suspense } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { buildSelectedAdditiveChart } from '~/components/ECharts/MultiSeriesChart/selection'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useWatchlistManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useIsClient } from '~/hooks/useIsClient'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button, StableLabel } from '~/ui/Button'
import { ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { TagGroup } from '~/ui/SegmentedControl'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import { calendarChartOptions } from './calendarChartOptions'
import { CalendarDayCell } from './CalendarDayCell'
import {
	isWeeklyRateCalendarEvent,
	type CalendarViewProps,
	type CalendarUnlockEvent,
	type DailyUnlocks,
	type DayInfo
} from './calendarTypes'
import { calendarDateFromQuery, generateCalendarDays, generateWeekDays } from './calendarUtils'
import { DAYS_OF_WEEK } from './constants'
import { UnlocksListView } from './UnlocksListView'
import { useUnlockChartData } from './useUnlockChartData'
import { WeekDayColumn } from './WeekDayColumn'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const UnlocksTreemapChart = lazy(() => import('./TreemapChart'))

const VIEW_MODES = ['Month', 'Week', 'TreeMap', 'List'] as const

export function CalendarView({ initialUnlocksData, precomputedData }: CalendarViewProps) {
	const router = useRouter()

	const viewParam = readSingleQueryValue(router.query.view)
	const viewMode: (typeof VIEW_MODES)[number] =
		viewParam && (VIEW_MODES as ReadonlyArray<string>).includes(viewParam)
			? (viewParam as (typeof VIEW_MODES)[number])
			: 'Month'

	const showOnlyWatchlist = readSingleQueryValue(router.query.watchlist) === 'true'
	const showOnlyInsider = readSingleQueryValue(router.query.insiders) === 'true'

	const dateParam = readSingleQueryValue(router.query.date)
	const nowSec = useNowSeconds()
	const currentDate = React.useMemo(() => calendarDateFromQuery(dateParam, nowSec), [dateParam, nowSec])
	// Today is the visitor's local day, which the server cannot know, so it is marked after mount. It is read here
	// once, not per cell, so the cells skip the 30-second clock ticks.
	const isClient = useIsClient()
	const todayKey = isClient ? dayjs.unix(nowSec).format('YYYY-MM-DD') : null

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

		if (showOnlyWatchlist || showOnlyInsider) {
			filteredData = {}
			for (const date in initialUnlocksData) {
				const dailyData = initialUnlocksData[date]!
				const filteredEvents: Array<CalendarUnlockEvent> = []
				for (const event of dailyData.events) {
					if (showOnlyWatchlist && !savedProtocols.has(event.protocol)) continue
					if (showOnlyInsider && event.category !== 'insiders') continue
					filteredEvents.push(event)
				}

				if (filteredEvents.length > 0) {
					let totalValue = 0
					for (const event of filteredEvents) {
						if (!isWeeklyRateCalendarEvent(event)) totalValue += event.value
					}
					filteredData[date] = { ...dailyData, events: filteredEvents, totalValue }
				}
			}
		}

		return filteredData
	}, [initialUnlocksData, showOnlyWatchlist, showOnlyInsider, savedProtocols])

	const calendarDays = React.useMemo(() => {
		if (viewMode === 'TreeMap' || viewMode === 'List') return []

		if (viewMode === 'Week') {
			return generateWeekDays(currentDate) as Array<DayInfo>
		}
		return generateCalendarDays(currentDate) as Array<DayInfo>
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
				for (const event of unlocksData[dateStr]!.events) {
					events.push({ date, event })
				}
			}
		}

		return events.toSorted((a, b) => a.date.valueOf() - b.date.valueOf())
	}, [currentDate, viewMode, unlocksData, precomputedData, showOnlyWatchlist, showOnlyInsider])

	const chartDataOptions = {
		currentDate,
		viewMode,
		unlocksData,
		// Only use server-precomputed chart payloads for the unfiltered view.
		// Filtered modes (watchlist/insiders) must be computed client-side.
		...(showOnlyWatchlist || showOnlyInsider || precomputedData === undefined ? {} : { precomputedData })
	}
	const { weeklyChart, monthlyChart } = useUnlockChartData(chartDataOptions)
	const currentChart = viewMode === 'Week' ? weeklyChart : viewMode === 'Month' ? monthlyChart : null
	const protocolSeries = React.useMemo(
		() => currentChart?.charts.map((chart) => chart.name) ?? [],
		[currentChart?.charts]
	)
	const { activeSeries, selectedCharts, setSelectedSeries } = useLocalSelection({
		availableSeries: protocolSeries,
		scope: 'calendar-protocols'
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
				const val = unlocksData[dateStr]!.totalValue
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
							type="button"
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
							type="button"
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
					<StableLabel
						labels={['Show Watchlist', 'Show All']}
						current={showOnlyWatchlist ? 'Show All' : 'Show Watchlist'}
					/>
				</Button>
				<Button
					type="button"
					onClick={() => setQueryParams({ insiders: showOnlyInsider ? undefined : 'true' })}
					size="md"
					aria-pressed={showOnlyInsider}
				>
					<Icon name="key" height={16} width={16} style={{ fill: showOnlyInsider ? 'var(--text-primary)' : 'none' }} />
					<StableLabel
						labels={['Show Insiders Only', 'Show All']}
						current={showOnlyInsider ? 'Show All' : 'Show Insiders Only'}
					/>
				</Button>
				{viewMode === 'Week' || viewMode === 'Month' ? (
					<ChartExportButtons
						chartInstance={exportChartInstance}
						filename={`unlocks-${viewMode.toLowerCase()}-view`}
						title={`Unlocks ${viewMode} View`}
						csvSource={selectedChart?.csvSource ?? null}
					/>
				) : null}
			</div>

			{viewMode === 'Week' && selectedChart ? (
				<Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart
						dataset={selectedChart.dataset}
						charts={selectedChart.charts}
						hideDefaultLegend={selectedChart.charts.length < 2}
						chartOptions={calendarChartOptions}
						tooltipMaxItems={30}
						exportButtons="hidden"
						onReady={onChartReady}
					/>
				</Suspense>
			) : null}

			{viewMode === 'TreeMap' ? (
				<Suspense fallback={<div className="min-h-[600px]" />}>
					<UnlocksTreemapChart unlocksData={unlocksData} height="600px" calendarDate={currentDate} />
				</Suspense>
			) : viewMode === 'Month' ? (
				<>
					{selectedChart ? (
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								dataset={selectedChart.dataset}
								charts={selectedChart.charts}
								hideDefaultLegend={selectedChart.charts.length < 2}
								chartOptions={calendarChartOptions}
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
								<CalendarDayCell
									dayInfo={day}
									unlocksData={unlocksData}
									maxUnlockValue={maxMonthlyValue}
									isToday={todayKey !== null && day.date?.format('YYYY-MM-DD') === todayKey}
								/>
							</React.Fragment>
						))}
					</div>
				</>
			) : viewMode === 'Week' ? (
				<div className="grid grid-cols-1 gap-px border border-medium bg-border-medium md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
					{calendarDays.map((day) => (
						<React.Fragment key={day.date!.format('YYYY-MM-DD')}>
							<WeekDayColumn
								dayInfo={day as { date: Dayjs; isCurrentMonth: boolean }}
								unlocksData={unlocksData}
								isToday={day.date!.format('YYYY-MM-DD') === todayKey}
							/>
						</React.Fragment>
					))}
				</div>
			) : (
				<UnlocksListView events={listEventsData} />
			)}
		</div>
	)
}
