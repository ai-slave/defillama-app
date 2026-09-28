import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { BasicLink } from '~/components/Link'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { TableToolbar } from '~/ui/Toolbar'
import { slug } from '~/utils'
import { formatUsd } from '~/utils/numberFormat'
import type { ChainAssetCategoryKey, ChainsAssetsFlows1dResponse, ChainsAssetTotalsResponse } from './api.types'
import type { IBridgedRow } from './types'

interface BridgedTVLChainsListProps {
	assets: ChainsAssetTotalsResponse
	chains: Array<{ label: string; to: string }>
	flows1d: ChainsAssetsFlows1dResponse | null
	deprecatedChains: Record<string, true>
}

const DEFAULT_SORTING_STATE = [{ id: 'total', desc: true }]

const columnHelper = createColumnHelper<SearchTableFeatures, IBridgedRow>()

export function BridgedTVLChainsList({ assets, chains, flows1d, deprecatedChains }: BridgedTVLChainsListProps) {
	const data = useMemo(() => {
		const rows: Array<IBridgedRow> = []
		for (const name in assets) {
			const chainAssets = assets[name]
			if (chainAssets === undefined) continue
			const chainFlows = flows1d?.[name]
			const row: IBridgedRow = {
				name,
				deprecated: deprecatedChains[name] === true,
				...chainAssets
			}
			const change24h = chainFlows?.total?.perc
			if (change24h != null) row.change_24h = change24h
			rows.push(row)
		}
		return rows
	}, [assets, flows1d, deprecatedChains])

	const columns = useMemo(() => buildBridgedColumns(data), [data])

	return (
		<>
			<RowLinksWithDropdown heading="Chains" links={chains} activeLink="All" />
			<SearchTableProvider options={{ data, columns, initialState: { sorting: DEFAULT_SORTING_STATE } }}>
				<Card padding="none">
					<TableToolbar>
						<TableSearchInput columnId="name" placeholder="Search chains..." />
						<TableCsvExport filename="bridged-chains" />
					</TableToolbar>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</>
	)
}

const BRIDGED_SECTION_COLUMNS = [
	{
		id: 'total',
		header: 'Total Bridged',
		width: 'w-[120px]',
		helperText: 'Total value of assets on the chain, excluding own tokens'
	},
	{ id: 'native', header: 'Native', width: 'w-[110px]', helperText: 'Assets minted natively on the chain' },
	{
		id: 'canonical',
		header: 'Canonical',
		width: 'w-[120px]',
		helperText: 'Assets bridged through the official canonical bridge'
	},
	{
		id: 'ownTokens',
		header: 'Own Tokens',
		width: 'w-[120px]',
		helperText: 'The chains own token, either for gas or for governance '
	},
	{
		id: 'thirdParty',
		header: 'Third Party',
		width: 'w-[120px]',
		helperText: 'Assets bridged through bridges that aren’t the canonical bridge'
	},
	{ id: 'stablecoins', header: 'Stablecoins', width: 'w-[120px]', helperText: 'Stablecoins held on the chain' },
	{ id: 'rwa', header: 'RWAs', width: 'w-[110px]', helperText: 'Tokenized real world assets held on the chain' },
	{ id: 'lst', header: 'Liquid Staking', width: 'w-[130px]', helperText: 'Liquid staking tokens held on the chain' }
] as const

const bridgedNameColumn = columnHelper.accessor('name', {
	id: 'name',
	header: 'Name',
	enableSorting: false,
	cell: ({ getValue, row }) => {
		const value = getValue()
		return (
			<span className="relative flex items-center gap-2">
				<span className="vf-row-index shrink-0" aria-hidden="true" />
				<TokenLogo name={value} kind="chain" alt={`Logo of ${value}`} />
				<BasicLink href={`/bridged/${slug(value)}`} className="truncate text-sm font-medium text-link hover:underline">
					{value}
				</BasicLink>
				{row.original.deprecated ? <DeprecatedEntityMarker content="Deprecated chain" /> : null}
			</span>
		)
	},
	meta: {
		headerClassName: 'w-[min(200px,40vw)]'
	}
})

/**
 * Columns follow the producer: a section it never reports gets no column at all, so switching the
 * producer from five sections to eight adds the new columns without leaving empty ones behind first.
 */
export function buildBridgedColumns(rows: Array<IBridgedRow>) {
	const reported = new Set<ChainAssetCategoryKey>()
	for (const row of rows) {
		for (const { id } of BRIDGED_SECTION_COLUMNS) {
			if (row[id] !== undefined) reported.add(id)
		}
	}

	return [
		bridgedNameColumn,
		...BRIDGED_SECTION_COLUMNS.filter(({ id }) => reported.has(id)).map(({ id, header, width, helperText }) =>
			columnHelper.accessor((row) => row[id]?.total ?? undefined, {
				id,
				header,
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: width,
					align: 'end',
					headerHelperText: helperText
				}
			})
		)
	]
}
