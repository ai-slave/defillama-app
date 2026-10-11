import Link from 'next/link'
import { useRouter } from 'next/router'
import { lazy, Suspense, useState, type FormEvent } from 'react'
import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import { readSelectionFromQuery } from '~/components/Select/query'
import { UrlSelectWithCombobox } from '~/components/Select/UrlSelect'
import { TokenLogo } from '~/components/TokenLogo'
import { CHART_COLORS } from '~/constants/colors'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanelBody } from '~/ui/ChartPanel'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SearchField } from '~/ui/SearchField'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { InlineStatus, PanelLoadingStatus, PanelStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { Switch } from '~/ui/Switch'
import { formatDate, formatMonthYear } from '~/utils/dateFormat'
import { formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { isTrueQueryParam, pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import { EquitiesPageHeader, StaleDataNotice } from './AggregateShared'
import {
	addCalendarDays,
	buildEarningsCalendarView,
	buildEarningsCalendarWeek,
	buildEarningsCalendarWeekExposure,
	buildSecFilingUrl,
	cleanEarningsCompanyName,
	type EarningsCalendarBootstrapSeed,
	type EarningsCalendarSearchResult,
	type EarningsCalendarStatus,
	type EarningsMarketCapOption,
	getEarningsCalendarDisplayDate,
	getEarningsCalendarStatus,
	type IEarningsCalendarBootstrap,
	searchEarningsCalendarCompanies
} from './earningsCalendarData'
import { useEquitiesEarningsCalendar } from './queries.client'
import type { IEquitiesCalendarRow } from './types'

/* Earnings calendar. Each event names its status in text (Reported, Projected, Past due); past due reads in
   text-warning. Day count bars use the single-series chart color `CHART_COLORS[0]`, never a text or surface token.
   High-cardinality filters (market cap, sector, month) are compact SelectWithCombobox triggers, never full chip rows,
   and filing links stay inline with each event's period metadata so weekly columns stay easy to scan. */

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const MARKET_CAP_OPTIONS: ReadonlyArray<{ key: EarningsMarketCapOption; name: string; help: string }> = [
	{ key: 'mega', name: 'Mega', help: '$200B and above' },
	{ key: 'large', name: 'Large', help: '$10B to $200B' },
	{ key: 'mid', name: 'Mid', help: '$2B to $10B' },
	{ key: 'small', name: 'Small', help: '$300M to $2B' },
	{ key: 'micro', name: 'Micro', help: 'Below $300M' },
	{ key: 'unknown', name: 'Unknown', help: 'No market cap in the company data' }
]
const MARKET_CAP_KEYS = MARKET_CAP_OPTIONS.map((option) => option.key)

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATUS_LABELS: Record<EarningsCalendarStatus, string> = {
	reported: 'Reported',
	projected: 'Projected',
	pastDue: 'Past due'
}

function formatCap(value: number | null): string {
	return value == null ? '—' : (formatUsd(value, { compact: true, maximumFractionDigits: 2 }) ?? '—')
}

function formatWeekRange(monday: string, friday: string): string {
	const mondayLabel = formatDate(monday) ?? monday
	const fridayLabel = formatDate(friday) ?? friday
	return `${mondayLabel} – ${fridayLabel}`
}

function getDayStatusLabel(rows: ReadonlyArray<IEquitiesCalendarRow>, todayET: string): string {
	const counts = { reported: 0, projected: 0, pastDue: 0 }
	for (const row of rows) counts[getEarningsCalendarStatus(row, todayET)]++
	const parts = [
		counts.reported ? `${counts.reported} reported` : null,
		counts.projected ? `${counts.projected} projected` : null,
		counts.pastDue ? `${counts.pastDue} past due` : null
	].filter(Boolean)
	return parts.join(' · ') || 'No reports'
}

function WindowBar({ drift }: { drift: number }) {
	const width = Math.max(8, Math.min(100, (drift / 30) * 100))
	return (
		<span className="flex min-w-20 items-center gap-2">
			<span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated-2">
				<span
					className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-border-strong"
					style={{ width: `${width}%` }}
				/>
			</span>
			<span className="label-sm text-tertiary">±{drift}d</span>
		</span>
	)
}

function EarningsCard({ row, todayET }: { row: IEquitiesCalendarRow; todayET: string }) {
	const status = getEarningsCalendarStatus(row, todayET)
	const filingUrl = buildSecFilingUrl(row.cik, row.accession_number)
	const session =
		row.report_time === 'bmo'
			? 'Before open'
			: row.report_time === 'amc'
				? 'After close'
				: row.report_time === 'dmt'
					? 'Market hours'
					: null
	return (
		<Card padding="sm" className="flex flex-col gap-1.5">
			<div className="flex items-start gap-2">
				<TokenLogo kind="equities" name={row.ticker} country={row.country} size={24} />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						{row.href ? (
							<Link href={row.href} className="label-md text-link hover:underline">
								{row.ticker}
							</Link>
						) : (
							<span className="label-md">{row.ticker}</span>
						)}
						<span className="ml-auto label-sm text-secondary">{formatCap(row.marketCap)}</span>
					</div>
					<p className="truncate body-sm text-secondary">{cleanEarningsCompanyName(row.name)}</p>
				</div>
			</div>
			{/* One fact per line, each kept to one line, so every card in a day column has the same height: the
			    quarter and report time, then the status with its filing or its timing window. */}
			<p className="truncate body-sm text-tertiary">
				{row.fiscal_period} FY{String(row.fiscal_year).slice(-2)}
				{session ? ` · ${session}` : ''}
			</p>
			<div className="flex min-w-0 items-center justify-between gap-2">
				<span className={`body-sm whitespace-nowrap ${status === 'pastDue' ? 'text-warning' : 'text-secondary'}`}>
					{STATUS_LABELS[status]}
				</span>
				{status === 'reported' ? (
					<span className="flex items-center gap-2 label-sm text-secondary">
						{filingUrl ? (
							<a
								href={filingUrl}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={`SEC filing for ${row.ticker} (opens in a new tab)`}
								className="inline-flex items-center gap-1 text-link hover:underline"
							>
								SEC <Icon name="external-link" className="size-3" aria-hidden="true" />
							</a>
						) : null}
					</span>
				) : row.max_drift_days == null ? null : (
					<WindowBar drift={row.max_drift_days} />
				)}
			</div>
		</Card>
	)
}

function SeasonsChart({ summary }: { summary: Pick<IEarningsCalendarBootstrap, 'monthBuckets' | 'pastCount'> }) {
	const months = summary.monthBuckets
	const labels = ['Last 31 days', ...months.map((month) => formatMonthYear(`${month.month}-01`) ?? month.month)]
	const dataset = {
		dimensions: ['Period', 'Reports'],
		source: labels.map((label, index) => [label, index === 0 ? summary.pastCount : months[index - 1]!.count])
	}

	return (
		// Compact beside the "At stake this week" panel, which holds about 180px of content.
		<ChartPanelBody className="min-h-[220px]">
			<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" className="min-h-[220px]" />}>
				<MultiSeriesChart
					dataset={dataset}
					charts={[{ type: 'bar', name: 'Reports', encode: { x: 'Period', y: 'Reports' }, barMaxWidth: 48 }]}
					chartOptions={{
						...createCategoryChartOptions(''),
						yAxis: { min: 0, minInterval: 1, name: 'Companies' },
						xAxis: { type: 'category', boundaryGap: true, axisLabel: { interval: 0, rotate: 30 } }
					}}
					valueSymbol=""
					exportButtons="hidden"
					hideDataZoom
					containerClassName="min-h-[220px]"
				/>
			</Suspense>
		</ChartPanelBody>
	)
}

function WeekExposure({
	rows,
	monday,
	todayET
}: {
	rows: ReadonlyArray<IEquitiesCalendarRow>
	monday: string
	todayET: string
}) {
	const exposure = buildEarningsCalendarWeekExposure(rows, monday, todayET)
	const maxMarketCap = Math.max(...exposure.days.map((day) => day.marketCap), 1)
	return (
		<div className="flex min-h-[176px] flex-col gap-2 px-3 pb-3">
			<div className="flex flex-col gap-2">
				{exposure.days.map((day, index) => {
					const topCompanies = day.rows.slice(0, 5)
					const remainingRows = day.rows.slice(5)
					const remainingMarketCap = remainingRows.reduce((total, row) => total + (row.marketCap ?? 0), 0)
					const weekday = WEEKDAY_LABELS[index + 1]
					const companies = `${day.companyCount} ${day.companyCount === 1 ? 'company' : 'companies'}`
					return (
						<Hovercard
							key={day.date}
							placement="bottom-start"
							render={
								<button type="button" aria-label={`${weekday}: ${formatCap(day.marketCap)} across ${companies}`} />
							}
							className="hover-wash w-full rounded-md text-left"
							width="md"
							content={
								<div className="flex flex-col gap-2">
									<div>
										<p className="label-md text-primary">
											{weekday} · {formatDate(day.date) ?? day.date}
										</p>
										<p className="body-sm text-secondary">
											{formatCap(day.marketCap)} across {companies}
										</p>
									</div>
									{topCompanies.length > 0 ? (
										<div className="flex flex-col gap-2 border-t border-subtle pt-2">
											{topCompanies.map((row) => (
												<div key={`${row.ticker}:${row.event_key}`} className="flex items-center gap-2">
													<TokenLogo kind="equities" name={row.ticker} country={row.country} size={20} />
													<div className="min-w-0 flex-1">
														<p className="truncate label-sm text-primary">
															{row.ticker} · {cleanEarningsCompanyName(row.name)}
														</p>
														<p className="body-sm text-tertiary">
															{buildSecFilingUrl(row.cik, row.accession_number)
																? 'SEC-confirmed'
																: STATUS_LABELS[getEarningsCalendarStatus(row, todayET)]}
														</p>
													</div>
													<div className="text-right">
														<p className="label-sm text-primary">{formatCap(row.marketCap)}</p>
														<p className="body-sm text-tertiary">
															{row.marketCap != null && day.marketCap > 0
																? formatPercent(row.marketCap / day.marketCap, {
																		input: 'fraction',
																		maximumFractionDigits: 1
																	})
																: '—'}
														</p>
													</div>
												</div>
											))}
											{remainingRows.length > 0 ? (
												<p className="border-t border-subtle pt-2 body-sm text-secondary">
													+{remainingRows.length} more · {formatCap(remainingMarketCap)}
												</p>
											) : null}
										</div>
									) : (
										<p className="body-sm text-tertiary">No companies reporting.</p>
									)}
								</div>
							}
						>
							<span className="grid w-full grid-cols-[2rem_4.5rem_1fr_auto] items-center gap-2 px-1 py-0.5">
								<span className="body-sm text-secondary">{weekday}</span>
								<span className="text-right label-md">{formatCap(day.marketCap)}</span>
								<span className="h-2 overflow-hidden rounded-full bg-surface-elevated-2">
									<span
										className="block h-full rounded-full"
										style={{
											backgroundColor: CHART_COLORS[0],
											width: day.marketCap === 0 ? '0%' : `${Math.max(1, (day.marketCap / maxMarketCap) * 100)}%`
										}}
									/>
								</span>
								<span className="w-10 text-right body-sm text-tertiary">
									{day.companyCount} {day.companyCount === 1 ? 'co' : 'cos'}
								</span>
							</span>
						</Hovercard>
					)
				})}
			</div>
			<p className="mt-auto border-t border-subtle pt-2 body-sm text-secondary">
				<span className="label-md text-primary">{formatCap(exposure.marketCap)}</span> reporting ·{' '}
				{exposure.companyCount} companies · {exposure.secConfirmedCount} SEC-confirmed · {exposure.projectedCount}{' '}
				projected
				{exposure.pastDueCount > 0 ? ` · ${exposure.pastDueCount} past due` : ''}
			</p>
		</div>
	)
}

type EarningsCalendarDay = ReturnType<typeof buildEarningsCalendarWeek>['days'][number]

function EarningsDayPanel({
	day,
	busiestCount,
	todayET
}: {
	day: EarningsCalendarDay
	busiestCount: number
	todayET: string
}) {
	const [expanded, setExpanded] = useState(false)
	const isBusiest = day.rows.length > 0 && day.rows.length === busiestCount
	const visibleCards = expanded ? day.rows : day.cards
	return (
		<Panel className="min-w-0">
			<PanelHeader>
				{/* Three fixed rows, so the five day headers keep one height and their cards start level: a status
				    line beside the count wrapped the count below the date on busy days. */}
				<div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2">
					<p className="label-sm text-secondary">
						{WEEKDAY_LABELS[day.weekday]}
						{isBusiest ? ' · Busiest' : ''}
					</p>
					<p className="col-start-2 row-span-2 row-start-1 mono-xl">{day.rows.length}</p>
					<PanelTitle as="h3">{formatDate(day.date) ?? day.date}</PanelTitle>
					<p className="col-span-2 body-sm text-tertiary">{getDayStatusLabel(day.rows, todayET)}</p>
				</div>
			</PanelHeader>
			<div className="flex flex-col gap-2 p-2">
				{day.cards.length === 0 && day.rows.length > 0 ? (
					<p className="p-2 body-sm text-secondary">None of this week’s 12 largest companies report today.</p>
				) : null}
				{visibleCards.map((row) => (
					<EarningsCard key={`${row.ticker}:${row.event_key}`} row={row} todayET={todayET} />
				))}
				{day.rows.length === 0 ? <p className="py-8 text-center body-sm text-tertiary">No reports</p> : null}
				{day.remainingCount > 0 ? (
					<Button
						type="button"
						variant="secondary"
						size="md"
						className="w-full"
						aria-expanded={expanded}
						onClick={() => setExpanded((value) => !value)}
					>
						{expanded
							? 'Show top events'
							: day.cards.length > 0
								? `Show ${day.remainingCount} more`
								: `See all ${day.rows.length}`}
					</Button>
				) : null}
			</div>
		</Panel>
	)
}

export function EarningsCalendarPage({ bootstrap }: { bootstrap?: EarningsCalendarBootstrapSeed }) {
	const router = useRouter()
	const query = useEquitiesEarningsCalendar()
	const [searchQuery, setSearchQuery] = useState('')
	const [searchResult, setSearchResult] = useState<EarningsCalendarSearchResult | null>(null)

	if (!query.data && !bootstrap) {
		// Checked before loading, so a retry keeps the error and its button on screen until it succeeds.
		if (query.isPending && !queryReadFailed(query)) return <PanelLoadingStatus label="Loading earnings calendar" />
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn&apos;t load the earnings calendar.
			</PanelStatus>
		)
	}

	const view = buildEarningsCalendarView(query.data, bootstrap!)
	const { companies, rows, sectorOptions, summary, todayET } = view
	const activeDate = getEarningsCalendarDisplayDate(readSingleQueryValue(router.query.week), todayET, companies != null)
	const tightWindowsOnly = isTrueQueryParam(router.query.tightWindows)
	const week = buildEarningsCalendarWeek(rows, activeDate, {
		marketCapTiers: readSelectionFromQuery(router.query, 'marketCap', 'excludeMarketCap', MARKET_CAP_KEYS),
		sectorSlugs: readSelectionFromQuery(
			router.query,
			'sector',
			'excludeSector',
			sectorOptions.map((option) => option.key)
		),
		tightWindowsOnly
	})
	const setSelectedDate = (date: string) => void pushShallowQuery(router, { week: date === todayET ? undefined : date })

	const submitSearch = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!companies) return
		const result = searchEarningsCalendarCompanies(searchQuery, companies, rows, todayET)
		setSearchResult(result)
		if (result.kind === 'match' && result.company.nextEvent) setSelectedDate(result.company.nextEvent.report_date)
	}
	const busiestCount = Math.max(...week.days.map((day) => day.rows.length), 0)
	const canGoBack = companies != null && summary.bounds.first != null && week.monday > summary.bounds.first
	const canGoForward = companies != null && summary.bounds.last != null && week.monday < summary.bounds.last
	const monthOptions = summary.monthBuckets.map((month) => ({
		key: month.month,
		name: `${formatMonthYear(`${month.month}-01`) ?? month.month} (${formatNumber(month.count) ?? month.count})`
	}))

	return (
		<div className="flex flex-col gap-2">
			<EquitiesPageHeader
				crumb="Earnings calendar"
				title="Earnings calendar"
				description={`When ${formatNumber(summary.uniqueCompanyCount) ?? '0'} US companies report. Past dates come from SEC filings; upcoming dates are projections, never announced times.`}
			/>
			<StaleDataNotice stale={view.stale} updatedAt={view.updatedAt} />
			{queryReadFailed(query) ? (
				<InlineStatus variant="error" retry={query}>
					The full calendar didn’t load, so only this week is shown and search is off.
				</InlineStatus>
			) : null}

			<div className="grid grid-cols-1 items-start gap-2 xl:grid-cols-[2fr_1fr]">
				<Panel>
					<PanelHeader>
						<div className="mr-auto">
							<PanelTitle>Earnings seasons</PanelTitle>
							<p className="body-sm text-tertiary">Reports per month</p>
						</div>
						{companies ? (
							<SelectWithCombobox
								allValues={monthOptions}
								selectedValues={[week.monday.slice(0, 7)]}
								setSelectedValues={([month]) => setSelectedDate(summary.firstReportByMonth[month!]!)}
								singleSelect
								nestedMenu={false}
								label="Jump to month"
								variant="filter"
								size="md"
							/>
						) : null}
					</PanelHeader>
					<SeasonsChart summary={summary} />
				</Panel>
				<Panel>
					<PanelHeader>
						<PanelTitle>At stake this week</PanelTitle>
						<p className="ml-auto label-sm text-secondary">{formatWeekRange(week.monday, week.friday)}</p>
					</PanelHeader>
					<WeekExposure rows={week.rows} monday={week.monday} todayET={todayET} />
				</Panel>
			</div>

			<Panel>
				<PanelHeader>
					<div className="mr-auto flex items-center gap-1.5">
						<Button
							type="button"
							variant="secondary"
							size="md"
							aria-label="Previous week"
							disabled={!canGoBack}
							accessibleWhenDisabled
							onClick={() => setSelectedDate(addCalendarDays(week.monday, -7))}
						>
							<Icon name="chevron-left" className="size-4" />
						</Button>
						<h2 className="heading-xs" aria-live="polite">
							{formatWeekRange(week.monday, week.friday)}
						</h2>
						<Button
							type="button"
							variant="secondary"
							size="md"
							aria-label="Next week"
							disabled={!canGoForward}
							accessibleWhenDisabled
							onClick={() => setSelectedDate(addCalendarDays(week.monday, 7))}
						>
							<Icon name="chevron-right" className="size-4" />
						</Button>
						<Button type="button" variant="secondary" size="md" onClick={() => setSelectedDate(todayET)}>
							This week
						</Button>
					</div>
					<form noValidate onSubmit={submitSearch} className="flex w-full min-w-0 gap-1.5 sm:w-auto">
						<SearchField
							label="Search ticker or company"
							value={searchQuery}
							onChange={setSearchQuery}
							placeholder="Search ticker or company"
							width="inline"
						/>
						<Button type="submit" variant="secondary" size="md" disabled={!companies}>
							Search
						</Button>
					</form>
				</PanelHeader>
				<div className="flex flex-wrap items-center gap-2 p-2">
					<UrlSelectWithCombobox
						allValues={MARKET_CAP_OPTIONS}
						includeQueryKey="marketCap"
						excludeQueryKey="excludeMarketCap"
						nestedMenu={false}
						label="Market Cap"
						labelType="regular"
						variant="filter"
						size="md"
					/>
					<UrlSelectWithCombobox
						allValues={sectorOptions}
						includeQueryKey="sector"
						excludeQueryKey="excludeSector"
						nestedMenu={false}
						label="Sector"
						labelType="regular"
						variant="filter"
						size="md"
					/>
					<Switch
						label="Tight windows only · ≤ ±7d"
						value="tight-windows"
						checked={tightWindowsOnly}
						onChange={(event) =>
							void pushShallowQuery(router, { tightWindows: event.target.checked ? 'true' : undefined })
						}
					/>
					<p className="ml-auto body-sm text-secondary">
						{formatNumber(week.companyCount) ?? '0'} companies · ranked by market cap
					</p>
				</div>
			</Panel>

			{searchResult?.kind === 'no-results' ? (
				<InlineStatus variant="empty">No companies match “{searchResult.query}”.</InlineStatus>
			) : null}
			{searchResult?.kind === 'no-dates' ? (
				<InlineStatus variant="empty">No earnings dates for {searchResult.company.ticker} in this window.</InlineStatus>
			) : null}

			<div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
				{week.days.map((day) => (
					<EarningsDayPanel key={day.date} day={day} busiestCount={busiestCount} todayET={todayET} />
				))}
			</div>

			<footer className="flex flex-wrap justify-between gap-2 py-4 body-sm text-tertiary">
				<p>Projected dates show the window around the most likely day, such as ±7d.</p>
				<p>Names and market caps come from company data · dates come from SEC EDGAR and DefiLlama projections.</p>
			</footer>
		</div>
	)
}
