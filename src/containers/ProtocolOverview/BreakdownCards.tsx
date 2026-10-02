import { createColumnHelper, type SortingState, useTable } from '@tanstack/react-table'
import * as React from 'react'
import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import {
	buildRuntimePieChartCsvDataset,
	buildRuntimePieChartPresentation,
	buildRuntimePieChartTableRows,
	type RuntimePieChartData
} from '~/components/ECharts/PieChart/data'
import { BasicLink } from '~/components/Link'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { displayTableFeatures } from '~/components/Table/features/display'
import { Table } from '~/components/Table/Table'
import { TokenLogo } from '~/components/TokenLogo'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanelToolbar, ChartPanel, ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { slug } from '~/utils'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { buildProtocolBreakdownDominance } from './breakdownDominance'
import type { ProtocolBreakdownChart } from './useProtocolBreakdownCharts'
import { useProtocolBreakdownPresentation } from './useProtocolBreakdownPresentation'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart'))

const DEFAULT_SHARE_HEADER = '% of TVL'

type BreakdownChartView = 'line' | 'dominance' | 'table'
type TokensBreakdownView = 'pie' | 'table'

const BREAKDOWN_CHART_VIEW_OPTIONS = [
	{ value: 'line', label: 'Line' },
	{ value: 'dominance', label: 'Dominance' },
	{ value: 'table', label: 'Table' }
] as const satisfies ReadonlyArray<SegmentedControlOption<BreakdownChartView>>

const TOKENS_BREAKDOWN_VIEW_OPTIONS = [
	{ value: 'pie', label: 'Pie' },
	{ value: 'table', label: 'Table' }
] as const satisfies ReadonlyArray<SegmentedControlOption<TokensBreakdownView>>

/** A latest-point table row; `share` is absent for signed values such as inflows. */
export type SnapshotTableRow = { name: string; value: number; share?: number }
type SnapshotTableKind = 'Chain' | 'Token' | 'Inflow'

const snapshotColumnHelper = createColumnHelper<typeof displayTableFeatures, SnapshotTableRow>()

const buildSnapshotNameColumn = (nameHeader: 'Chain' | 'Token') =>
	snapshotColumnHelper.accessor('name', {
		header: nameHeader,
		enableSorting: false,
		cell: ({ getValue }) => {
			const name = getValue()
			if (nameHeader !== 'Chain' || name === 'Others') return name
			return (
				<span className="flex items-center gap-2">
					<TokenLogo name={name} kind="chain" size={20} alt={`Logo of ${name}`} />
					<BasicLink href={`/chain/${slug(name)}`} className="truncate label-md text-link hover:underline">
						{name}
					</BasicLink>
				</span>
			)
		},
		meta: { headerClassName: 'w-[min(220px,40vw)]' }
	})

const SNAPSHOT_VALUE_COLUMN = snapshotColumnHelper.accessor('value', {
	header: 'Value',
	cell: ({ getValue }) => formatUsd(getValue(), { compact: true }),
	meta: { headerClassName: 'w-[120px]', align: 'end' }
})

const buildSnapshotShareColumn = (shareHeader: string) =>
	snapshotColumnHelper.accessor('share', {
		header: shareHeader,
		cell: ({ getValue }) =>
			formatPercent(getValue(), { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
		meta: { headerClassName: 'w-[130px]', align: 'end' }
	})

const SNAPSHOT_INFLOW_COLUMN = snapshotColumnHelper.accessor('value', {
	header: 'Net Inflow',
	cell: ({ getValue }) => {
		const value = getValue()
		return (
			<span className={value > 0 ? 'text-data-up' : value < 0 ? 'text-data-down' : undefined}>
				{formatUsd(value, { compact: true, signDisplay: 'exceptZero' })}
			</span>
		)
	},
	meta: { headerClassName: 'w-[130px]', align: 'end' }
})

const buildSnapshotColumns = (kind: SnapshotTableKind, shareHeader: string) =>
	kind === 'Inflow'
		? snapshotColumnHelper.columns([buildSnapshotNameColumn('Token'), SNAPSHOT_INFLOW_COLUMN])
		: snapshotColumnHelper.columns([
				buildSnapshotNameColumn(kind),
				SNAPSHOT_VALUE_COLUMN,
				buildSnapshotShareColumn(shareHeader)
			])

export const buildSnapshotCsvSource = (
	rows: Array<SnapshotTableRow>,
	kind: SnapshotTableKind,
	shareHeader = DEFAULT_SHARE_HEADER
): ChartCsvSource => ({
	type: 'dataset',
	prepare: () =>
		kind === 'Inflow'
			? { dimensions: ['Token', 'Net Inflow'], source: rows.map((row) => [row.name, row.value]) }
			: {
					dimensions: [kind, 'Value', shareHeader],
					source: rows.map((row) => [row.name, row.value, row.share ?? null])
				}
})

export function BreakdownSnapshotTable({
	rows,
	kind,
	shareHeader = DEFAULT_SHARE_HEADER
}: {
	rows: Array<SnapshotTableRow>
	kind: SnapshotTableKind
	shareHeader?: string
}) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'value', desc: true }])
	const columns = React.useMemo(() => buildSnapshotColumns(kind, shareHeader), [kind, shareHeader])
	const table = useTable({
		features: displayTableFeatures,
		defaultColumn: { sortUndefined: 'last' },
		data: rows,
		columns,
		state: { sorting },
		enableSortingRemoval: false,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater))
	})

	if (rows.length === 0) {
		return (
			<ChartPanelBodyFallback className="body-sm text-secondary">No data for the selection.</ChartPanelBodyFallback>
		)
	}

	return (
		<div className="h-[360px] overflow-y-auto">
			<Table table={table} compact />
		</div>
	)
}

export function BreakdownChartCard({
	title,
	seriesLabel,
	allValues,
	breakdown,
	defaultValues,
	aggregateOthers,
	valueSymbol,
	showDominance = false,
	snapshot,
	shareHeader = DEFAULT_SHARE_HEADER,
	exportFilenameBase,
	exportTitle,
	exportIconUrl
}: {
	title: string
	seriesLabel: 'Chain' | 'Token'
	allValues: Array<string>
	breakdown: ProtocolBreakdownChart
	defaultValues?: Array<string>
	aggregateOthers: boolean
	valueSymbol: string
	showDominance?: boolean
	/** Latest-point slices; enables the table view. */
	snapshot?: RuntimePieChartData
	shareHeader?: string
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl: string | undefined
}) {
	const viewOptions = React.useMemo(
		() =>
			BREAKDOWN_CHART_VIEW_OPTIONS.filter(
				(option) =>
					(option.value !== 'dominance' || showDominance) && (option.value !== 'table' || snapshot !== undefined)
			),
		[showDominance, snapshot]
	)
	const [view, setView] = React.useState<BreakdownChartView>('line')
	const isDominance = view === 'dominance'
	const { activeSeries, setSelectedSeries, dataset, charts, selectedCharts, csvSource } =
		useProtocolBreakdownPresentation({
			scope: exportFilenameBase,
			breakdown,
			availableSeries: allValues,
			...(defaultValues ? { defaultSeries: defaultValues } : {}),
			aggregateOthers,
			type: 'line'
		})

	const dominance = React.useMemo(
		() =>
			isDominance
				? buildProtocolBreakdownDominance({ breakdown, availableSeries: allValues, activeSeries, aggregateOthers })
				: null,
		[activeSeries, aggregateOthers, allValues, breakdown, isDominance]
	)
	const tableRows = React.useMemo(
		() =>
			snapshot && view === 'table'
				? buildRuntimePieChartTableRows({ series: snapshot, selectedSeries: new Set(activeSeries) })
				: [],
		[activeSeries, snapshot, view]
	)

	const { chartInstance, handleChartReady } = useGetChartInstance()
	const chartSnapshot = React.useMemo(
		() => ({
			dataset: dominance?.dataset ?? dataset,
			charts: dominance?.charts ?? charts,
			selectedCharts,
			isDominance,
			csvSource: dominance?.csvSource ?? csvSource
		}),
		[charts, csvSource, dataset, dominance, isDominance, selectedCharts]
	)
	// Deferred together with the rows, so the chart and its export never pair old rows with a new selection or view.
	// The table renders live rows, so its export does too.
	const deferredChart = React.useDeferredValue(chartSnapshot)
	const exportsDominance = view !== 'table' && deferredChart.isDominance

	return (
		<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar>
				<h2 className="mr-auto heading-xs">{title}</h2>
				{viewOptions.length > 1 ? (
					<SegmentedControl<BreakdownChartView>
						options={viewOptions}
						value={view}
						onValueChange={setView}
						label={`${title} view`}
						variant="default"
						size="md"
					/>
				) : null}
				{allValues.length > 1 ? (
					<SelectWithCombobox
						allValues={allValues}
						selectedValues={activeSeries}
						setSelectedValues={setSelectedSeries}
						label={seriesLabel}
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={exportsDominance ? `${exportFilenameBase}-dominance` : exportFilenameBase}
					title={exportsDominance ? `${exportTitle} (Dominance)` : exportTitle}
					iconUrl={exportIconUrl}
					csvSource={
						view === 'table' ? buildSnapshotCsvSource(tableRows, seriesLabel, shareHeader) : deferredChart.csvSource
					}
					showPng={view !== 'table'}
				/>
			</ChartPanelToolbar>
			{view === 'table' ? (
				<BreakdownSnapshotTable rows={tableRows} kind={seriesLabel} shareHeader={shareHeader} />
			) : (
				<React.Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart
						dataset={deferredChart.dataset}
						charts={deferredChart.charts}
						csvSource={deferredChart.csvSource}
						hideDefaultLegend={false}
						valueSymbol={deferredChart.isDominance ? '%' : valueSymbol}
						{...(deferredChart.isDominance
							? { stacked: true, expandTo100Percent: true }
							: { selectedCharts: deferredChart.selectedCharts })}
						showTotalInTooltip={!deferredChart.isDominance && valueSymbol === '$'}
						onReady={handleChartReady}
					/>
				</React.Suspense>
			)}
		</ChartPanel>
	)
}

export function TokensBreakdownPieChartCard({
	title,
	tokenBreakdownPieSeries,
	shareHeader = DEFAULT_SHARE_HEADER,
	exportFilenameBase,
	exportTitle,
	exportIconUrl
}: {
	title: string
	tokenBreakdownPieSeries: RuntimePieChartData
	shareHeader?: string
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl: string | undefined
}) {
	const selectableSeries = React.useMemo(
		() => tokenBreakdownPieSeries.peers.map((peer) => peer.name),
		[tokenBreakdownPieSeries.peers]
	)
	const {
		activeSeries: selectedTokens,
		selectedCharts,
		setSelectedSeries: setSelectedTokens
	} = useLocalSelection({ scope: exportFilenameBase, allowEmptySelection: true, availableSeries: selectableSeries })
	const presentation = React.useMemo(() => {
		const selection = { series: tokenBreakdownPieSeries, selectedSeries: selectedCharts }
		const csvSource: ChartCsvSource = { type: 'dataset', prepare: () => buildRuntimePieChartCsvDataset(selection) }
		return { ...buildRuntimePieChartPresentation(selection), csvSource }
	}, [selectedCharts, tokenBreakdownPieSeries])
	// The export is deferred with the slices, so the CSV never pairs a new selection with the pie still on screen.
	const deferredPresentation = React.useDeferredValue(presentation)
	const [view, setView] = React.useState<TokensBreakdownView>('pie')
	const tableRows = React.useMemo(
		() =>
			view === 'table'
				? buildRuntimePieChartTableRows({
						series: tokenBreakdownPieSeries,
						selectedSeries: selectedCharts
					})
				: [],
		[selectedCharts, tokenBreakdownPieSeries, view]
	)

	const { chartInstance, handleChartReady } = useGetChartInstance()

	return (
		<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar>
				<h2 className="mr-auto heading-xs">{title}</h2>
				<SegmentedControl<TokensBreakdownView>
					options={TOKENS_BREAKDOWN_VIEW_OPTIONS}
					value={view}
					onValueChange={setView}
					label={`${title} view`}
					variant="default"
					size="md"
				/>
				{selectableSeries.length > 1 ? (
					<SelectWithCombobox
						allValues={selectableSeries}
						selectedValues={selectedTokens}
						setSelectedValues={setSelectedTokens}
						label="Token"
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={exportFilenameBase}
					title={exportTitle}
					iconUrl={exportIconUrl}
					csvSource={
						view === 'table' ? buildSnapshotCsvSource(tableRows, 'Token', shareHeader) : deferredPresentation.csvSource
					}
					showPng={view !== 'table'}
				/>
			</ChartPanelToolbar>
			{view === 'table' ? (
				<BreakdownSnapshotTable rows={tableRows} kind="Token" shareHeader={shareHeader} />
			) : (
				<React.Suspense fallback={<ChartPanelBodyFallback />}>
					<PieChart
						chartData={deferredPresentation.chartData}
						stackColors={deferredPresentation.stackColors}
						onReady={handleChartReady}
					/>
				</React.Suspense>
			)}
		</ChartPanel>
	)
}
