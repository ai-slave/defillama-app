import {
	columnFilteringFeature,
	type ColumnFiltersState,
	columnSizingFeature,
	createColumnHelper,
	createFilteredRowModel,
	filterFn_includesString,
	filterFn_inNumberRange,
	tableFeatures,
	useTable
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { BasicLink } from '~/components/Link'
import { UrlSelectWithCombobox } from '~/components/Select/UrlSelect'
import { columnVisibilityFeature } from '~/components/Table/features/display'
import { sortingFeatures } from '~/components/Table/features/sorting'
import { prepareTableCsv, useTableSearch } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { TokenLogo } from '~/components/TokenLogo'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { protocolCategoryConfig } from '~/containers/ProtocolTaxonomy/constants'
import { selectTopProtocolsView } from '~/containers/ProtocolTaxonomy/topProtocolsView'
import { TVL_SETTINGS_KEYS } from '~/contexts/LocalStorage'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { Panel } from '~/ui/Panel'
import { SearchField } from '~/ui/SearchField'
import { TableToolbar } from '~/ui/Toolbar'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const tableFeaturesConfig = tableFeatures({
	...sortingFeatures,
	columnVisibilityFeature,
	columnSizingFeature,
	columnFilteringFeature,
	filterFns: { includesString: filterFn_includesString, inNumberRange: filterFn_inNumberRange },
	filteredRowModel: createFilteredRowModel()
})

const excludeChainsStatic = new Set([...TVL_SETTINGS_KEYS, 'offers', 'dcAndLsOverlap', 'excludeParent'])
const excludeCategories = new Set(['Bridge', 'Canonical Bridge', 'Staking Pool'])

type TopProtocolsRow = {
	chain: string
} & Record<string, string | boolean | undefined>

const COLUMN_HELPER = createColumnHelper<typeof tableFeaturesConfig, TopProtocolsRow>()

export const getStaticProps = withPerformanceLogging('top-protocols', async () => {
	const { protocols, chains } = await fetchProtocols()
	const topProtocolPerChainAndCategory = {}

	for (const p of protocols) {
		const { chainTvls, category, name } = p
		if (excludeCategories.has(category)) {
			continue
		}
		for (const chain in chainTvls) {
			if (chain.includes('-') || excludeChainsStatic.has(chain)) {
				continue
			}
			const tvl = chainTvls[chain].tvl
			topProtocolPerChainAndCategory[chain] = topProtocolPerChainAndCategory[chain] ?? {}

			const currentTopProtocol = topProtocolPerChainAndCategory[chain][category]

			if (currentTopProtocol == null || tvl > currentTopProtocol[1]) {
				topProtocolPerChainAndCategory[chain][category] = [name, tvl, p.deprecated === true]
			}
		}
	}

	const data = []
	const uniqueCategories = new Set()

	for (const chain of chains) {
		const categories = topProtocolPerChainAndCategory[chain]
		const values = {}

		for (const cat in categories) {
			uniqueCategories.add(cat)
			values[cat] = categories[cat][0]
			values[`${cat}Deprecated`] = categories[cat][2]
		}
		data.push({ chain, ...values })
	}

	return {
		props: {
			data,
			chains: data.map((row) => row.chain),
			uniqueCategories: Array.from(uniqueCategories)
		},
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Top Protocols']

export default function TopProtocols({ data, chains, uniqueCategories }) {
	const router = useRouter()
	const { rows, columnVisibility } = React.useMemo(
		() => selectTopProtocolsView(data, chains, uniqueCategories, router.query),
		[data, chains, uniqueCategories, router.query]
	)

	const columns = React.useMemo(() => {
		const baseColumns = [
			COLUMN_HELPER.accessor('chain', {
				header: 'Chain',
				id: 'chain',
				enableSorting: false,
				cell: (info) => {
					const chain = info.getValue()
					return (
						<span className="flex items-center gap-2">
							<span className="vf-row-index shrink-0" aria-hidden="true" />
							<TokenLogo name={chain} kind="chain" alt={`Logo of ${chain}`} />
							<BasicLink href={`/chain/${slug(chain)}`} className="truncate label-md text-link hover:underline">
								{chain}
							</BasicLink>
						</span>
					)
				},
				meta: {
					headerClassName: 'w-[min(200px,40vw)]'
				}
			})
		]

		const categoryColumns = uniqueCategories.map((cat) =>
			COLUMN_HELPER.accessor((row) => row[cat], {
				id: cat,
				header: cat,
				enableSorting: false,
				cell: (info) => {
					const protocolName = info.getValue()
					if (typeof protocolName !== 'string' || !protocolName) return null
					const deprecated = info.row.original[`${cat}Deprecated`] === true
					return (
						<span className="flex items-center gap-1">
							<BasicLink href={`/protocol/${slug(protocolName)}`} className="label-md text-link hover:underline">
								{protocolName}
							</BasicLink>
							{deprecated ? <DeprecatedProtocolMarker /> : null}
						</span>
					)
				},
				meta: {
					headerClassName: 'w-[min(200px,40vw)]',
					headerHelperText: protocolCategoryConfig[cat as string]?.description ?? ''
				}
			})
		)

		return [...baseColumns, ...categoryColumns]
	}, [uniqueCategories])

	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

	const table = useTable({
		features: tableFeaturesConfig,
		data: rows,
		columns,
		state: {
			columnFilters,
			columnVisibility
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater))
	})

	const [searchValue, setSearchValue] = useTableSearch({ instance: table, columnToSearch: 'chain' })

	return (
		<Layout
			title="Top DeFi Protocols by Chain & Category - DefiLlama"
			description="Discover the top DeFi protocols on each blockchain by category. Compare lending, DEXs, yield, and derivatives protocols ranked by TVL across Ethereum, Solana, Base, Arbitrum, and 500+ chains."
			canonicalUrl="/top-protocols"
			pageName={pageName}
		>
			<Card padding="sm">
				<h1 className="heading-sm">Protocols with highest TVL by chain on each category</h1>
			</Card>
			<Panel>
				<TableToolbar>
					<SearchField
						label="Search chains"
						value={searchValue}
						onChange={setSearchValue}
						placeholder="Search chains…"
						width="standalone"
					/>

					<UrlSelectWithCombobox
						allValues={chains}
						includeQueryKey="chain"
						excludeQueryKey="excludeChain"
						nestedMenu={false}
						label="Chains"
						labelType="smol"
						variant="filter"
						size="md"
					/>
					<UrlSelectWithCombobox
						allValues={uniqueCategories}
						includeQueryKey="column"
						excludeQueryKey="excludeColumn"
						nestedMenu={false}
						label="Columns"
						labelType="smol"
						variant="filter"
						size="md"
					/>
					<CSVDownloadButton
						prepareCsv={() => prepareTableCsv({ instance: table, filename: 'top-protocols' })}
						smol
						size="md"
					/>
				</TableToolbar>
				<VirtualTable table={table} />
			</Panel>
		</Layout>
	)
}
