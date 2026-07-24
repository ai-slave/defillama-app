import { createColumnHelper } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { BasicLink } from '~/components/Link'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import type {} from '~/components/Table/utils'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { formatUsd, formatCompactNumber } from '~/utils/numberFormat'
import { isTrueQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import type { IRWAPlatformsOverviewRow } from './api.types'
import type { RWAPositionalChartDataset } from './chartDataset'
import { definitions } from './definitions'
import type { RWAFlowTreemapSizeRow } from './flowTreemap'
import { RWAOverviewBreakdownChart } from './OverviewBreakdownChart'
import { getRWAOverviewCsvFileName, getRWAOverviewInclusion, getRWAOverviewTableData } from './overviewTableData'
import { rwaSlug } from './rwaSlug'

type RWAPlatformsTableRow = {
	platform: string
	assetCount: number
	activeMcap: number
	onChainMcap: number
	defiActiveTvl: number
}

const columnHelper = createColumnHelper<RWAPlatformsTableRow>()

const columns = [
	columnHelper.accessor('platform', {
		id: 'platform',
		header: 'Name',
		enableSorting: false,
		cell: (info) => {
			const platform = info.getValue()
			return (
				<span className="flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<BasicLink
						href={`/rwa/platform/${rwaSlug(platform)}`}
						className="truncate label-md text-link hover:underline"
					>
						{platform}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[180px] sm:w-[240px]'
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
export function RWAPlatforms({
	platforms,
	initialChartDataset
}: {
	platforms: IRWAPlatformsOverviewRow[]
	initialChartDataset: RWAPositionalChartDataset
}) {
	const router = useRouter()
	const includeStablecoins = isTrueQueryParam(router.query.includeStablecoins)
	const includeGovernance = isTrueQueryParam(router.query.includeGovernance)
	const inclusion = getRWAOverviewInclusion(includeStablecoins, includeGovernance)

	const onToggleStablecoins = () => {
		void pushShallowQuery(router, { includeStablecoins: includeStablecoins ? undefined : 'true' })
	}

	const onToggleGovernance = () => {
		void pushShallowQuery(router, { includeGovernance: includeGovernance ? undefined : 'true' })
	}

	const data = platforms.map((row) => ({
		platform: row.platform,
		...getRWAOverviewTableData(row, inclusion)
	}))
	const treemapSizeRows: RWAFlowTreemapSizeRow[] = data.map((row) => ({
		name: row.platform,
		activeMcap: row.activeMcap,
		onChainMcap: row.onChainMcap,
		defiActiveTvl: row.defiActiveTvl
	}))
	const csvFileName = getRWAOverviewCsvFileName('rwa-platforms', inclusion)

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
			</Card>
			<RWAOverviewBreakdownChart
				page={{ kind: 'platform' }}
				initialChartDataset={initialChartDataset}
				stackLabel="Platforms"
				treemapSizeRows={treemapSizeRows}
			/>
			<TableWithSearch
				data={data}
				columns={columns}
				placeholder="Search platforms..."
				columnToSearch="platform"
				header="Platforms"
				headingAs="h1"
				csvFileName={csvFileName}
				sortingState={[{ id: 'activeMcap', desc: true }]}
			/>
		</div>
	)
}
