import { createColumnHelper } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { BasicLink } from '~/components/Link'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import type {} from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { formatCompactNumber } from '~/utils/numberFormat'
import { isTrueQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import type { IRWAChainsOverviewRow, RWAOverviewPage } from './api.types'
import type { RWAPositionalChartDataset } from './chartDataset'
import { definitions } from './definitions'
import type { RWAFlowTreemapSizeRow } from './flowTreemap'
import { RWAOverviewBreakdownChart } from './OverviewBreakdownChart'
import { formatRWAOverviewUsd, getRWAOverviewAssetCount, hasExcludedRWAOverviewAssets } from './overviewTableData'
import { rwaSlug } from './rwaSlug'

type RWAChainsTableRow = {
	chain: string
	totalOnChainMcap: number
	totalActiveMcap: number
	totalDefiActiveTvl: number
	totalAssetIssuers: number
	totalAssetCount: number
	hasExcludedAssets: boolean
}

const columnHelper = createColumnHelper<RWAChainsTableRow>()

const columns = [
	columnHelper.accessor('chain', {
		id: 'chain',
		header: 'Name',
		enableSorting: false,
		cell: (info) => {
			const chain = info.getValue()
			return (
				<span className="flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TokenLogo name={chain} kind="chain" data-lgonly alt={`Logo of ${chain}`} />
					<BasicLink href={`/rwa/chain/${rwaSlug(chain)}`} className="truncate label-md text-link hover:underline">
						{chain}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[160px] sm:w-[220px]'
		}
	}),
	columnHelper.accessor((row) => row.totalAssetIssuers ?? undefined, {
		id: 'totalAssetIssuers',
		header: definitions.totalAssetIssuers.label,
		cell: (info) =>
			formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: definitions.totalAssetIssuers.description
		}
	}),
	columnHelper.accessor((row) => row.totalAssetCount ?? undefined, {
		id: 'totalAssetCount',
		header: definitions.totalAssetCount.label,
		cell: (info) =>
			formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText: definitions.totalAssetCount.description
		}
	}),
	columnHelper.accessor((row) => row.totalActiveMcap ?? undefined, {
		id: 'totalActiveMcap',
		header: definitions.totalActiveMcap.label,
		cell: (info) => formatRWAOverviewUsd(info.getValue(), info.row.original.hasExcludedAssets),
		meta: {
			headerClassName: 'w-[min(200px,40vw)]',
			align: 'end',
			headerHelperText: definitions.totalActiveMcap.description
		}
	}),
	columnHelper.accessor((row) => row.totalOnChainMcap ?? undefined, {
		id: 'totalOnChainMcap',
		header: definitions.totalOnChainMcap.label,
		cell: (info) => formatRWAOverviewUsd(info.getValue(), info.row.original.hasExcludedAssets),
		meta: {
			headerClassName: 'w-[min(208px,40vw)]',
			align: 'end',
			headerHelperText: definitions.totalOnChainMcap.description
		}
	}),
	columnHelper.accessor((row) => row.totalDefiActiveTvl ?? undefined, {
		id: 'totalDefiActiveTvl',
		header: definitions.totalDefiActiveTvl.label,
		cell: (info) => formatRWAOverviewUsd(info.getValue(), info.row.original.hasExcludedAssets),
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: definitions.totalDefiActiveTvl.description
		}
	})
]
export function RWAChains({
	chains,
	initialChartDataset,
	page
}: {
	chains: IRWAChainsOverviewRow[]
	initialChartDataset: RWAPositionalChartDataset
	page: RWAOverviewPage
}) {
	const router = useRouter()
	const stablecoinsQ = router.query.includeStablecoins as string | string[] | undefined
	const governanceQ = router.query.includeGovernance as string | string[] | undefined

	const includeStablecoins = stablecoinsQ != null ? isTrueQueryParam(stablecoinsQ) : false
	const includeGovernance = governanceQ != null ? isTrueQueryParam(governanceQ) : false

	const onToggleStablecoins = useCallback(() => {
		void pushShallowQuery(router, { includeStablecoins: includeStablecoins ? undefined : 'true' })
	}, [includeStablecoins, router])

	const onToggleGovernance = useCallback(() => {
		void pushShallowQuery(router, { includeGovernance: includeGovernance ? undefined : 'true' })
	}, [includeGovernance, router])

	const data = useMemo(() => {
		return chains.map((row) => {
			let totalOnChainMcap = row.base.onChainMcap
			if (includeStablecoins) {
				totalOnChainMcap += row.stablecoinsOnly.onChainMcap
			}
			if (includeGovernance) {
				totalOnChainMcap += row.governanceOnly.onChainMcap
			}
			if (includeStablecoins || includeGovernance) {
				totalOnChainMcap += row.stablecoinsAndGovernance.onChainMcap
			}

			let totalActiveMcap = row.base.activeMcap
			if (includeStablecoins) {
				totalActiveMcap += row.stablecoinsOnly.activeMcap
			}
			if (includeGovernance) {
				totalActiveMcap += row.governanceOnly.activeMcap
			}
			if (includeStablecoins || includeGovernance) {
				totalActiveMcap += row.stablecoinsAndGovernance.activeMcap
			}

			let totalDefiActiveTvl = row.base.defiActiveTvl
			if (includeStablecoins) {
				totalDefiActiveTvl += row.stablecoinsOnly.defiActiveTvl
			}
			if (includeGovernance) {
				totalDefiActiveTvl += row.governanceOnly.defiActiveTvl
			}
			if (includeStablecoins || includeGovernance) {
				totalDefiActiveTvl += row.stablecoinsAndGovernance.defiActiveTvl
			}

			let totalAssetIssuers = [...row.base.assetIssuers]
			if (includeStablecoins) {
				totalAssetIssuers.push(...row.stablecoinsOnly.assetIssuers)
			}
			if (includeGovernance) {
				totalAssetIssuers.push(...row.governanceOnly.assetIssuers)
			}
			if (includeStablecoins || includeGovernance) {
				totalAssetIssuers.push(...row.stablecoinsAndGovernance.assetIssuers)
			}

			return {
				chain: row.chain,
				totalOnChainMcap,
				totalActiveMcap,
				totalDefiActiveTvl,
				totalAssetIssuers: Array.from(new Set(totalAssetIssuers)).length,
				totalAssetCount: getRWAOverviewAssetCount(row),
				hasExcludedAssets: hasExcludedRWAOverviewAssets(row, includeStablecoins, includeGovernance)
			}
		})
	}, [chains, includeGovernance, includeStablecoins])
	const treemapSizeRows: RWAFlowTreemapSizeRow[] = data.map((row) => ({
		name: row.chain,
		activeMcap: row.totalActiveMcap,
		onChainMcap: row.totalOnChainMcap,
		defiActiveTvl: row.totalDefiActiveTvl
	}))
	const csvFileName = (() => {
		const parts = ['rwa-chains']
		if (includeStablecoins) parts.push('stablecoins')
		if (includeGovernance) parts.push('governance')
		return `${parts.join('-')}.csv`
	})()

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
				page={page}
				initialChartDataset={initialChartDataset}
				stackLabel="Chains"
				treemapSizeRows={treemapSizeRows}
			/>
			<TableWithSearch
				data={data}
				columns={columns}
				placeholder="Search chains..."
				columnToSearch="chain"
				header="Chains"
				headingAs="h1"
				csvFileName={csvFileName}
				sortingState={[{ id: 'totalActiveMcap', desc: true }]}
			/>
		</div>
	)
}
