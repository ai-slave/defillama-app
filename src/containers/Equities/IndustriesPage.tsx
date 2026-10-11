import { createColumnHelper, type SortingState } from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { lazy, Suspense } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import type { TreemapNode } from '~/components/ECharts/TreemapChart/types'
import { readSelectionFromQuery, updateQueryFromSelected } from '~/components/Select/query'
import { type paginatedTableFeatures, usePaginatedTable } from '~/components/Table/features/pagination'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import { prepareTableCsv } from '~/components/Table/utils'
import { childColors } from '~/constants/colors'
import { Button } from '~/ui/Button'
import { Change } from '~/ui/Change'
import { ChartPanelBodyLoading } from '~/ui/ChartPanel'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { isTrueQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import {
	buildIndustrySummary,
	buildIndustrySectorOptions,
	type IndustriesPageData,
	filterIndustryTail,
	getIndustryTreemapOther,
	filterKnownAggregates,
	getSelectionChip,
	selectIndustryReturnMatrix,
	sortNullableRows,
	type IndustryAggregateRow
} from './aggregateData'
import {
	AggregateTreemap,
	EquitiesPageHeader,
	formatMetric,
	ReturnMatrix,
	RowNumber,
	sectorColor,
	StaleDataNotice
} from './AggregateShared'
import type { EquitiesPageDataState } from './types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

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

function industryTreemapLeaf(row: IndustryAggregateRow, color: string): TreemapNode {
	return {
		name: row.industry,
		path: `${row.sector}/${row.industry}`,
		value: [row.marketCap ?? 0, row.sectorWeight, row.weight, row.priceChangePercentage1d],
		itemStyle: { color }
	}
}

const industryColumnHelper = createColumnHelper<
	typeof paginatedTableFeatures,
	IndustryAggregateRow & { updatedAt: string }
>()
const INDUSTRY_TABLE_SORT: SortingState = [{ id: 'marketCap', desc: true }]
const INDUSTRY_TABLE_PAGE_SIZES = [25, 50, 100] as const

const industryColumns = industryColumnHelper.columns([
	industryColumnHelper.accessor('industry', {
		header: 'Industry · Sector',
		cell: ({ row, getValue }) => (
			<div className="flex gap-2">
				<RowNumber rowId={row.id} />
				<div>
					<Link
						href={`/equities/sectors/${row.original.sectorSlug}?industry=${encodeURIComponent(row.original.industrySlug)}`}
						className="label-md text-link hover:underline"
					>
						{getValue()}
					</Link>
					<p className="body-sm text-tertiary">{row.original.sector}</p>
				</div>
			</div>
		),
		enableHiding: false,
		meta: {
			headerClassName: 'w-56 sticky left-0 z-20 bg-surface',
			cellClassName: 'sticky left-0 z-10 bg-surface',
			align: 'start'
		}
	}),
	industryColumnHelper.accessor('companyCount', {
		header: 'Companies',
		meta: { headerClassName: 'w-24', align: 'end' }
	}),
	industryColumnHelper.accessor((row) => row.marketCap ?? undefined, {
		id: 'marketCap',
		header: 'Market cap',
		cell: ({ getValue }) => formatMetric(getValue(), 'usd'),
		meta: { headerClassName: 'w-28', align: 'end' }
	}),
	industryColumnHelper.accessor((row) => row.weight ?? undefined, {
		id: 'weight',
		header: 'Market share',
		cell: ({ getValue }) => formatMetric(getValue(), 'percent'),
		meta: { headerClassName: 'w-24', align: 'end' }
	}),
	industryColumnHelper.accessor((row) => row.sectorWeight ?? undefined, {
		id: 'sectorWeight',
		header: 'Sector share',
		cell: ({ getValue }) => formatMetric(getValue(), 'percent'),
		meta: { headerClassName: 'w-24', align: 'end' }
	}),
	...(
		[
			['priceChangePercentage1d', '1D'],
			['priceChangePercentage7d', '7D'],
			['priceChangePercentage1m', '1M'],
			['priceChangePercentageYtd', 'YTD']
		] as const
	).map(([field, header]) =>
		industryColumnHelper.accessor((row) => row[field] ?? undefined, {
			id: field,
			header,
			cell: ({ getValue }) => {
				const value = getValue()
				return value == null ? '—' : <Change value={value} />
			},
			meta: { headerClassName: 'w-18', align: 'end' }
		})
	),
	industryColumnHelper.accessor((row) => row.dollarVolume24h ?? undefined, {
		id: 'dollarVolume24h',
		header: 'Volume 24h',
		cell: ({ getValue }) => formatMetric(getValue(), 'usd'),
		meta: { headerClassName: 'w-28', align: 'end' }
	}),
	industryColumnHelper.accessor((row) => row.trailingPE ?? undefined, {
		id: 'trailingPE',
		header: 'P/E',
		cell: ({ getValue }) => formatMetric(getValue(), 'multiple'),
		meta: { headerClassName: 'w-18', align: 'end' }
	}),
	industryColumnHelper.accessor((row) => row.dividendYield ?? undefined, {
		id: 'dividendYield',
		header: 'Div. yield',
		cell: ({ getValue }) => formatMetric(getValue(), 'percent'),
		meta: { headerClassName: 'w-24', align: 'end' }
	})
])

export function IndustriesPage({ state }: { state: EquitiesPageDataState<IndustriesPageData> }) {
	if (state.status === 'error') {
		return (
			<PanelStatus variant="error">Equity industry data is temporarily unavailable. Try again in a moment.</PanelStatus>
		)
	}

	return <IndustriesReadyPage state={state} />
}

function IndustriesReadyPage({
	state
}: {
	state: Extract<EquitiesPageDataState<IndustriesPageData>, { status: 'ready' }>
}) {
	const router = useRouter()
	// `mapGroup` is the key the /equities market map uses for the same choice; here ungrouped is the default.
	const groupBySector = router.query.mapGroup === 'sector'
	const hideTail = !isTrueQueryParam(router.query.showTail)

	const { overview, industries } = state.data
	const classifiedIndustries = filterKnownAggregates(industries)
	const sectorSlugs = [...new Set(classifiedIndustries.map((row) => row.sectorSlug))]
	const selectedSectors = new Set(readSelectionFromQuery(router.query, 'sector', 'excludeSector', sectorSlugs))
	const globalSummary = buildIndustrySummary(classifiedIndustries, overview.marketCap)
	const sectorRows = classifiedIndustries.filter((row) => selectedSectors.has(row.sectorSlug))
	const summary = buildIndustrySummary(sectorRows, overview.marketCap)
	const { visibleRows, hiddenRows } = filterIndustryTail(sectorRows, {
		hideTail
	})
	const industryTable = usePaginatedTable({
		data: visibleRows,
		columns: industryColumns,
		defaultColumn: { sortUndefined: 'last' },
		initialState: { sorting: INDUSTRY_TABLE_SORT, pagination: { pageIndex: 0, pageSize: 25 } },
		enableSortingRemoval: false,
		getRowId: (row) => `${row.sectorSlug}:${row.industrySlug}`
	})
	const treemapRows = visibleRows.slice(0, 20)
	const industryTreemapColors = new Map<string, string>()
	for (const colorSectorSlug of new Set(treemapRows.map((row) => row.sectorSlug))) {
		const sectorIndustries = treemapRows.filter((row) => row.sectorSlug === colorSectorSlug)
		const colors = childColors(sectorColor(colorSectorSlug), sectorIndustries.length)
		for (const [index, row] of sectorIndustries.entries()) {
			industryTreemapColors.set(`${row.sectorSlug}:${row.industrySlug}`, colors[index]!)
		}
	}
	const toTreemapLeaf = (row: IndustryAggregateRow) =>
		industryTreemapLeaf(
			row,
			industryTreemapColors.get(`${row.sectorSlug}:${row.industrySlug}`) ?? sectorColor(row.sectorSlug)
		)
	const other = getIndustryTreemapOther(visibleRows)
	const treemapNodes: Array<TreemapNode> = groupBySector
		? Array.from(new Set(treemapRows.map((row) => row.sectorSlug))).map((slug) => {
				const group = treemapRows.filter((row) => row.sectorSlug === slug)
				return {
					name: group[0]?.sector ?? slug,
					path: group[0]?.sector ?? slug,
					value: [
						group.reduce((sum, row) => sum + (row.marketCap ?? 0), 0),
						null,
						group.reduce((sum, row) => sum + (row.weight ?? 0), 0)
					],
					itemStyle: { color: sectorColor(slug) },
					children: group.map(toTreemapLeaf)
				}
			})
		: treemapRows.map(toTreemapLeaf)
	if (other.count > 0) {
		treemapNodes.push({
			name: `Other ${other.count} industries`,
			path: `Other/Other ${other.count} industries`,
			value: [other.marketCap, null, other.weight],
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
	const sectorOptions = buildIndustrySectorOptions(classifiedIndustries)

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<EquitiesPageHeader
				crumb="Industries"
				title="Equity Industries"
				description={`${globalSummary.industryCount} industries across ${formatMetric(overview.companyCount, 'number')} US-listed equities, grouped into ${overview.sectorCount} sectors. The top 20 hold ${formatMetric(globalSummary.top20MarketShare, 'percent')} of market cap; ${globalSummary.underTenCompaniesCount} have fewer than 10 companies.`}
			/>
			<StaleDataNotice stale={state.stale} updatedAt={classifiedIndustries[0]?.updatedAt} />

			<SegmentedControl
				value={getSelectionChip([...selectedSectors], sectorSlugs)}
				onValueChange={(next) =>
					updateQueryFromSelected(router, 'sector', 'excludeSector', sectorSlugs, next === 'all' ? null : next)
				}
				options={sectorOptions}
				label="Filter industries by sector"
				variant="chips"
				size="md"
			/>

			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6">
				<StatTile
					label="Industries"
					value={summary.industryCount}
					sub={`${filterIndustryTail(sectorRows, { hideTail: true }).visibleRows.length} shown above the tail`}
				/>
				<StatTile
					label="Top 10 · share of market"
					value={formatMetric(summary.top10MarketShare, 'percent')}
					sub={`Top 20 · ${formatMetric(summary.top20MarketShare, 'percent')}`}
				/>
				<StatTile
					label="Largest industry"
					value={formatMetric(summary.largestIndustry?.marketCap ?? null, 'usd')}
					sub={
						summary.largestIndustry
							? `${summary.largestIndustry.industry} · ${summary.largestIndustry.companyCount} companies`
							: undefined
					}
				/>
				{/* buildIndustrySummary picks best and worst only from rows with a 1M return. */}
				<StatTile
					label="Best industry · 1M"
					value={summary.bestIndustry1m ? <Change value={summary.bestIndustry1m.priceChangePercentage1m!} /> : '—'}
					sub={summary.bestIndustry1m?.industry}
				/>
				<StatTile
					label="Worst industry · 1M"
					value={summary.worstIndustry1m ? <Change value={summary.worstIndustry1m.priceChangePercentage1m!} /> : '—'}
					sub={summary.worstIndustry1m?.industry}
				/>
				<StatTile
					label="Under 0.1% of market"
					value={summary.underPointOnePercentCount}
					sub={`of ${summary.industryCount} · below ${formatMetric(summary.underPointOnePercentMarketCapThreshold, 'usd')}`}
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
								onClick={() => void pushShallowQuery(router, { mapGroup: groupBySector ? undefined : 'sector' })}
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
					<Suspense fallback={<ChartPanelBodyLoading />}>
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
						prepareCsv={() => prepareTableCsv({ instance: industryTable, filename: 'equity-industries' })}
					/>
				</PanelHeader>
				<PaginatedTable table={industryTable} pageSizeOptions={INDUSTRY_TABLE_PAGE_SIZES} />
			</Panel>
		</div>
	)
}
