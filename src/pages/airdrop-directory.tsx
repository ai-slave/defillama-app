import { createColumnHelper } from '@tanstack/react-table'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { getAirdropDirectoryData } from '~/containers/ProtocolLists/queries'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { PanelTitle, PanelHeader } from '~/ui/Panel'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const DEFAULT_SORTING_STATE = [{ id: 'name', desc: true }]

interface IAirdropRow {
	name: string
	page: string
}

const columnHelper = createColumnHelper<SearchTableFeatures, IAirdropRow>()

const columns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[120px]'
		}
	}),
	columnHelper.accessor('page', {
		header: 'Claim Page',
		meta: {
			headerClassName: 'w-[100px]'
		},
		enableSorting: false,
		cell: ({ getValue }) =>
			getValue() ? (
				<a
					href={getValue()}
					target="_blank"
					rel="noopener noreferrer"
					className="flex shrink-0 items-center justify-center rounded-md bg-brand-muted p-1.5 hover:bg-(--interim-brand-tint-hover)"
				>
					<Icon name="arrow-up-right" height={14} width={14} />
					<span className="sr-only">open in new tab</span>
				</a>
			) : null
	})
])

export const getStaticProps = withPerformanceLogging('airdrop-directory', async () => {
	const airdrops = await getAirdropDirectoryData()

	return {
		props: { airdrops },
		revalidate: maxAgeForNext([22])
	}
})

export default function Airdrops({ airdrops }) {
	return (
		<Layout
			title="Crypto Airdrop Directory - DeFi Airdrops - DefiLlama"
			description="Browse upcoming and past crypto airdrops across DeFi protocols on DefiLlama."
			canonicalUrl="/airdrop-directory"
		>
			<SearchTableProvider options={{ data: airdrops, columns, initialState: { sorting: DEFAULT_SORTING_STATE } }}>
				<Card padding="none">
					<PanelHeader className="w-full justify-end">
						<PanelTitle as="h1" className="whitespace-nowrap">
							Airdrop Directory
						</PanelTitle>
						<TableSearchInput
							columnId="name"
							placeholder="Search Airdrop..."
							className={searchFieldInlineWrapperStyles}
						/>
						<TableCsvExport filename="airdrop-directory" />
					</PanelHeader>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</Layout>
	)
}
