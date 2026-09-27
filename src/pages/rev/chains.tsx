import { createColumnHelper } from '@tanstack/react-table'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { getChainsByREVPageData } from '~/containers/AdapterMetrics/queries'
import type { IChainsByREVPageData } from '~/containers/AdapterMetrics/types'
import Layout from '~/layout'
import { definitions } from '~/public/definitions'
import { Card } from '~/ui/Card'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { PanelTitle, PanelHeader } from '~/ui/Panel'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatUsd } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'

const adapterType = ADAPTER_TYPES.FEES

export const getStaticProps = withPerformanceLogging(`${adapterType}/chains`, async () => {
	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const data = await getChainsByREVPageData({ chainMetadata: metadataCache.chainMetadata })

	return {
		props: data,
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Chains', 'ranked by', 'REV']
const DEFAULT_SORTING_STATE = [{ id: 'total24h', desc: true }]

const columnHelper = createColumnHelper<SearchTableFeatures, IChainsByREVPageData['chains'][0]>()

function REVByChain(props: IChainsByREVPageData) {
	return (
		<Layout
			title="Real Economic Value (REV) by Blockchain - DefiLlama"
			description="Compare Real Economic Value (REV) by chain, the sum of chain fees and MEV tips. Track 24h and 30d rankings."
			canonicalUrl="/rev/chains"
			pageName={pageName}
		>
			<SearchTableProvider options={{ data: props.chains, columns, initialState: { sorting: DEFAULT_SORTING_STATE } }}>
				<Card padding="none">
					<PanelHeader>
						<PanelTitle as="h1" className="whitespace-nowrap">
							Chain Rankings
						</PanelTitle>
						<TableSearchInput
							columnId="name"
							placeholder="Search chains..."
							className={searchFieldInlineWrapperStyles}
						/>
						<TableCsvExport filename="revenue-chains" />
					</PanelHeader>
					<VirtualSearchTableView rowSize={64} compact />
				</Card>
			</SearchTableProvider>
		</Layout>
	)
}

const columns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()

			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo src={row.original.logo} alt={`Logo of ${row.original.name}`} data-lgonly />

					<span className="-my-2 flex flex-col">
						<BasicLink
							href={`/chain/${row.original.slug}`}
							className="truncate text-sm font-medium text-link hover:underline"
						>
							{value}
						</BasicLink>
					</span>
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
		header: 'REV 24h',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'center',
			headerHelperText: definitions.rev.chain['24h']
		}
	}),
	columnHelper.accessor((row) => row.total30d ?? undefined, {
		id: 'total30d',
		header: 'REV 30d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'center',
			headerHelperText: definitions.rev.chain['30d']
		}
	})
])

export default REVByChain
