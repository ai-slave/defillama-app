import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Select } from '~/components/Select/Select'
import { TokenLogo } from '~/components/TokenLogo'
import { CHART_COLORS } from '~/constants/colors'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { InlineStatus, PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { Switch } from '~/ui/Switch'
import { formatDate, formatMonthYear } from '~/utils/dateFormat'
import { formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import { EquitiesPageHeader, StaleDataNotice } from './AggregateShared'
import type { IEquitiesEarningsCalendarApiItem } from './api.types'
import {
	addCalendarDays,
	buildEarningsCalendarMonthBuckets,
	buildEarningsCalendarSectorOptions,
	buildEarningsCalendarWeek,
	buildEarningsCalendarWeekExposure,
	buildSecFilingUrl,
	cleanEarningsCompanyName,
	getEarningsCalendarStatus,
	getEarningsCalendarWeekBounds,
	joinEarningsCalendarRows,
	searchEarningsCalendarCompanies,
	type EarningsCalendarSearchResult,
	type EarningsCalendarStatus,
	type EarningsMarketCapTier,
	type IEarningsCalendarBootstrap,
	type IEarningsCalendarRow
} from './earningsCalendarData'
import { useEquitiesEarningsCalendar } from './queries.client'
import type { IEquitiesCalendarCompany } from './types'

const EMPTY_CALENDAR_EVENTS: Array<IEquitiesEarningsCalendarApiItem> = []
const EMPTY_CALENDAR_COMPANIES: Array<IEquitiesCalendarCompany> = []
const EMPTY_CALENDAR_ROWS: Array<IEarningsCalendarRow> = []

const MARKET_CAP_OPTIONS = [
	{ key: 'all', name: 'All market caps' },
	{ key: 'mega', name: 'Mega · ≥$200B' },
	{ key: 'large', name: 'Large' },
	{ key: 'mid', name: 'Mid' },
	{ key: 'small', name: 'Small' },
	{ key: 'micro', name: 'Micro' }
] as const

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type EarningsCalendarBootstrapSeed = IEarningsCalendarBootstrap & {
	todayET: string
	updatedAt: string | null
	stale: boolean
}

function formatCap(value: number | null): string {
	return value == null ? '—' : (formatUsd(value, { compact: true, maximumFractionDigits: 2 }) ?? '—')
}

function formatWeekRange(monday: string, friday: string): string {
	const mondayLabel = formatDate(monday) ?? monday
	const fridayLabel = formatDate(friday) ?? friday
	const year = friday.slice(0, 4)
	return `${mondayLabel.replace(`, ${year}`, '')} – ${fridayLabel}`
}

function getDayStatusLabel(rows: ReadonlyArray<IEarningsCalendarRow>, todayET: string): string {
	const counts = { reported: 0, projected: 0, pastDue: 0 }
	for (const row of rows) counts[getEarningsCalendarStatus(row, todayET)]++
	const parts = [
		counts.reported ? `${counts.reported} reported` : null,
		counts.projected ? `${counts.projected} projected` : null,
		counts.pastDue ? `${counts.pastDue} past due` : null
	].filter(Boolean)
	return parts.join(' · ') || 'No reports'
}

function CalendarStatusMark({ status }: { status: EarningsCalendarStatus }) {
	const styles =
		status === 'reported'
			? 'border-data-up bg-data-up'
			: status === 'pastDue'
				? 'border-warning bg-transparent'
				: 'border-tertiary bg-transparent'
	return (
		<span
			aria-hidden="true"
			className={`inline-block size-2 rounded-full border ${status === 'reported' ? '' : 'border-dashed'} ${styles}`}
		/>
	)
}

function WindowBar({ drift }: { drift: number }) {
	const width = Math.max(8, Math.min(100, (drift / 30) * 100))
	return (
		<span className="flex min-w-20 items-center gap-2">
			<span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated-2">
				<span className="absolute top-0 bottom-0 left-1/2 w-px bg-secondary" />
				<span
					className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-secondary"
					style={{ width: `${width}%` }}
				/>
			</span>
			<span className="label-sm text-tertiary">±{drift}d</span>
		</span>
	)
}

function EarningsCard({ row, todayET }: { row: IEarningsCalendarRow; todayET: string }) {
	const status = getEarningsCalendarStatus(row, todayET)
	const filingUrl = buildSecFilingUrl(row.cik, row.accession_number)
	const session =
		row.report_time === 'bmo'
			? 'Before open'
			: row.report_time === 'amc'
				? 'After close'
				: row.report_time === 'dmt'
					? 'During market hours'
					: null
	return (
		<Card padding="sm" className="flex flex-col gap-1.5">
			<div className="flex items-start gap-2">
				<TokenLogo kind="equities" name={row.ticker} country={row.country} size={24} />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<CalendarStatusMark status={status} />
						{row.href ? (
							<Link href={row.href} className="label-md text-link hover:underline" aria-label={`Open ${row.name}`}>
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
			<div className="flex min-w-0 items-center justify-between gap-2">
				<span className="body-sm text-tertiary">
					{row.fiscal_period} FY{String(row.fiscal_year).slice(-2)}
				</span>
				{status === 'reported' ? (
					<span className="flex items-center gap-2 label-sm text-secondary">
						{session ? <span>{session}</span> : null}
						{filingUrl ? (
							<a
								href={filingUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-link hover:underline"
								onClick={(event) => event.stopPropagation()}
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

function SeasonsChart({
	rows,
	todayET,
	selectedMonday,
	onSelectDate,
	bootstrap
}: {
	rows: Array<IEarningsCalendarRow> | null
	todayET: string
	selectedMonday: string
	onSelectDate: (date: string) => void
	bootstrap?: EarningsCalendarBootstrapSeed
}) {
	const { months, pastCount, maxCount, firstReportByMonth } = (() => {
		if (rows === null) {
			const bootstrapMonths = bootstrap?.monthBuckets ?? []
			return {
				months: bootstrapMonths,
				pastCount: bootstrap?.pastCount ?? 0,
				maxCount: Math.max(...bootstrapMonths.map((month) => month.count), 1),
				firstReportByMonth: new Map(Object.entries(bootstrap?.firstReportByMonth ?? {}))
			}
		}
		const nextMonths = buildEarningsCalendarMonthBuckets(rows, todayET)
		const nextFirstReportByMonth = new Map<string, string>()
		let nextPastCount = 0
		for (const row of rows) {
			if (row.report_date < todayET) {
				nextPastCount++
				continue
			}
			const month = row.report_date.slice(0, 7)
			if (!nextFirstReportByMonth.has(month)) nextFirstReportByMonth.set(month, row.report_date)
		}
		return {
			months: nextMonths,
			pastCount: nextPastCount,
			maxCount: Math.max(...nextMonths.map((month) => month.count), 1),
			firstReportByMonth: nextFirstReportByMonth
		}
	})()
	const selectedMonth = selectedMonday.slice(0, 7)

	return (
		<div className="flex min-h-[176px] items-end gap-2 overflow-x-auto px-3 pb-3">
			<div className="flex min-w-16 flex-col items-center gap-2">
				<span className="label-sm text-tertiary">Last 31d</span>
				<div className="h-4 w-full rounded-sm" style={{ backgroundColor: CHART_COLORS[0] }} />
				<span className="label-sm">{pastCount}</span>
			</div>
			{months.map((month) => {
				const firstReport = firstReportByMonth.get(month.month)
				const isSelected = month.month === selectedMonth
				return (
					<button
						key={month.month}
						type="button"
						onClick={() => firstReport && onSelectDate(firstReport)}
						disabled={rows === null || !firstReport}
						className="group flex min-w-16 flex-1 flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
						aria-label={`Jump to ${formatMonthYear(`${month.month}-01`) ?? month.month}`}
					>
						<span
							className={`w-full rounded-sm transition-opacity ${isSelected ? 'opacity-100' : 'opacity-50 group-hover:opacity-75'}`}
							style={{ backgroundColor: CHART_COLORS[0], height: `${Math.max(10, (month.count / maxCount) * 100)}px` }}
						/>
						<span className="body-sm text-secondary">
							{formatMonthYear(`${month.month}-01`)?.split(' ')[0] ?? month.month}
						</span>
						<span className="label-sm">{month.count}</span>
					</button>
				)
			})}
		</div>
	)
}

function WeekExposure({ rows, monday }: { rows: ReadonlyArray<IEarningsCalendarRow>; monday: string }) {
	const exposure = buildEarningsCalendarWeekExposure(rows, monday)
	const maxMarketCap = Math.max(...exposure.days.map((day) => day.marketCap), 1)
	return (
		<div className="flex min-h-[176px] flex-col gap-2 px-3 pb-3">
			<div className="flex flex-col gap-2">
				{exposure.days.map((day, index) => {
					const topCompanies = day.rows.slice(0, 5)
					const remainingRows = day.rows.slice(5)
					const remainingMarketCap = remainingRows.reduce((total, row) => total + (row.marketCap ?? 0), 0)
					const weekday = WEEKDAY_LABELS[index + 1]
					return (
						<Hovercard
							key={day.date}
							placement="bottom-start"
							render={
								<button
									type="button"
									aria-label={`${weekday}: ${formatCap(day.marketCap)} across ${day.companyCount} ${day.companyCount === 1 ? 'company' : 'companies'}`}
								/>
							}
							className="hover-wash w-full rounded-md text-left"
							contentClassName="w-80 max-w-(--popover-available-width) p-3"
							content={
								<div className="flex flex-col gap-2">
									<div>
										<p className="label-md text-primary">
											{weekday} · {formatDate(day.date) ?? day.date}
										</p>
										<p className="body-sm text-secondary">
											{formatCap(day.marketCap)} across {day.companyCount}{' '}
											{day.companyCount === 1 ? 'company' : 'companies'}
										</p>
									</div>
									{topCompanies.length > 0 ? (
										<div className="flex flex-col gap-2 border-t border-subtle pt-2">
											{topCompanies.map((row) => {
												const filingUrl = buildSecFilingUrl(row.cik, row.accession_number)
												const share =
													row.marketCap != null && day.marketCap > 0
														? formatPercent(row.marketCap / day.marketCap, {
																input: 'fraction',
																maximumFractionDigits: 1
															})
														: '—'
												return (
													<div key={`${row.ticker}:${row.event_key}`} className="flex items-center gap-2">
														<TokenLogo kind="equities" name={row.ticker} country={row.country} size={20} />
														<div className="min-w-0 flex-1">
															<p className="truncate label-sm text-primary">
																{row.ticker} · {cleanEarningsCompanyName(row.name)}
															</p>
															<p className="body-sm text-tertiary">{filingUrl ? 'SEC-confirmed' : 'Projected'}</p>
														</div>
														<div className="text-right">
															<p className="label-sm text-primary">{formatCap(row.marketCap)}</p>
															<p className="body-sm text-tertiary">{share}</p>
														</div>
													</div>
												)
											})}
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
				{exposure.secConfirmedCount} SEC-confirmed · {exposure.projectedCount} projected
			</p>
		</div>
	)
}

export function EarningsCalendarPage({ bootstrap }: { bootstrap?: EarningsCalendarBootstrapSeed }) {
	const query = useEquitiesEarningsCalendar()
	const [selectedDate, setSelectedDate] = useState<string | null>(null)
	const [marketCapTier, setMarketCapTier] = useState<'all' | EarningsMarketCapTier>('all')
	const [sectorSlug, setSectorSlug] = useState('all')
	const [tightWindowsOnly, setTightWindowsOnly] = useState(false)
	const [expandedDays, setExpandedDays] = useState<Array<string>>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [searchResult, setSearchResult] = useState<EarningsCalendarSearchResult | null>(null)

	const data = query.data
	const events = data?.rows ?? EMPTY_CALENDAR_EVENTS
	const companies = data?.companies ?? EMPTY_CALENDAR_COMPANIES
	const rows = data ? joinEarningsCalendarRows(events, companies) : (bootstrap?.rows ?? EMPTY_CALENDAR_ROWS)
	const todayET = data?.todayET ?? bootstrap?.todayET ?? '1970-01-01'
	const activeDate = selectedDate ?? todayET
	const week = buildEarningsCalendarWeek(rows, activeDate, {
		marketCapTiers: marketCapTier === 'all' ? undefined : [marketCapTier],
		sectorSlug: sectorSlug === 'all' ? null : sectorSlug,
		tightWindowsOnly
	})
	const bounds = data ? getEarningsCalendarWeekBounds(rows) : (bootstrap?.bounds ?? { first: null, last: null })
	const uniqueCompanies = data ? new Set(rows.map((row) => row.ticker)).size : (bootstrap?.uniqueCompanyCount ?? 0)
	const sectorOptions = data
		? buildEarningsCalendarSectorOptions(companies)
		: (bootstrap?.sectorOptions ?? [{ key: 'all', name: 'All sectors' }])
	if (query.isPending && !bootstrap) return <PanelLoadingStatus label="Loading earnings calendar" />
	if ((query.isError || !data) && !bootstrap) {
		return (
			<PanelStatus variant="error">
				The earnings calendar is temporarily unavailable. Please try again shortly.
			</PanelStatus>
		)
	}

	const submitSearch = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!data) return
		const result = searchEarningsCalendarCompanies(searchQuery, companies, rows, todayET)
		setSearchResult(result)
		if (result.kind === 'matches' && result.companies[0]?.nextEvent)
			setSelectedDate(result.companies[0].nextEvent.report_date)
	}
	const busiestCount = Math.max(...week.days.map((day) => day.rows.length), 0)
	const quietThreshold = week.cards.at(-1)?.marketCap ?? null
	const canGoBack = data != null && bounds.first != null && week.monday > bounds.first
	const canGoForward = data != null && bounds.last != null && week.monday < bounds.last
	const marketCapLabel = MARKET_CAP_OPTIONS.find((option) => option.key === marketCapTier)?.name ?? 'All market caps'
	const sectorLabel = sectorOptions.find((option) => option.key === sectorSlug)?.name ?? 'All sectors'

	return (
		<div className="flex flex-col gap-2">
			<EquitiesPageHeader
				crumb="Earnings calendar"
				title="Earnings calendar"
				description={`When ${formatNumber(uniqueCompanies) ?? '0'} US companies report. Past dates come from SEC filings; upcoming dates are projections, never announced times.`}
				meta={
					<div
						className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 body-sm text-secondary sm:ml-auto sm:w-auto"
						aria-label="Earnings date status legend"
					>
						<span className="flex items-center gap-1.5">
							<CalendarStatusMark status="reported" /> Reported
						</span>
						<span className="flex items-center gap-1.5">
							<CalendarStatusMark status="projected" /> Projected
						</span>
						<span className="flex items-center gap-1.5">
							<CalendarStatusMark status="pastDue" /> Past due
						</span>
					</div>
				}
			/>
			<StaleDataNotice
				stale={data?.stale ?? bootstrap?.stale ?? false}
				updatedAt={data?.updatedAt ?? bootstrap?.updatedAt}
			/>

			<div className="grid grid-cols-1 gap-2 xl:grid-cols-[2fr_1fr]">
				<Panel padding="none">
					<PanelHeader>
						<div className="mr-auto">
							<PanelTitle>Earnings seasons</PanelTitle>
							<p className="body-sm text-tertiary">Reports per month · pick a month to jump</p>
						</div>
					</PanelHeader>
					<SeasonsChart
						rows={data ? rows : null}
						todayET={todayET}
						selectedMonday={week.monday}
						onSelectDate={setSelectedDate}
						bootstrap={bootstrap}
					/>
				</Panel>
				<Panel padding="none">
					<PanelHeader>
						<PanelTitle>At stake this week</PanelTitle>
						<p className="ml-auto label-sm text-secondary">{formatWeekRange(week.monday, week.friday)}</p>
					</PanelHeader>
					<WeekExposure rows={week.rows} monday={week.monday} />
				</Panel>
			</div>

			<Panel padding="none">
				<PanelHeader>
					<div className="mr-auto flex items-center gap-1.5">
						<Button
							type="button"
							variant="secondary"
							size="md"
							aria-label="Previous week"
							disabled={!canGoBack}
							onClick={() => setSelectedDate(addCalendarDays(week.monday, -7))}
						>
							<Icon name="chevron-left" className="size-4" />
						</Button>
						<h2 className="heading-xs">{formatWeekRange(week.monday, week.friday)}</h2>
						<Button
							type="button"
							variant="secondary"
							size="md"
							aria-label="Next week"
							disabled={!canGoForward}
							onClick={() => setSelectedDate(addCalendarDays(week.monday, 7))}
						>
							<Icon name="chevron-right" className="size-4" />
						</Button>
						<Button type="button" variant="secondary" size="md" onClick={() => setSelectedDate(todayET)}>
							This week
						</Button>
					</div>
					<form onSubmit={submitSearch} className="flex w-full min-w-0 gap-1.5 sm:w-auto">
						<label className="relative min-w-0 flex-1 sm:w-[280px]">
							<span className="sr-only">Search ticker or company</span>
							<Icon name="search" className={`size-4 ${searchFieldIconStyles}`} />
							<Input
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								placeholder="Search ticker or company"
								className={searchFieldInputPlacementStyles}
							/>
						</label>
						<Button type="submit" variant="secondary" size="md" disabled={!data}>
							Search
						</Button>
					</form>
				</PanelHeader>
				<div className="flex flex-wrap items-center gap-2 p-2">
					<Select
						heading="Market cap tier"
						allValues={MARKET_CAP_OPTIONS}
						selectedValues={marketCapTier}
						setSelectedValues={(value) => setMarketCapTier(value as 'all' | EarningsMarketCapTier)}
						label={`Market cap: ${marketCapLabel}`}
						labelType="none"
						variant="filter"
						size="md"
					/>
					<Select
						heading="Sector"
						allValues={sectorOptions}
						selectedValues={sectorSlug}
						setSelectedValues={setSectorSlug}
						label={`Sector: ${sectorLabel}`}
						labelType="none"
						variant="filter"
						size="md"
					/>
					<Switch
						label="Tight windows only · ≤ ±7d"
						value="tight-windows"
						checked={tightWindowsOnly}
						onChange={(event) => setTightWindowsOnly(event.target.checked)}
					/>
					<p className="ml-auto body-sm text-secondary">
						{formatNumber(week.companyCount) ?? '0'} companies · ranked by market cap
					</p>
				</div>
			</Panel>

			{searchResult?.kind === 'no-results' ? (
				<InlineStatus variant="empty">No companies match “{searchQuery.trim()}”.</InlineStatus>
			) : null}
			{searchResult?.kind === 'no-dates' ? (
				<InlineStatus variant="empty">
					No earnings dates for {searchResult.companies[0]?.ticker ?? searchQuery.trim()} in this window.
				</InlineStatus>
			) : null}
			{searchResult?.kind === 'matches' && searchResult.companies[0]?.nextEvent ? (
				<InlineStatus variant="empty">
					Jumped to {searchResult.companies[0].ticker} on {formatDate(searchResult.companies[0].nextEvent.report_date)}.
				</InlineStatus>
			) : null}

			<div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
				{week.days.map((day) => {
					const isBusiest = day.rows.length > 0 && day.rows.length === busiestCount
					const isExpanded = expandedDays.includes(day.date)
					const visibleCards = isExpanded ? day.rows : day.cards
					return (
						<Panel key={day.date} padding="none" className="min-w-0">
							<PanelHeader>
								<div className="mr-auto">
									<p className="label-sm text-secondary">
										{WEEKDAY_LABELS[day.weekday].toUpperCase()}
										{isBusiest ? ' · BUSIEST' : ''}
									</p>
									<PanelTitle>{formatDate(day.date)?.replace(/, \d{4}$/, '') ?? day.date}</PanelTitle>
								</div>
								<div className="text-right">
									<p className="mono-xl">{day.rows.length}</p>
									<p className="body-sm text-tertiary">{getDayStatusLabel(day.rows, todayET)}</p>
								</div>
							</PanelHeader>
							<div className="flex flex-col gap-2 p-2">
								{day.cards.length === 0 && day.rows.length > 0 ? (
									<p className="p-2 body-sm text-secondary">
										A quiet day: none of the week’s 12 largest. The card threshold is {formatCap(quietThreshold)}.
									</p>
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
										onClick={() =>
											setExpandedDays((dates) =>
												isExpanded ? dates.filter((date) => date !== day.date) : [...dates, day.date]
											)
										}
									>
										{isExpanded
											? 'Show top events'
											: day.cards.length > 0
												? `Show ${day.remainingCount} more`
												: `See all ${day.rows.length}`}
									</Button>
								) : null}
							</div>
						</Panel>
					)
				})}
			</div>

			<footer className="flex flex-wrap justify-between gap-2 py-4 body-sm text-tertiary">
				<p>Each status mark is one company event. Projection windows use the event’s most likely day and ± drift.</p>
				<p>Names and market caps come from company data · dates come from SEC EDGAR and DefiLlama projections.</p>
			</footer>
		</div>
	)
}
