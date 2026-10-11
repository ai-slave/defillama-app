import { createColumnHelper, sortFn_datetime } from '@tanstack/react-table'
import * as React from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { CHART_COLORS } from '~/constants/colors'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { TableToolbar } from '~/ui/Toolbar'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
import data from './final.json'

const MultiSeriesChart = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart')
) as React.FC<IMultiSeriesChartProps>

type BankRow = Record<string, string | number> & {
	'1': string
	'4': string
	'6': number
	'7': number
	date: number
}

const columnHelper = createColumnHelper<SearchTableFeatures, BankRow>()

const banksTableColumns = columnHelper.columns([
	columnHelper.accessor('1', {
		header: 'Name',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[min(220px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.date ?? undefined, {
		id: 'date',
		header: 'Closing date',
		sortFn: sortFn_datetime,
		cell: (info) => (info.getValue() ? formatDate(info.getValue(), { input: 'seconds' }) : ''),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row['6'] * 1e6, {
		id: 'assets',
		header: 'Assets',
		cell: (info) =>
			info.getValue()
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: '',
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row['7'] * 1e6, {
		id: 'assets-inflation-adjusted',
		header: 'Assets (inflation adjusted)',
		cell: (info) =>
			info.getValue()
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: '',
		meta: {
			headerClassName: 'w-[min(220px,40vw)]',
			align: 'end'
		}
	})
])

const tableData: Array<BankRow> = data.banks.map((bank) => ({
	...(bank as unknown as BankRow),
	date: new Date(String(bank['4'])).getTime() / 1e3
}))

const chartData: Array<[number, number]> = []
for (const year in data.years) {
	chartData.push([new Date(year).getTime() / 1e3, (data.years[year] as number) * 1e6])
}
const DEFAULT_SORTING_STATE = [{ id: 'date', desc: true }]

const chartDataset: MultiSeriesChartDataset = {
	source: chartData.map(([ts, value]) => [ts * 1e3, value]),
	dimensions: ['timestamp', 'Assets']
}

const chartCharts: IMultiSeriesChartProps['charts'] = [
	{
		type: 'bar',
		name: 'Assets',
		encode: { x: 'timestamp', y: 'Assets' },
		color: CHART_COLORS[0]
	}
]

function Banks() {
	return (
		<Layout
			title="Historical Bank Failures Database - DefiLlama"
			description="Historical US bank failures database with closing dates, assets at failure, and inflation-adjusted annual totals."
			canonicalUrl="/banks"
		>
			<ChartPanel className="relative col-span-2">
				<React.Suspense fallback={<ChartPanelExportShellLoading />}>
					<MultiSeriesChart
						title="Assets of failed banks (inflation adjusted)"
						dataset={chartDataset}
						charts={chartCharts}
						valueSymbol="$"
						exportButtons="auto"
					/>
				</React.Suspense>
			</ChartPanel>
			<SearchTableProvider
				options={{ data: tableData, columns: banksTableColumns, initialState: { sorting: DEFAULT_SORTING_STATE } }}
			>
				<Card padding="none">
					<TableToolbar>
						<TableSearchInput columnId="1" placeholder="Search banks…" />
						<TableCsvExport filename="banks" />
					</TableToolbar>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</Layout>
	)
}

export default Banks
