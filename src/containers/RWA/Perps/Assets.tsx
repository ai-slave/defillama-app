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
import { Tooltip } from '~/ui/Tooltip'
import { formatCompactNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import { isTrueQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import { perpsDefinitions as d } from './definitions'
import { getRWAPerpsCexOnlyStacks, RWAPerpsOverviewChart } from './OverviewChart'
import type { IRWAPerpsAssetsOverviewRow } from './types'

const columnHelper = createColumnHelper<SearchTableFeatures, IRWAPerpsAssetsOverviewRow>()

function formatFundingRate(value: number) {
	return formatPercent(value * 100, {
		input: 'percent',
		compact: true,
		minimumCompactValue: 1_000_000,
		compactSuffix: 'lowercase'
	})
}

const columns = columnHelper.columns([
	columnHelper.accessor('asset', {
		id: 'asset',
		header: d.baseAsset.label,
		enableSorting: false,
		cell: (info) => (
			<span className="flex items-center gap-2">
				<span className="vf-row-index shrink-0" aria-hidden="true" />
				<BasicLink
					href={`/rwa/perps/asset/${rwaSlug(info.getValue())}`}
					className="truncate label-md text-link hover:underline"
				>
					{info.getValue()}
				</BasicLink>
			</span>
		),
		meta: {
			headerClassName: 'w-[220px]',
			headerHelperText: d.baseAsset.description
		}
	}),
	columnHelper.accessor((row) => row.assetGroups.join(', '), {
		id: 'assetGroups',
		header: d.assetGroup.label,
		cell: (info) => (
			<Tooltip content={info.getValue()} render={<span className="inline-block max-w-full truncate" />}>
				{info.getValue()}
			</Tooltip>
		),
		enableSorting: false,
		meta: {
			headerClassName: 'w-[200px]',
			headerHelperText: d.assetGroup.description
		}
	}),
	columnHelper.accessor((row) => row.markets ?? undefined, {
		id: 'markets',
		header: d.markets.label,
		cell: (info) => formatCompactNumber(info.getValue()),
		meta: { headerClassName: 'w-[112px]', align: 'end', headerHelperText: d.markets.description }
	}),
	columnHelper.accessor((row) => row.venues ?? undefined, {
		id: 'venues',
		header: 'Venues',
		cell: (info) => (
			<span className="flex flex-col items-end">
				<span>{formatCompactNumber(info.getValue())}</span>
				<span className="body-sm text-tertiary">
					{info.row.original.dexVenues} DEX · {info.row.original.cexVenues} CEX
				</span>
			</span>
		),
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end',
			headerHelperText: 'Number of distinct venues listing this asset.'
		}
	}),
	columnHelper.accessor((row) => row.openInterest ?? undefined, {
		id: 'openInterest',
		header: d.openInterest.label,
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { headerClassName: 'w-[152px]', align: 'end', headerHelperText: d.openInterest.description }
	}),
	columnHelper.accessor((row) => row.volume24h ?? undefined, {
		id: 'volume24h',
		header: d.volume24h.label,
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { headerClassName: 'w-[152px]', align: 'end', headerHelperText: d.volume24h.description }
	}),
	columnHelper.accessor((row) => row.fundingRateMin ?? undefined, {
		id: 'fundingRateMin',
		header: 'Funding Range',
		cell: (info) => (
			<span className="whitespace-nowrap">
				{formatFundingRate(info.getValue())} – {formatFundingRate(info.row.original.fundingRateMax)}
			</span>
		),
		meta: { headerClassName: 'w-[200px]', align: 'end', headerHelperText: d.fundingRate.description }
	})
])

export function RWAPerpsAssetsOverview({
	assets,
	dexAssets,
	initialChartDataset
}: {
	assets: Array<IRWAPerpsAssetsOverviewRow>
	dexAssets: Array<IRWAPerpsAssetsOverviewRow>
	initialChartDataset: RWAChartDataset | null
}) {
	const router = useRouter()
	const includeCex = isTrueQueryParam(router.query.includeCex)
	const rows = includeCex ? assets : dexAssets

	return (
		<div className="flex flex-col gap-2">
			<Card padding="sm" className="flex flex-wrap items-center gap-2">
				<Checkbox
					variant="filter"
					value="includeCex"
					checked={includeCex}
					onChange={() => void pushShallowQuery(router, { includeCex: includeCex ? undefined : 'true' })}
				>
					<span className="whitespace-nowrap">CEX Venues</span>
				</Checkbox>
			</Card>
			<RWAPerpsOverviewChart
				breakdown="baseAsset"
				initialChartDataset={initialChartDataset}
				includeCex={includeCex}
				cexOnlyStacks={getRWAPerpsCexOnlyStacks(
					assets.map((row) => row.asset),
					dexAssets.map((row) => row.asset)
				)}
				stackLabel={d.baseAsset.label}
			/>
			<SearchTableProvider
				options={{ data: rows, columns, initialState: { sorting: [{ id: 'openInterest', desc: true }] } }}
			>
				<Card padding="none">
					<PanelHeader>
						<PanelTitle as="h1" className="whitespace-nowrap">
							Asset Rankings
						</PanelTitle>
						<TableSearchInput
							columnId="asset"
							placeholder="Search assets…"
							className={searchFieldInlineWrapperStyles}
						/>
						<TableCsvExport filename="rwa-perps-assets.csv" />
					</PanelHeader>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</div>
	)
}
