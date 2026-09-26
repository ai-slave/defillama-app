import { type ColumnDef, createColumnHelper, type SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { BasicLink } from '~/components/Link'
import { ProtocolChainsHovercard } from '~/components/ProtocolChainsHovercard'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { readSelectionFromQuery } from '~/components/Select/query'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { getCategoryRoute } from '~/containers/ProtocolTaxonomy/categoryRoutes'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { TableToolbar } from '~/ui/Toolbar'
import { slug } from '~/utils'
import { formatUsd } from '~/utils/numberFormat'
import type { IProtocolsWithTokensByChainPageData, ITokenMetricProtocolRow, TokenMetricType } from './types'

const chainLikeCategories = new Set(['Chain', 'Rollup'])

export function ProtocolsWithTokens(props: IProtocolsWithTokensByChainPageData) {
	const router = useRouter()

	const protocols = useMemo(() => {
		if (props.categories.length === 0) return props.protocols
		const selectedCategories = readSelectionFromQuery(router.query, 'category', 'excludeCategory', props.categories)
		return selectedCategories.length === 0 ? [] : getProtocolsByCategory(props.protocols, selectedCategories)
	}, [router.query, props.categories, props.protocols])

	const { columns, sortingState } = getMetricNameAndColumns(props.type)

	return (
		<>
			<RowLinksWithDropdown links={props.chains} activeLink={props.chain} />
			<SearchTableProvider
				options={{
					data: protocols,
					columns,
					initialState: { sorting: sortingState },
					getSubRows: (row) => row.subRows
				}}
			>
				<Card padding="none">
					<TableToolbar className="w-full justify-end">
						<TableSearchInput columnId="name" placeholder="Search protocols..." />
						{props.categories.length > 0 ? (
							<SelectWithCombobox
								allValues={props.categories}
								includeQueryKey="category"
								excludeQueryKey="excludeCategory"
								nestedMenu={false}
								label="Category"
								labelType="smol"
								variant="filter-responsive"
								size="md"
							/>
						) : null}
						<TableCsvExport filename={`protocols-with-tokens-${props.type}-${props.chain}`} />
					</TableToolbar>
					<VirtualSearchTableView compact />
				</Card>
			</SearchTableProvider>
		</>
	)
}

function getProtocolsByCategory(
	protocols: IProtocolsWithTokensByChainPageData['protocols'],
	categoriesToFilter: Array<string>
): Array<ITokenMetricProtocolRow> {
	const final: Array<ITokenMetricProtocolRow> = []
	const categoriesToFilterSet = new Set(categoriesToFilter)

	for (const protocol of protocols) {
		if (protocol.subRows) {
			const childProtocols = protocol.subRows.filter((childProtocol) =>
				categoriesToFilterSet.has(childProtocol.category ?? '')
			)

			if (childProtocols.length > 0) {
				final.push({
					...protocol,
					subRows: childProtocols
				})
			}

			continue
		}

		if (categoriesToFilterSet.has(protocol.category ?? '')) {
			final.push(protocol)
			continue
		}
	}

	return final
}

const chainChartsKeys: Partial<Record<TokenMetricType, string>> = {
	mcap: 'chainTokenMcap',
	price: 'chainTokenPrice',
	fdv: 'chainTokenFdv'
}

const protocolChartsKeys: Partial<Record<TokenMetricType, string>> = {
	mcap: 'mcap',
	price: 'price',
	fdv: 'fdv'
}

const columnHelper = createColumnHelper<SearchTableFeatures, ITokenMetricProtocolRow>()

function defaultColumns(type: TokenMetricType) {
	return columnHelper.columns([
		columnHelper.accessor('name', {
			header: 'Name',
			enableSorting: false,
			cell: ({ getValue, row }) => {
				const value = getValue()

				const basePath = chainLikeCategories.has(row.original.category ?? '') ? 'chain' : 'protocol'
				const chartKey =
					(chainLikeCategories.has(row.original.category ?? '') ? chainChartsKeys[type] : protocolChartsKeys[type]) ??
					null
				const chartQuery = chartKey ? `?tvl=false&events=false&${chartKey}=true` : ''

				return (
					<span className={`relative flex items-center gap-2 ${row.depth > 0 ? 'pl-6' : 'pl-0'}`}>
						{row.subRows?.length > 0 ? (
							<button
								type="button"
								className="absolute -left-4.5"
								{...{
									onClick: row.getToggleExpandedHandler()
								}}
							>
								{row.getIsExpanded() ? (
									<>
										<Icon name="chevron-down" height={16} width={16} className="text-tertiary" />
										<span className="sr-only">Hide child protocols</span>
									</>
								) : (
									<>
										<Icon name="chevron-right" height={16} width={16} className="text-tertiary" />
										<span className="sr-only">View child protocols</span>
									</>
								)}
							</button>
						) : null}
						<span className="vf-row-index shrink-0" aria-hidden="true" />

						<TokenLogo src={row.original.logo} data-lgonly alt={`Logo of ${row.original.name}`} />

						{row.original.chains.length > 0 ? (
							<span className="-my-2 flex flex-col">
								<span className="flex items-center gap-1 overflow-hidden">
									<BasicLink
										href={`/${basePath}/${row.original.slug}${chartQuery}`}
										className="min-w-0 truncate text-sm font-medium text-link hover:underline"
									>
										{value}
									</BasicLink>
									{row.original.deprecated ? <DeprecatedProtocolMarker /> : null}
								</span>

								<ProtocolChainsHovercard chains={row.original.chains} />
							</span>
						) : (
							<span className="flex items-center gap-1 overflow-hidden">
								<BasicLink
									href={`/${basePath}/${row.original.slug}${chartQuery}`}
									className="min-w-0 truncate text-sm font-medium text-link hover:underline"
								>
									{value}
								</BasicLink>
								{row.original.deprecated ? <DeprecatedProtocolMarker /> : null}
							</span>
						)}
					</span>
				)
			},
			meta: {
				headerClassName: 'w-[min(280px,40vw)]'
			}
		}),
		columnHelper.accessor('category', {
			header: 'Category',
			enableSorting: false,
			cell: ({ getValue }) => {
				const value = getValue()
				if (!value) return null
				return (
					<BasicLink href={getCategoryRoute(slug(value))} className="text-sm font-medium text-link">
						{value}
					</BasicLink>
				)
			},
			meta: {
				headerClassName: 'w-[128px]',
				align: 'end'
			}
		})
	])
}

const mcapColumns = columnHelper.columns([
	...defaultColumns('mcap'),
	columnHelper.accessor((row) => row.value ?? undefined, {
		id: 'mcap',
		header: 'Market Cap',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end'
		}
	})
])

const fdvColumns = columnHelper.columns([
	...defaultColumns('fdv'),
	columnHelper.accessor((row) => row.value ?? undefined, {
		id: 'fdv',
		header: 'FDV',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end'
		}
	})
])

const priceColumns = columnHelper.columns([
	...defaultColumns('price'),
	columnHelper.accessor((row) => row.value ?? undefined, {
		id: 'price',
		header: 'Token Price',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end'
		}
	})
])

const outstandingFdvColumns = columnHelper.columns([
	...defaultColumns('outstanding-fdv'),
	columnHelper.accessor((row) => row.value ?? undefined, {
		id: 'outstanding-fdv',
		header: 'Outstanding FDV',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end',
			headerHelperText:
				'Token price multiplied by outstanding supply.\n\nOutstanding supply is the total supply minus the supply that is not yet allocated to anything (eg coins in treasury or reserve).'
		}
	})
])

function getMetricNameAndColumns(type: TokenMetricType): {
	columns: Array<ColumnDef<SearchTableFeatures, ITokenMetricProtocolRow>>
	sortingState: SortingState
} {
	switch (type) {
		case 'mcap':
			return { columns: mcapColumns, sortingState: [{ id: 'mcap', desc: true }] }
		case 'price':
			return { columns: priceColumns, sortingState: [{ id: 'price', desc: true }] }
		case 'fdv':
			return { columns: fdvColumns, sortingState: [{ id: 'fdv', desc: true }] }
		case 'outstanding-fdv':
			return { columns: outstandingFdvColumns, sortingState: [{ id: 'outstanding-fdv', desc: true }] }
		default:
			return { columns: [], sortingState: [] }
	}
}
