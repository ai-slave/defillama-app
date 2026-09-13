import { createColumnHelper, type SortingState } from '@tanstack/react-table'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { PanelTitle, PanelHeader } from '~/ui/Panel'
import { slug } from '~/utils'
import { formatUsd } from '~/utils/numberFormat'

export interface INftChainRow {
	name: string
	logo: string
	total24h: number
	deprecated?: boolean
}

interface INftsByChainProps {
	chains: Array<INftChainRow>
}

export function NftsByChain({ chains }: INftsByChainProps) {
	return (
		<SearchTableProvider options={{ data: chains, columns, initialState: { sorting: DEFAULT_SORTING_STATE } }}>
			<Card padding="none">
				<PanelHeader className="w-full justify-end">
					<PanelTitle as="h1" className="whitespace-nowrap">
						Protocol Rankings
					</PanelTitle>
					<TableSearchInput
						columnId="name"
						placeholder="Search protocols..."
						className={searchFieldInlineWrapperStyles}
					/>
					<TableCsvExport filename="nft-chains" />
				</PanelHeader>
				<VirtualSearchTableView />
			</Card>
		</SearchTableProvider>
	)
}

const DEFAULT_SORTING_STATE: SortingState = [{ id: 'total24h', desc: true }]
const columnHelper = createColumnHelper<SearchTableFeatures, INftChainRow>()

const columns = columnHelper.columns([
	columnHelper.accessor('name', {
		id: 'name',
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()

			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo src={row.original.logo} data-lgonly />

					<BasicLink href={`/chain/${slug(value)}`} className="truncate text-sm font-medium text-link hover:underline">
						{value}
					</BasicLink>
					{row.original.deprecated ? <DeprecatedEntityMarker content="Deprecated chain" /> : null}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(280px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.total24h ?? undefined, {
		id: 'total24h',
		header: 'NFT Volume 24h',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end',
			headerHelperText: 'Sum of volume across all NFT exchanges on the chain in the last 24 hours'
		}
	})
])
