import { createColumnHelper } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { PanelTitle, PanelHeader } from '~/ui/Panel'
import { formatCompactNumber } from '~/utils/numberFormat'
import { isTrueQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import type { IRWAPlatformsOverviewRow } from './api.types'
import type { RWAPositionalChartDataset } from './chartDataset'
import { definitions } from './definitions'
import type { RWAFlowTreemapSizeRow } from './flowTreemap'
import { RWAOverviewBreakdownChart } from './OverviewBreakdownChart'
import {
	formatRWAOverviewUsd,
	getRWAOverviewAssetCount,
	getRWAOverviewCsvFileName,
	getRWAOverviewInclusion,
	getRWAOverviewTableData,
	hasExcludedRWAOverviewAssets
} from './overviewTableData'
import { rwaSlug } from './rwaSlug'

type RWAPlatformsTableRow = {
	platform: string
	logo: string | null
	assetCount: number
	activeMcap: number
	onChainMcap: number
	defiActiveTvl: number
	hasExcludedAssets: boolean
}

const columnHelper = createColumnHelper<SearchTableFeatures, RWAPlatformsTableRow>()

const columns = columnHelper.columns([
	columnHelper.accessor('platform', {
		id: 'platform',
		header: 'Name',
		enableSorting: false,
		cell: (info) => {
			const platform = info.getValue()
			return (
				<span className="flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					{info.row.original.logo ? (
						<TokenLogo src={info.row.original.logo} size={24} alt={`${platform} logo`} />
					) : null}
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
		cell: (info) => formatRWAOverviewUsd(info.getValue(), info.row.original.hasExcludedAssets),
		meta: {
			headerClassName: 'w-[min(200px,40vw)]',
			align: 'end',
			headerHelperText: definitions.totalActiveMcap.description
		}
	}),
	columnHelper.accessor((row) => row.onChainMcap ?? undefined, {
		id: 'onChainMcap',
		header: definitions.totalOnChainMcap.label,
		cell: (info) => formatRWAOverviewUsd(info.getValue(), info.row.original.hasExcludedAssets),
		meta: {
			headerClassName: 'w-[min(208px,40vw)]',
			align: 'end',
			headerHelperText: definitions.totalOnChainMcap.description
		}
	}),
	columnHelper.accessor((row) => row.defiActiveTvl ?? undefined, {
		id: 'defiActiveTvl',
		header: definitions.totalDefiActiveTvl.label,
		cell: (info) => formatRWAOverviewUsd(info.getValue(), info.row.original.hasExcludedAssets),
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: definitions.totalDefiActiveTvl.description
		}
	})
])
export function RWAPlatforms({
	platforms,
	initialChartDataset
}: {
	platforms: Array<IRWAPlatformsOverviewRow & { logo: string | null }>
	initialChartDataset: RWAPositionalChartDataset
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

	const data = platforms.map((row) => ({
		platform: row.platform,
		logo: row.logo,
		...getRWAOverviewTableData(row, inclusion),
		assetCount: getRWAOverviewAssetCount(row),
		hasExcludedAssets: hasExcludedRWAOverviewAssets(row, includeStablecoins, includeGovernance)
	}))
	const treemapSizeRows: Array<RWAFlowTreemapSizeRow> = data.map((row) => ({
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
				<Checkbox variant="filter" value="includeBridgeTvl" checked={includeBridgeTvl} onChange={onToggleBridgeTvl}>
					<span className="whitespace-nowrap">Bridge/Interop TVL</span>
				</Checkbox>
			</Card>
			<RWAOverviewBreakdownChart
				page={{ kind: 'platform' }}
				initialChartDataset={initialChartDataset}
				stackLabel="Platforms"
				treemapSizeRows={treemapSizeRows}
			/>
			<SearchTableProvider options={{ data, columns, initialState: { sorting: [{ id: 'activeMcap', desc: true }] } }}>
				<Card padding="none">
					<PanelHeader className="w-full justify-end">
						<PanelTitle as="h1" className="whitespace-nowrap">
							Platforms
						</PanelTitle>
						<TableSearchInput
							columnId="platform"
							placeholder="Search platforms..."
							className={searchFieldInlineWrapperStyles}
						/>
						<TableCsvExport filename={csvFileName} />
					</PanelHeader>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</div>
	)
}
