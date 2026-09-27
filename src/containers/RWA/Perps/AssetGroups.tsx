import { createColumnHelper } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import type { RWAChartDataset } from '~/containers/RWA/chartDataset'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { PanelTitle, PanelHeader } from '~/ui/Panel'
import { formatCompactNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import { isTrueQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import { perpsDefinitions as d } from './definitions'
import { getRWAPerpsCexOnlyStacks, RWAPerpsOverviewChart } from './OverviewChart'
import type { IRWAPerpsAssetGroupsOverviewRow } from './types'

const columnHelper = createColumnHelper<SearchTableFeatures, IRWAPerpsAssetGroupsOverviewRow>()

const columns = columnHelper.columns([
	columnHelper.accessor('assetGroup', {
		id: 'assetGroup',
		header: 'Name',
		enableSorting: false,
		cell: (info) => (
			<span className="flex items-center gap-2">
				<span className="vf-row-index shrink-0" aria-hidden="true" />
				<BasicLink
					href={`/rwa/perps/asset-group/${rwaSlug(info.getValue())}`}
					className="truncate label-md text-link hover:underline"
				>
					{info.getValue()}
				</BasicLink>
			</span>
		),
		meta: {
			headerClassName: 'w-[160px] sm:w-[220px]',
			headerHelperText: d.assetGroup.description
		}
	}),
	columnHelper.accessor((row) => row.openInterest ?? undefined, {
		id: 'openInterest',
		header: d.openInterest.label,
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: d.openInterest.description
		}
	}),
	columnHelper.accessor((row) => row.openInterestShare ?? undefined, {
		id: 'openInterestShare',
		header: d.openInterestShare.label,
		cell: (info) =>
			`${formatPercent(info.getValue(), { input: 'fraction', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`,
		meta: {
			headerClassName: 'w-[150px]',
			align: 'end',
			headerHelperText: d.openInterestShare.description
		}
	}),
	columnHelper.accessor((row) => row.volume24h ?? undefined, {
		id: 'volume24h',
		header: d.volume24h.label,
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: d.volume24h.description
		}
	}),
	columnHelper.accessor((row) => row.volume24hShare ?? undefined, {
		id: 'volume24hShare',
		header: d.volume24hShare.label,
		cell: (info) =>
			`${formatPercent(info.getValue(), { input: 'fraction', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`,
		meta: {
			headerClassName: 'w-[min(190px,40vw)]',
			align: 'end',
			headerHelperText: d.volume24hShare.description
		}
	}),
	columnHelper.accessor((row) => row.markets ?? undefined, {
		id: 'markets',
		header: d.markets.label,
		cell: (info) =>
			formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: d.markets.description
		}
	})
])
export function RWAPerpsAssetGroupsOverview({
	assetGroups,
	dexAssetGroups,
	initialChartDataset
}: {
	assetGroups: Array<IRWAPerpsAssetGroupsOverviewRow>
	dexAssetGroups: Array<IRWAPerpsAssetGroupsOverviewRow>
	initialChartDataset: RWAChartDataset
}) {
	const router = useRouter()
	const includeCex = isTrueQueryParam(router.query.includeCex)
	const rows = includeCex ? assetGroups : dexAssetGroups
	const onToggleIncludeCex = () => {
		void pushShallowQuery(router, { includeCex: includeCex ? undefined : 'true' })
	}

	return (
		<div className="flex flex-col gap-2">
			<Card padding="sm" className="flex flex-wrap items-center gap-2">
				<Checkbox variant="filter" value="includeCex" checked={includeCex} onChange={onToggleIncludeCex}>
					<span className="whitespace-nowrap">CEX Venues</span>
				</Checkbox>
			</Card>
			<RWAPerpsOverviewChart
				breakdown="assetGroup"
				initialChartDataset={initialChartDataset}
				includeCex={includeCex}
				cexOnlyStacks={getRWAPerpsCexOnlyStacks(
					assetGroups.map((row) => row.assetGroup),
					dexAssetGroups.map((row) => row.assetGroup)
				)}
				stackLabel={d.assetGroup.label}
			/>
			<SearchTableProvider
				options={{ data: rows, columns, initialState: { sorting: [{ id: 'openInterest', desc: true }] } }}
			>
				<Card padding="none">
					<PanelHeader>
						<PanelTitle as="h1" className="whitespace-nowrap">
							Asset Groups
						</PanelTitle>
						<TableSearchInput
							columnId="assetGroup"
							placeholder="Search asset groups..."
							className={searchFieldInlineWrapperStyles}
						/>
						<TableCsvExport filename="rwa-perps-asset-groups.csv" />
					</PanelHeader>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</div>
	)
}
