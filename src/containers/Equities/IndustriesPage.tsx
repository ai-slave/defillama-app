import Link from 'next/link'
import { useRouter } from 'next/router'
import { lazy, Suspense, useState } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import type { TreemapNode } from '~/components/ECharts/TreemapChart/types'
import { Button } from '~/ui/Button'
import { ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelStatus } from '~/ui/Status'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import {
	buildIndustrySummary,
	type IndustriesPageData,
	filterIndustryTail,
	getIndustryTreemapOther,
	filterKnownAggregates,
	selectIndustryReturnMatrix,
	sortNullableRows,
	type IndustryAggregateRow
} from './aggregateData'
import {
	AggregateTableScroller,
	AggregateTreemap,
	ChangeValue,
	EquitiesPageHeader,
	formatMetric,
	MetricCard,
	ReturnMatrix,
	sectorColor,
	SortableTableHeader,
	StaleDataNotice
} from './AggregateShared'
import type { EquitiesPageDataState } from './types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

type IndustryTableSort =
	| 'industry'
	| 'companyCount'
	| 'marketCap'
	| 'weight'
	| 'sectorWeight'
	| 'priceChangePercentage1d'
	| 'priceChangePercentage7d'
	| 'priceChangePercentage1m'
	| 'priceChangePercentageYtd'
	| 'dollarVolume24h'
	| 'trailingPE'
	| 'dividendYield'

const INDUSTRY_CHART_LABEL_REPLACEMENTS: Record<string, string> = {
	Biotechnology: 'Biotech',
	'Banks - Regional': 'Regional\nbanks',
	'Software - Application': 'Software\napps',
	'Software - Infrastructure': 'Software\ninfra.',
	'Asset Management': 'Asset\nmgmt.',
	'Medical Devices': 'Medical\ndevices'
}

function shortenIndustryChartLabelPart(line: string) {
	return line.length > 8 ? `${line.slice(0, 7)}…` : line
}

function formatIndustryChartLabel(value: string) {
	const replacement = INDUSTRY_CHART_LABEL_REPLACEMENTS[value]
	if (replacement) return replacement

	const compact = value
		.replaceAll('Infrastructure', 'Infra.')
		.replaceAll('Management', 'Mgmt.')
		.replaceAll('Manufacturers', 'Mfrs.')
		.replaceAll('Services', 'Svcs.')
		.replaceAll('Equipment', 'Equip.')
	const words = compact.replace(' - ', ' ').split(' ')
	const firstLine = words.shift() ?? compact
	const secondLine = words.join(' ')
	return secondLine
		? `${shortenIndustryChartLabelPart(firstLine)}\n${shortenIndustryChartLabelPart(secondLine)}`
		: shortenIndustryChartLabelPart(firstLine)
}

function industryTreemapLeaf(row: IndustryAggregateRow): TreemapNode {
	return {
		name: row.industry,
		path: `${row.sector}/${row.industry}`,
		value: [row.marketCap ?? 0, row.weight, row.priceChangePercentage1d],
		itemStyle: { color: sectorColor(row.sectorSlug) }
	}
}

export function IndustriesPage({ state }: { state: EquitiesPageDataState<IndustriesPageData> }) {
	const router = useRouter()
	const [groupBySector, setGroupBySector] = useState(false)
	const [tableSort, setTableSort] = useState<{
		key: IndustryTableSort
		direction: 'asc' | 'desc'
	}>({
		key: 'marketCap',
		direction: 'desc'
	})
	const requestedSectorSlug = readSingleQueryValue(router.query.sector) ?? 'all'
	const hideTail = readSingleQueryValue(router.query.showTail) !== 'true'

	if (state.status === 'error') {
		return (
			<PanelStatus variant="error">
				Equity industry data is temporarily unavailable. Please try again shortly.
			</PanelStatus>
		)
	}

	const { overview, industries } = state.data
	const classifiedIndustries = filterKnownAggregates(industries)
	const availableSectorSlugs = new Set(classifiedIndustries.map((row) => row.sectorSlug))
	const sectorSlug =
		requestedSectorSlug === 'all' || availableSectorSlugs.has(requestedSectorSlug) ? requestedSectorSlug : 'all'
	const globalSummary = buildIndustrySummary(classifiedIndustries, overview.marketCap)
	const sectorRows =
		sectorSlug === 'all' ? classifiedIndustries : classifiedIndustries.filter((row) => row.sectorSlug === sectorSlug)
	const summary = buildIndustrySummary(sectorRows, overview.marketCap)
	const { visibleRows, hiddenRows } = filterIndustryTail(sectorRows, {
		hideTail
	})
	const sortedVisibleRows = sortNullableRows(visibleRows, tableSort.key, tableSort.direction)
	const treemapRows = visibleRows.slice(0, 20)
	const other = getIndustryTreemapOther(visibleRows)
	const treemapNodes: Array<TreemapNode> = groupBySector
		? Array.from(new Set(treemapRows.map((row) => row.sectorSlug))).map((slug) => {
				const group = treemapRows.filter((row) => row.sectorSlug === slug)
				return {
					name: group[0]?.sector ?? slug,
					path: group[0]?.sector ?? slug,
					value: [group.reduce((sum, row) => sum + (row.marketCap ?? 0), 0), null, null],
					itemStyle: { color: sectorColor(slug) },
					children: group.map(industryTreemapLeaf)
				}
			})
		: treemapRows.map(industryTreemapLeaf)
	if (other.count > 0) {
		treemapNodes.push({
			name: `Other ${other.count} industries`,
			path: `Other/Other ${other.count} industries`,
			value: [other.marketCap, other.weight, null],
			itemStyle: { color: sectorColor('unknown') }
		})
	}
	const mostPopulatedIndustries = sortNullableRows(sectorRows, 'companyCount', 'desc').slice(0, 6)
	const mostPopulatedIndustry = mostPopulatedIndustries[0]
	const companyCountDataset = {
		dimensions: ['Industry', 'Companies'],
		source: mostPopulatedIndustries.map((industry) => [industry.industry, industry.companyCount])
	}
	const matrixRows = selectIndustryReturnMatrix(sectorRows)
	const sectors = new Map<string, { name: string; count: number }>()
	for (const industry of classifiedIndustries) {
		const current = sectors.get(industry.sectorSlug) ?? {
			name: industry.sector,
			count: 0
		}
		current.count += 1
		sectors.set(industry.sectorSlug, current)
	}
	const sectorOptions = [
		{ value: 'all', label: `All sectors ${classifiedIndustries.length}` },
		...[...sectors].map(([slug, sector]) => ({
			value: slug,
			label: `${sector.name} ${sector.count}`
		}))
	]

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<EquitiesPageHeader
				crumb="Industries"
				title="Equity Industries"
				description={`${globalSummary.industryCount} industries across ${formatMetric(overview.companyCount, 'number')} US-listed equities, grouped into ${overview.sectorCount} sectors. The top 20 hold ${formatMetric(globalSummary.top20MarketShare, 'percent')} of market cap; ${globalSummary.underTenCompaniesCount} have fewer than 10 companies.`}
			/>
			<StaleDataNotice stale={state.stale} updatedAt={classifiedIndustries[0]?.updatedAt} />

			<SegmentedControl
				value={sectorSlug}
				onValueChange={(next) => {
					void pushShallowQuery(router, {
						sector: next === 'all' ? undefined : next
					})
				}}
				options={sectorOptions}
				label="Filter industries by sector"
				variant="chips"
				size="md"
			/>

			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6">
				<MetricCard
					label="Industries"
					value={summary.industryCount}
					detail={`${filterIndustryTail(sectorRows, { hideTail: true }).visibleRows.length} shown above the tail`}
				/>
				<MetricCard
					label="Top 10 · share of market"
					value={formatMetric(summary.top10MarketShare, 'percent')}
					detail={`Top 20 · ${formatMetric(summary.top20MarketShare, 'percent')}`}
				/>
				<MetricCard
					label="Largest industry"
					value={summary.largestIndustry?.industry ?? '—'}
					valueKind="text"
					detail={`${formatMetric(summary.largestIndustry?.marketCap ?? null, 'usd')} · ${summary.largestIndustry?.companyCount ?? 0} companies`}
				/>
				<MetricCard
					label="Best industry · 1M"
					value={summary.bestIndustry1m?.industry ?? '—'}
					valueKind="text"
					change={<ChangeValue value={summary.bestIndustry1m?.priceChangePercentage1m ?? null} />}
				/>
				<MetricCard
					label="Worst industry · 1M"
					value={summary.worstIndustry1m?.industry ?? '—'}
					valueKind="text"
					change={<ChangeValue value={summary.worstIndustry1m?.priceChangePercentage1m ?? null} />}
				/>
				<MetricCard
					label="Under 0.1% of market"
					value={summary.underPointOnePercentCount}
					detail={`of ${summary.industryCount} · below ${formatMetric(summary.underPointOnePercentMarketCapThreshold, 'usd')}`}
				/>
			</div>

			<div className="grid grid-cols-1 gap-2 xl:grid-cols-[2fr_1fr]">
				<AggregateTreemap
					title="Industry market map"
					subtitle={`Top 20 by market cap${other.count ? ` · ${other.count} remaining grouped · ${other.underPointOnePercentCount} under 0.1%` : ''}`}
					nodes={treemapNodes}
					valueLabel="Market cap"
					controls={
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="toggle"
								size="md"
								data-active={groupBySector}
								aria-pressed={groupBySector}
								onClick={() => setGroupBySector((value) => !value)}
							>
								By sector
							</Button>
							<Button
								type="button"
								variant="toggle"
								size="md"
								data-active={hideTail}
								aria-pressed={hideTail}
								onClick={() =>
									void pushShallowQuery(router, {
										showTail: hideTail ? 'true' : undefined
									})
								}
							>
								Hide tail
							</Button>
						</div>
					}
				/>

				<Panel padding="none">
					<PanelHeader>
						<div className="mr-auto">
							<PanelTitle>Industries with most companies</PanelTitle>
							<p className="body-sm text-tertiary">
								{mostPopulatedIndustry
									? `${mostPopulatedIndustry.industry} leads with ${mostPopulatedIndustry.companyCount} listed companies`
									: 'Ranked by number of listed companies'}
							</p>
						</div>
					</PanelHeader>
					<Suspense fallback={<ChartPanelBodyFallback />}>
						<MultiSeriesChart
							dataset={companyCountDataset}
							charts={[
								{
									type: 'bar',
									name: 'Companies',
									encode: { x: 'Industry', y: 'Companies' },
									barMaxWidth: 48
								}
							]}
							chartOptions={{
								...createCategoryChartOptions(''),
								yAxis: { min: 0, minInterval: 1, name: 'Companies' },
								xAxis: {
									type: 'category',
									boundaryGap: true,
									axisLabel: { interval: 0, lineHeight: 14, formatter: formatIndustryChartLabel }
								}
							}}
							valueSymbol=""
							exportButtons="hidden"
							hideDataZoom
						/>
					</Suspense>
				</Panel>
			</div>

			<ReturnMatrix
				title="Industry rotation"
				subtitle="Price return by period · 12 largest industries"
				rows={matrixRows}
			/>

			<Panel padding="none" className="min-w-0">
				<PanelHeader>
					<div className="mr-auto">
						<PanelTitle>All industries</PanelTitle>
						<p className="body-sm text-tertiary">
							{visibleRows.length} shown · {hiddenRows.length} hidden by the tail filter
						</p>
					</div>
					<Button
						type="button"
						variant="toggle"
						size="md"
						data-active={hideTail}
						aria-pressed={hideTail}
						onClick={() =>
							void pushShallowQuery(router, {
								showTail: hideTail ? 'true' : undefined
							})
						}
					>
						Hide tail
					</Button>
					<CSVDownloadButton
						free
						smol
						size="md"
						prepareCsv={() => ({
							filename: 'equity-industries',
							rows: [
								[
									'Rank',
									'Industry',
									'Sector',
									'Companies',
									'Market cap',
									'Share of market',
									'Share of sector',
									'1D',
									'7D',
									'1M',
									'YTD',
									'Volume 24h',
									'P/E',
									'Dividend yield'
								],
								...sortedVisibleRows.map((row, index) => [
									index + 1,
									row.industry,
									row.sector,
									row.companyCount,
									row.marketCap,
									row.weight,
									row.sectorWeight,
									row.priceChangePercentage1d,
									row.priceChangePercentage7d,
									row.priceChangePercentage1m,
									row.priceChangePercentageYtd,
									row.dollarVolume24h,
									row.trailingPE,
									row.dividendYield
								])
							]
						})}
					/>
				</PanelHeader>
				<AggregateTableScroller>
					<table className="w-full min-w-[1120px] table-fixed">
						<colgroup>
							<col className="w-10" />
							<col className="w-40" />
							<col className="w-[100px]" />
							<col className="w-[100px]" />
							<col className="w-[100px]" />
							<col className="w-[100px]" />
							<col className="w-[72px]" />
							<col className="w-[72px]" />
							<col className="w-[72px]" />
							<col className="w-[72px]" />
							<col className="w-[92px]" />
							<col className="w-[60px]" />
							<col className="w-20" />
						</colgroup>
						<thead>
							<tr className="border-b border-subtle table-header text-secondary">
								<th className="sticky left-0 z-20 bg-surface px-2 py-3 text-left">#</th>
								<SortableTableHeader
									column="industry"
									sort={tableSort}
									onSort={setTableSort}
									align="left"
									defaultDirection="asc"
									className="sticky left-[40px] z-20 border-r border-subtle bg-surface"
								>
									Industry · Sector
								</SortableTableHeader>
								<SortableTableHeader column="companyCount" sort={tableSort} onSort={setTableSort}>
									Companies
								</SortableTableHeader>
								<SortableTableHeader column="marketCap" sort={tableSort} onSort={setTableSort}>
									Market cap
								</SortableTableHeader>
								<SortableTableHeader column="weight" sort={tableSort} onSort={setTableSort}>
									Share of market
								</SortableTableHeader>
								<SortableTableHeader column="sectorWeight" sort={tableSort} onSort={setTableSort}>
									Share of sector
								</SortableTableHeader>
								<SortableTableHeader column="priceChangePercentage1d" sort={tableSort} onSort={setTableSort}>
									1D
								</SortableTableHeader>
								<SortableTableHeader column="priceChangePercentage7d" sort={tableSort} onSort={setTableSort}>
									7D
								</SortableTableHeader>
								<SortableTableHeader column="priceChangePercentage1m" sort={tableSort} onSort={setTableSort}>
									1M
								</SortableTableHeader>
								<SortableTableHeader column="priceChangePercentageYtd" sort={tableSort} onSort={setTableSort}>
									YTD
								</SortableTableHeader>
								<SortableTableHeader column="dollarVolume24h" sort={tableSort} onSort={setTableSort}>
									Volume 24h
								</SortableTableHeader>
								<SortableTableHeader column="trailingPE" sort={tableSort} onSort={setTableSort}>
									P/E
								</SortableTableHeader>
								<SortableTableHeader column="dividendYield" sort={tableSort} onSort={setTableSort}>
									Div. yield
								</SortableTableHeader>
							</tr>
						</thead>
						<tbody>
							{sortedVisibleRows.map((row, index) => (
								<tr
									key={`${row.sectorSlug}:${row.industrySlug}`}
									className="group border-b border-subtle body-md hover:bg-hover-row"
								>
									<td className="sticky left-0 z-10 bg-surface px-2 py-3 text-tertiary group-hover:bg-hover-row">
										{index + 1}
									</td>
									<td className="sticky left-[40px] z-10 border-r border-subtle bg-surface px-2 py-3 group-hover:bg-hover-row">
										<Link
											href={`/equities/sectors/${row.sectorSlug}?industry=${encodeURIComponent(row.industrySlug)}`}
											className="font-medium hover:text-link"
										>
											{row.industry}
										</Link>
										<p className="body-sm text-tertiary">{row.sector}</p>
									</td>
									<td className="px-2 py-3 text-right">{row.companyCount}</td>
									<td className="px-2 py-3 text-right">{formatMetric(row.marketCap, 'usd')}</td>
									<td className="px-2 py-3 text-right">{formatMetric(row.weight, 'percent')}</td>
									<td className="px-2 py-3 text-right">{formatMetric(row.sectorWeight, 'percent')}</td>
									<td className="px-2 py-3 text-right">
										<ChangeValue value={row.priceChangePercentage1d} />
									</td>
									<td className="px-2 py-3 text-right">
										<ChangeValue value={row.priceChangePercentage7d} />
									</td>
									<td className="px-2 py-3 text-right">
										<ChangeValue value={row.priceChangePercentage1m} />
									</td>
									<td className="px-2 py-3 text-right">
										<ChangeValue value={row.priceChangePercentageYtd} />
									</td>
									<td className="px-2 py-3 text-right">{formatMetric(row.dollarVolume24h, 'usd')}</td>
									<td className="px-2 py-3 text-right">{formatMetric(row.trailingPE, 'multiple')}</td>
									<td className="px-2 py-3 text-right">{formatMetric(row.dividendYield, 'percent')}</td>
								</tr>
							))}
						</tbody>
					</table>
				</AggregateTableScroller>
			</Panel>
		</div>
	)
}
