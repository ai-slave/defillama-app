import { createColumnHelper } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { BasicLink } from '~/components/Link'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import type {} from '~/components/Table/utils'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { formatUsd, formatCompactNumber } from '~/utils/numberFormat'
import { isTrueQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import type { IRWACategoriesOverviewRow, RWAOverviewPage } from './api.types'
import type { RWAPositionalChartDataset } from './chartDataset'
import { definitions } from './definitions'
import type { RWAFlowTreemapSizeRow } from './flowTreemap'
import { RWAOverviewBreakdownChart } from './OverviewBreakdownChart'
import { getRWAOverviewCsvFileName, getRWAOverviewInclusion, getRWAOverviewTableData } from './overviewTableData'
import { rwaSlug } from './rwaSlug'

type RWACategoriesTableRow = {
	category: string
	assetIssuers: number
	assetCount: number
	activeMcap: number
	onChainMcap: number
	defiActiveTvl: number
}

const columnHelper = createColumnHelper<RWACategoriesTableRow>()

const columns = [
	columnHelper.accessor('category', {
		id: 'category',
		header: 'Name',
		enableSorting: false,
		cell: (info) => {
			const category = info.getValue()
			return (
				<span className="flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<BasicLink
						href={`/rwa/category/${rwaSlug(category)}`}
						className="truncate label-md text-link hover:underline"
					>
						{category}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[180px] sm:w-[240px]'
		}
	}),
	columnHelper.accessor((row) => row.assetIssuers ?? undefined, {
		id: 'assetIssuers',
		header: definitions.totalAssetIssuers.label,
		cell: (info) =>
			formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[168px]',
			align: 'end',
			headerHelperText: definitions.totalAssetIssuers.description
		}
	}),
	columnHelper.accessor((row) => row.assetCount ?? undefined, {
		id: 'assetCount',
		header: definitions.totalAssetCount.label,
		cell: (info) =>
			formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText: definitions.totalAssetCount.description
		}
	}),
	columnHelper.accessor((row) => row.activeMcap ?? undefined, {
		id: 'activeMcap',
		header: definitions.totalActiveMcap.label,
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[min(200px,40vw)]',
			align: 'end',
			headerHelperText: definitions.totalActiveMcap.description
		}
	}),
	columnHelper.accessor((row) => row.onChainMcap ?? undefined, {
		id: 'onChainMcap',
		header: definitions.totalOnChainMcap.label,
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[min(208px,40vw)]',
			align: 'end',
			headerHelperText: definitions.totalOnChainMcap.description
		}
	}),
	columnHelper.accessor((row) => row.defiActiveTvl ?? undefined, {
		id: 'defiActiveTvl',
		header: definitions.totalDefiActiveTvl.label,
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: definitions.totalDefiActiveTvl.description
		}
	})
]
export function RWACategories({
	categories,
	initialChartDataset,
	page
}: {
	categories: IRWACategoriesOverviewRow[]
	initialChartDataset: RWAPositionalChartDataset
	page: RWAOverviewPage
}) {
	const router = useRouter()
	const includeStablecoins = isTrueQueryParam(router.query.includeStablecoins)
	const includeGovernance = isTrueQueryParam(router.query.includeGovernance)
	const includeBridgeTvl =
		router.query.includeBridgeTvl != null ? isTrueQueryParam(router.query.includeBridgeTvl) : true
	const inclusion = getRWAOverviewInclusion(includeStablecoins, includeGovernance, includeBridgeTvl)

	const onToggleStablecoins = () => {
		void pushShallowQuery(router, { includeStablecoins: includeStablecoins ? undefined : 'true' })
	}

	const onToggleGovernance = () => {
		void pushShallowQuery(router, { includeGovernance: includeGovernance ? undefined : 'true' })
	}

	const onToggleBridgeTvl = () => {
		void pushShallowQuery(router, { includeBridgeTvl: includeBridgeTvl ? 'false' : undefined })
	}

	const data = categories.map((row) => ({
		category: row.category,
		...getRWAOverviewTableData(row, inclusion)
	}))
	const treemapSizeRows: RWAFlowTreemapSizeRow[] = data.map((row) => ({
		name: row.category,
		activeMcap: row.activeMcap,
		onChainMcap: row.onChainMcap,
		defiActiveTvl: row.defiActiveTvl
	}))
	const csvFileName = getRWAOverviewCsvFileName('rwa-categories', inclusion)

	return (
		<div className="flex flex-col gap-2">
			<Card padding="sm" className="flex flex-wrap items-center gap-2">
				<Checkbox
					variant="filter"
					value="includeStablecoins"
					checked={includeStablecoins}
					onChange={onToggleStablecoins}
				>
					<span className="whitespace-nowrap">Stablecoins</span>
				</Checkbox>
				<Checkbox variant="filter" value="includeGovernance" checked={includeGovernance} onChange={onToggleGovernance}>
					<span className="whitespace-nowrap">Governance Tokens</span>
				</Checkbox>
				<Checkbox variant="filter" value="includeBridgeTvl" checked={includeBridgeTvl} onChange={onToggleBridgeTvl}>
					<span className="whitespace-nowrap">Bridge/Interop TVL</span>
				</Checkbox>
			</Card>
			<RWAOverviewBreakdownChart
				page={page}
				initialChartDataset={initialChartDataset}
				stackLabel="Categories"
				treemapSizeRows={treemapSizeRows}
			/>
			<TableWithSearch
				data={data}
				columns={columns}
				placeholder="Search categories..."
				columnToSearch="category"
				header="Categories"
				headingAs="h1"
				csvFileName={csvFileName}
				sortingState={[{ id: 'activeMcap', desc: true }]}
			/>
		</div>
	)
}
