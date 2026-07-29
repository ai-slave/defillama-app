import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { BasicLink } from '~/components/Link'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TokenLogo } from '~/components/TokenLogo'
import { slug } from '~/utils'
import { formatUsd } from '~/utils/numberFormat'
import type { ChainAssetsFlowEntry, ChainsAssetsResponse } from './api.types'
import type { IBridgedRow } from './types'

interface BridgedTVLChainsListProps {
	assets: ChainsAssetsResponse
	chains: Array<{ label: string; to: string }>
	flows1d: Record<string, ChainAssetsFlowEntry> | null
	deprecatedChains: Record<string, true>
}

const DEFAULT_SORTING_STATE = [{ id: 'total', desc: true }]

const columnHelper = createColumnHelper<IBridgedRow>()

export function BridgedTVLChainsList({ assets, chains, flows1d, deprecatedChains }: BridgedTVLChainsListProps) {
	const data = useMemo(() => {
		const rows: IBridgedRow[] = []
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
		rows.sort((a, b) => b.total.total - a.total.total)
		return rows
	}, [assets, flows1d, deprecatedChains])

	return (
		<>
			<RowLinksWithDropdown links={chains} activeLink="All" />
			<TableWithSearch
				data={data}
				columns={bridgedColumns}
				placeholder={'Search chains...'}
				columnToSearch={'name'}
				csvFileName="bridged-chains"
				sortingState={DEFAULT_SORTING_STATE}
			/>
		</>
	)
}

const bridgedColumns = [
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TokenLogo name={value} kind="chain" alt={`Logo of ${value}`} />
					<BasicLink
						href={`/bridged/${slug(value)}`}
						className="truncate text-sm font-medium text-link hover:underline"
					>
						{value}
					</BasicLink>
					{row.original.deprecated ? <DeprecatedEntityMarker content="Deprecated chain" /> : null}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(200px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.total.total, {
		id: 'total',
		header: 'Total Bridged',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: 'Total value of assets on the chain, excluding own tokens'
		}
	}),
	columnHelper.accessor((row) => row.native?.total ?? undefined, {
		id: 'native',
		header: 'Native',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end',
			headerHelperText: 'Assets minted natively on the chain'
		}
	}),
	columnHelper.accessor((row) => row.canonical?.total ?? undefined, {
		id: 'canonical',
		header: 'Canonical',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: 'Assets bridged through the official canonical bridge'
		}
	}),
	columnHelper.accessor((row) => row.ownTokens?.total ?? undefined, {
		id: 'ownTokens',
		header: 'Own Tokens',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: 'The chains own token, either for gas or for governance '
		}
	}),
	columnHelper.accessor((row) => row.thirdParty?.total ?? undefined, {
		id: 'thirdParty',
		header: 'Third Party',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: 'Assets bridged through bridges that aren’t the canonical bridge'
		}
	})
]
