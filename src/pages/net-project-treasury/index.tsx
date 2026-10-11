import { createColumnHelper } from '@tanstack/react-table'
import type { InferGetStaticPropsType } from 'next'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { getNetProjectTreasuryData } from '~/containers/Treasuries/queries'
import type { INetProjectTreasury } from '~/containers/Treasuries/types'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { Logo } from '~/ui/Logo'
import { PanelTitle, PanelHeader } from '~/ui/Panel'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatUsd } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging(`net-project-treasury/index`, async () => {
	const protocols = await getNetProjectTreasuryData()
	return {
		props: { protocols },
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Protocols', 'ranked by', 'Net Project Treasury']
const DEFAULT_SORTING_STATE = [{ id: 'netTreasury', desc: true }]
const columnHelper = createColumnHelper<SearchTableFeatures, INetProjectTreasury>()

function NetProjectTreasuries(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Net Treasury Rankings - Excl. Native Token - DefiLlama"
			description="Track DeFi protocol net treasury rankings - value of assets owned excluding native tokens. Compare protocol treasuries holding stables, ETH, BTC, and other assets across 500+ protocols. Real-time net treasury analytics."
			canonicalUrl="/net-project-treasury"
			pageName={pageName}
		>
			<SearchTableProvider
				options={{ data: props.protocols, columns, initialState: { sorting: DEFAULT_SORTING_STATE } }}
			>
				<Card padding="none">
					<PanelHeader>
						<PanelTitle as="h1" className="whitespace-nowrap">
							Protocol rankings
						</PanelTitle>
						<TableSearchInput columnId="name" placeholder="Search protocols…" width="inline" />
						<TableCsvExport filename="net-project-treasury" />
					</PanelHeader>
					<VirtualSearchTableView />
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

					<Logo size={24} src={row.original.logo} alt={`Logo of ${row.original.name}`} data-lgonly />

					<span className="-my-2 flex flex-col">
						<BasicLink
							href={`/protocol/treasury/${row.original.slug}`}
							className="truncate label-md text-link hover:underline"
						>
							{value}
						</BasicLink>
					</span>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(280px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.netTreasury ?? undefined, {
		id: 'netTreasury',
		header: 'Net Treasury',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end',
			headerHelperText: 'Value of tokens owned by a protocol, excluding its own token'
		}
	})
])

export default NetProjectTreasuries
