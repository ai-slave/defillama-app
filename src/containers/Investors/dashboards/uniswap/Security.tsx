import type { EChartsOption } from 'echarts'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'
import { useChartTheme } from '~/components/ECharts/shared/chartTheme'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { formatUsd } from '~/utils/numberFormat'
import type { Chart, Kpi as KpiT } from './transform'
import { BarListCard, ChartCard, KpiGrid, PageLoader, SectionHeader, TimeAreaCard, useUniswapData } from './ui'

echarts.use([CanvasRenderer, BarChart, GridComponent, LegendComponent, TooltipComponent])

interface AuditReport {
	repo: string
	file: string
	firm: string
	v4: boolean
	url: string
}

// Per-proposal turnout: category axis by proposal number, with `rows` carrying the
// proposal metadata the tooltip shows.
interface VoteTurnoutData {
	title?: string
	note?: string
	labels: Array<string>
	series: Array<{ name: string; data: Array<number> }>
	rows: Array<{ id: number; title: string; date: string; voters: number }>
}

interface SecurityData {
	kpis: Record<string, KpiT | undefined>
	auditsByFirm: { title?: string; rows: Array<{ firm: string; count: number }> }
	auditsByRepo: { title?: string; rows: Array<{ repo: string; count: number }> }
	auditReports: Array<AuditReport>
	voteTurnout: VoteTurnoutData
	delegatedUni: Chart
}

const VOTE_COLORS: Record<string, string> = { For: '#40B66B', Against: '#FF5F52', Abstain: '#9ca3af' }

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Proposal titles from the governance data sometimes carry the proposal body's
// markdown; keep just the headline.
function proposalTitle(title: string): string {
	return title.split('#')[0]?.trim().slice(0, 90) ?? ''
}

// Stacked For/Against/Abstain bars per proposal. MultiSeriesChart is time-axis only and
// proposals are sparse discrete events, so this renders on a category axis directly.
function VoteTurnoutChart({ chart }: { chart: VoteTurnoutData }) {
	const [isDark] = useDarkModeManager()
	const theme = useChartTheme(isDark)
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)

	useEffect(() => {
		const container = containerRef.current
		if (!container) return
		const instance = echarts.init(container)
		chartRef.current = instance
		const observer = new ResizeObserver(() => {
			if (!instance.isDisposed()) instance.resize()
		})
		observer.observe(container)
		return () => {
			observer.disconnect()
			chartRef.current = null
			instance.dispose()
		}
	}, [])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance || instance.isDisposed()) return

		const option: EChartsOption = {
			grid: { left: 12, right: 12, top: 36, bottom: 8, containLabel: true },
			legend: { top: 0, textStyle: { color: theme.text } },
			xAxis: {
				type: 'category',
				data: chart.labels,
				axisLabel: { color: theme.axisLabel },
				axisLine: { lineStyle: { color: theme.ink(0.15) } },
				axisTick: { show: false }
			},
			yAxis: {
				type: 'value',
				axisLabel: { color: theme.axisLabel, formatter: (value: number) => formatUsd(value, { compact: true }) },
				splitLine: { lineStyle: { color: theme.gridline } }
			},
			tooltip: {
				trigger: 'axis',
				backgroundColor: isDark ? '#16101f' : '#ffffff',
				borderColor: theme.ink(0.1),
				textStyle: { color: theme.text },
				formatter: (params: unknown) => {
					const items = (Array.isArray(params) ? params : [params]) as Array<{
						dataIndex: number
						seriesName?: string
						value?: number
						color?: string
					}>
					const first = items[0]
					if (!first) return ''
					const row = chart.rows[first.dataIndex]
					if (!row) return ''
					const total = items.reduce((sum, item) => sum + (item.value || 0), 0)
					let html = `<b>#${row.id} ${escapeHtml(proposalTitle(row.title))}</b><br/>`
					html += `<span style="opacity:.7">${escapeHtml(row.date)} &middot; ${row.voters} voters</span><br/>`
					html += `<b>Turnout: ${formatUsd(total, { compact: true })}</b><br/>`
					for (const item of items) {
						if (!item.value) continue
						html += `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${item.color};margin-right:6px"></span>${item.seriesName}: ${formatUsd(item.value, { compact: true })}<br/>`
					}
					return html
				}
			},
			series: chart.series.map((series) => ({
				name: series.name,
				type: 'bar' as const,
				stack: 'total',
				data: series.data,
				color: VOTE_COLORS[series.name],
				barMaxWidth: 14
			}))
		}
		instance.setOption(option)
	}, [chart, theme, isDark])

	return <div ref={containerRef} style={{ height: '360px' }} />
}

// Version per report: the payload's v4 flag wins (it also marks the v4-integrated
// Universal Router reports), then the repo name (v3-core, v2-..., v1-...). Product
// repos without a protocol version (Permit2, UniswapX, the auction, ...) stay blank.
function reportVersion(report: AuditReport): string {
	if (report.v4) return 'v4'
	const match = report.repo.match(/^v([1-4])\b|^v([1-4])-/)
	const version = match?.[1] ?? match?.[2]
	return version ? `v${version}` : ''
}

// Newest protocol version first (v4 ... v1), version-less product repos after,
// alphabetical within each group.
function reportRank(version: string): number {
	return version ? 4 - Number(version.slice(1)) : 4
}

function sortReports(reports: Array<AuditReport>): Array<AuditReport & { version: string }> {
	return reports
		.map((report) => ({ ...report, version: reportVersion(report) }))
		.sort(
			(a, b) =>
				reportRank(a.version) - reportRank(b.version) || a.repo.localeCompare(b.repo) || a.file.localeCompare(b.file)
		)
}

const REPORT_COLUMNS = 'minmax(150px,1.2fr) minmax(70px,0.5fr) minmax(200px,2fr) minmax(130px,1fr)'
const REPORT_HEADERS = ['Product', 'Version', 'Report', 'Firm']

function AuditReportsTable({ reports }: { reports: Array<AuditReport> }) {
	const sorted = sortReports(reports)
	return (
		<div className="w-full overflow-auto rounded-lg border border-pro-cards-border" style={{ maxHeight: '480px' }}>
			<div style={{ display: 'grid', gridTemplateColumns: REPORT_COLUMNS }}>
				{REPORT_HEADERS.map((label) => (
					<div
						key={label}
						className="sticky top-0 z-[1] border-b border-subtle bg-pro-cards-bg px-3 py-2.5 text-sm font-medium tracking-wider text-pro-text-tertiary uppercase"
					>
						{label}
					</div>
				))}
				{sorted.map((report, index) => {
					const rowBg = index % 2 === 1 ? 'bg-pro-cards-bg' : ''
					const cell = `truncate border-b border-subtle px-3 py-2.5 text-sm text-pro-text-primary ${rowBg}`
					return [
						<div key={`${index}-repo`} className={cell}>
							{report.repo}
						</div>,
						<div key={`${index}-version`} className={`${cell} font-jetbrains`}>
							{report.version}
						</div>,
						<div key={`${index}-file`} className={cell}>
							<a href={report.url} target="_blank" rel="noopener noreferrer" className="text-sl-accent hover:underline">
								{report.file}
							</a>
						</div>,
						<div key={`${index}-firm`} className={cell}>
							{report.firm}
						</div>
					]
				})}
			</div>
		</div>
	)
}

// Older ir-server payloads bake sentence copy into `formatted` ("7.8 years of continuous
// uptime"); show just the figure, the card label carries the words. Rebuild the display from
// the raw `value` so the terse copy never waits on an ir-server redeploy.
const terse = (k: KpiT | undefined, format: (value: number) => string): KpiT | undefined =>
	k ? { ...k, formatted: format(k.value) } : undefined

// Security & Governance: track-record KPIs, then audits, then governance, per the
// partner tracker (audit counting resolved with Uniswap: count by report, group by
// firm, scanned live from the public Uniswap GitHub repos).
export default function Security() {
	const { data } = useUniswapData<SecurityData>('security')
	if (!data) return <PageLoader />

	const kpis: Record<string, KpiT | undefined> = {
		...data.kpis,
		uptime: terse(data.kpis.uptime, String),
		totalAudits: terse(data.kpis.totalAudits, String),
		v4Audits: terse(data.kpis.v4Audits, String),
		auditFirms: terse(data.kpis.auditFirms, String),
		bugBounty: terse(data.kpis.bugBounty, (value: number) =>
			formatUsd(value, { compact: true, maximumFractionDigits: 2 })
		),
		securityCompetition: terse(data.kpis.securityCompetition, (value: number) =>
			formatUsd(value, { compact: true, maximumFractionDigits: 2 })
		),
		exploits: terse(data.kpis.exploits, (value) => (value === 0 ? '0 · $0 lost' : String(value)))
	}

	const byFirm = (data.auditsByFirm?.rows ?? [])
		.map((row) => ({ name: row.firm, value: row.count }))
		.sort((a, b) => b.value - a.value)
	const byRepo = (data.auditsByRepo?.rows ?? [])
		.map((row) => ({ name: row.repo, value: row.count }))
		.sort((a, b) => b.value - a.value)

	return (
		<div className="flex flex-col gap-10">
			<section className="flex flex-col gap-6">
				<SectionHeader>Track Record</SectionHeader>
				{/* Terse values, labels carry the words; cols=3 spreads the row out. */}
				<KpiGrid
					kpis={kpis}
					cols={3}
					items={[
						['uptime', 'Continuous Uptime (Years)', undefined],
						['exploits', 'Core Protocol Exploits', 'No core-protocol exploit since the v1 launch (November 2018).'],
						['bugBounty', 'Bug Bounty', undefined],
						['securityCompetition', 'Security Competition', undefined]
					]}
				/>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Audits</SectionHeader>
				<KpiGrid
					kpis={kpis}
					cols={3}
					items={[
						['totalAudits', 'Total Audits', undefined],
						['v4Audits', 'Audits Covering v4', undefined],
						['auditFirms', 'Audit Firms', undefined]
					]}
				/>
				{/* Chart labels follow the partner requirements doc, not any prior dashboard's naming. */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<BarListCard
						title="Audits by Firm"
						subtitle="Public audit reports across all Uniswap repos, grouped by audit firm."
						items={byFirm}
					/>
					<BarListCard
						title="Audits by Product"
						subtitle="The same reports grouped by the audited product repo."
						items={byRepo}
					/>
				</div>
				<ChartCard
					title="All Audit Reports"
					subtitle="Public audit report PDFs, scanned live from the Uniswap GitHub repos, newest protocol version first. Each report links to the source."
				>
					<AuditReportsTable reports={data.auditReports ?? []} />
				</ChartCard>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Governance</SectionHeader>
				<KpiGrid
					kpis={kpis}
					cols={3}
					items={[
						['delegatedUni', 'Delegated UNI', undefined],
						['avgVoteTurnout', 'Avg Vote Turnout (USD)', undefined],
						['avgVoteTurnoutUni', 'Avg Vote Turnout (UNI)', undefined]
					]}
				/>
				<ChartCard
					title="Vote Turnout by Proposal (USD)"
					subtitle={data.voteTurnout?.note ?? 'Governor Bravo proposals; USD at vote-time UNI price.'}
				>
					{data.voteTurnout ? <VoteTurnoutChart chart={data.voteTurnout} /> : null}
				</ChartCard>
				<TimeAreaCard
					chart={data.delegatedUni}
					valueSymbol=""
					value={data.kpis.delegatedUni?.formatted}
					subtitle="Total UNI delegated to governance delegates, from onchain delegation events."
				/>
			</section>
		</div>
	)
}
