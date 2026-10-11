import { Fragment, lazy, Suspense, useMemo } from 'react'
import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import {
	getPointedSeriesName,
	getTooltipRawYValue,
	normalizeTooltipItems,
	TOOLTIP_POINTED_ROW_STYLE
} from '~/components/ECharts/shared/tooltip'
import { CHART_FILL, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import { formatUsd } from '~/utils/numberFormat'
import type { Chart, Kpi as KpiT } from './transform'
import { BarListCard, CardTitle, ChartCard, KpiGrid, TimeAreaCard, useUniswapData } from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

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

// Proposal titles from the governance data sometimes carry the proposal body's
// markdown; keep just the headline.
function proposalTitle(title: string): string {
	return title.split('#')[0]?.trim().slice(0, 90) ?? ''
}

// Stacked For/Against/Abstain bars per proposal. Proposals are discrete events, so they sit on a
// category axis; the tooltip looks each one up by its axis label to show the proposal itself.
function VoteTurnoutChart({ chart }: { chart: VoteTurnoutData }) {
	const { dataset, charts, chartOptions } = useMemo(() => {
		const source: Array<Array<string | number>> = []
		const proposalByLabel = new Map<string, VoteTurnoutData['rows'][number]>()
		for (let index = 0; index < chart.labels.length; index++) {
			const label = chart.labels[index]!
			const row: Array<string | number> = [label]
			for (const series of chart.series) row.push(series.data[index] ?? 0)
			source.push(row)
			proposalByLabel.set(label, chart.rows[index]!)
		}
		return {
			dataset: { source, dimensions: ['Proposal', ...chart.series.map((series) => series.name)] },
			charts: chart.series.map((series): MultiSeriesChartSeriesConfig => ({
				type: 'bar',
				name: series.name,
				encode: { x: 'Proposal', y: series.name },
				stack: 'total',
				color: VOTE_COLORS[series.name],
				barMaxWidth: 14
			})),
			chartOptions: {
				...createCategoryChartOptions('$'),
				tooltip: {
					formatter: (params: unknown) => {
						const items = normalizeTooltipItems(params)
						const proposal = proposalByLabel.get(String(items[0]?.axisValue))
						if (!proposal) return ''
						const pointedName = getPointedSeriesName(items)
						let total = 0
						let pointedRow = ''
						let rows = ''
						for (const item of items) {
							const name = item.seriesName ?? ''
							const value = Number(getTooltipRawYValue(item, name) ?? 0)
							if (!value) continue
							total += value
							const row = `${item.marker ?? ''}${escapeHtml(name)}: ${formatUsd(value, { compact: true })}`
							if (name === pointedName) pointedRow = `<div style="${TOOLTIP_POINTED_ROW_STYLE}">${row}</div>`
							else rows += `${row}<br/>`
						}
						return (
							`<b>#${proposal.id} ${escapeHtml(proposalTitle(proposal.title))}</b><br/>` +
							`<span style="opacity:.7">${escapeHtml(proposal.date)} &middot; ${proposal.voters} voters</span><br/>` +
							`<b>Turnout: ${formatUsd(total, { compact: true })}</b><br/>${pointedRow}${rows}`
						)
					}
				}
			}
		}
	}, [chart])

	return (
		<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
			<MultiSeriesChart
				dataset={dataset}
				charts={charts}
				valueSymbol="$"
				containerClassName={CHART_FILL}
				showLegend
				exportButtons="hidden"
				chartOptions={chartOptions}
			/>
		</Suspense>
	)
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
		<div className="w-full overflow-auto rounded-lg border border-subtle" style={{ maxHeight: '480px' }}>
			<div style={{ display: 'grid', gridTemplateColumns: REPORT_COLUMNS }}>
				{REPORT_HEADERS.map((label) => (
					<div
						key={label}
						className="sticky top-0 z-[1] border-b border-subtle bg-surface px-3 py-2.5 label-md tracking-wider text-tertiary uppercase"
					>
						{label}
					</div>
				))}
				{keyedOccurrences(sorted, (report) => JSON.stringify([report.repo, report.file, report.url])).map(
					({ item: report, key }, index) => {
						const rowBg = index % 2 === 1 ? 'bg-surface' : ''
						const cell = `truncate border-b border-subtle px-3 py-2.5 body-md text-primary ${rowBg}`
						return (
							<Fragment key={key}>
								<div className={cell}>{report.repo}</div>
								<div className={cell}>{report.version}</div>
								<div className={cell}>
									<a href={report.url} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
										{report.file}
									</a>
								</div>
								<div className={cell}>{report.firm}</div>
							</Fragment>
						)
					}
				)}
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
	if (!data) return <PanelLoadingStatus />

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
				<h2 className="heading-xs">Track record</h2>
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
				<h2 className="heading-xs">Audits</h2>
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
						title="Audits by firm"
						subtitle="Public audit reports across all Uniswap repos, grouped by audit firm."
						items={byFirm}
					/>
					<BarListCard
						title="Audits by product"
						subtitle="The same reports grouped by the audited product repo."
						items={byRepo}
					/>
				</div>
				<ChartCard
					title="All audit reports"
					subtitle="Public audit report PDFs, scanned live from the Uniswap GitHub repos, newest protocol version first. Each report links to the source."
				>
					<AuditReportsTable reports={data.auditReports ?? []} />
				</ChartCard>
			</section>

			<section className="flex flex-col gap-6">
				<h2 className="heading-xs">Governance</h2>
				<KpiGrid
					kpis={kpis}
					cols={3}
					items={[
						['delegatedUni', 'Delegated UNI', undefined],
						['avgVoteTurnout', 'Avg Vote Turnout (USD)', undefined],
						['avgVoteTurnoutUni', 'Avg Vote Turnout (UNI)', undefined]
					]}
				/>
				<Panel>
					<ChartPanelToolbar
						leading={
							<CardTitle
								title="Vote turnout by proposal (USD)"
								subtitle={data.voteTurnout?.note ?? 'Governor Bravo proposals; USD at vote-time UNI price.'}
							/>
						}
					/>
					{data.voteTurnout ? <VoteTurnoutChart chart={data.voteTurnout} /> : null}
				</Panel>
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
