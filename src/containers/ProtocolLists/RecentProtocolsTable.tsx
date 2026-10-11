import { createColumnHelper, type ExpandedState, type SortingState, useTable } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { Bookmark } from '~/components/Bookmark'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { TVLRange } from '~/components/Filters/TVLRange'
import { BasicLink } from '~/components/Link'
import { ProtocolChainsHovercard } from '~/components/ProtocolChainsHovercard'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { expandedFilteredTableFeatures } from '~/components/Table/features/expandedFiltering'
import { TablePagesStatus } from '~/components/Table/TablePagesStatus'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { TokenLogo } from '~/components/TokenLogo'
import { removedCategoriesFromChainTvlSet } from '~/containers/ProtocolRankings/constants'
import { getCategoryRoute } from '~/containers/ProtocolTaxonomy/categoryRoutes'
import { RaisesTotal } from '~/containers/Raises/RaisesTotal'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { useTablePages } from '~/hooks/useTablePages'
import { Button } from '~/ui/Button'
import { Change } from '~/ui/Change'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles, searchFieldWrapperStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { RelativeTime } from '~/ui/RelativeTime'
import { SurfaceLoadingOverlay } from '~/ui/Status'
import { Switch } from '~/ui/Switch'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { downloadBlob } from '~/utils/download'
import { formatRatio, formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { ProtocolListInitialProps, ProtocolListPage, RecentProtocolTableRow } from './tableQuery'
import {
	protocolListRequestQuery,
	protocolListSignature,
	protocolListSort,
	protocolListSortQuery,
	protocolListUrl
} from './tableQuery'

const columnHelper = createColumnHelper<typeof expandedFilteredTableFeatures, RecentProtocolTableRow>()

export function RecentlyListedProtocolsTable({
	protocols,
	protocolList,
	kind,
	chainList,
	categories
}: ProtocolListInitialProps) {
	const router = useRouter()
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
	const [expanded, setExpanded] = React.useState<ExpandedState>({})
	const sorting: SortingState = [protocolListSort(router.query)]
	const nameSearch = typeof router.query.search === 'string' ? router.query.search : ''
	const search = useDebouncedValue(nameSearch, nameSearch ? 250 : 0)
	const query = protocolListRequestQuery(router.query, extraTvlsEnabled, search)
	const pages = useTablePages<RecentProtocolTableRow, ProtocolListPage>({
		mode: 'cursor',
		sourceKey: `${kind}:${protocolList.version}`,
		initialRows: protocols,
		initialPage: { ...protocolList, chainList, categories },
		querySignature: protocolListSignature(query),
		defaultQuerySignature: protocolListSignature({}),
		getRowKey: (row: RecentProtocolTableRow) => row.defillamaId,
		buildPageUrl: ({ version, cursor }) => protocolListUrl(kind, query, version, cursor)
	})
	const columns = kind === 'airdrops' ? airdropsColumns : recentlyListedProtocolsColumns
	const downloadCsv = async () => {
		const response = await fetch(protocolListUrl(kind, query, pages.version, null, true))
		if (!response.ok) throw new Error('Unable to export protocol list')
		downloadBlob(kind === 'airdrops' ? 'airdrops.csv' : 'protocols.csv', await response.blob())
	}

	const instance = useTable({
		features: expandedFilteredTableFeatures,
		data: pages.rows,
		columns,
		state: {
			sorting,
			expanded
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onExpandedChange: (updater) => React.startTransition(() => setExpanded(updater)),
		manualSorting: true,
		manualFiltering: true,
		onSortingChange: (updater) => {
			const next = typeof updater === 'function' ? updater(sorting) : updater
			void pushShallowQuery(router, protocolListSortQuery(next))
		}
	})

	return (
		<Panel>
			<TableToolbar>
				<label className={searchFieldWrapperStyles}>
					<span className="sr-only">Search protocols</span>
					<Icon name="search" className={searchFieldIconStyles} />
					<Input
						value={nameSearch}
						onChange={(e) => void pushShallowQuery(router, { search: e.currentTarget.value })}
						placeholder="Search protocols…"
						className={searchFieldInputPlacementStyles}
					/>
				</label>

				<HideForkedProtocols />
				<SelectWithCombobox
					label="Chains"
					allValues={pages.chainList}
					includeQueryKey="chain"
					excludeQueryKey="excludeChain"
					labelType="smol"
					variant="filter"
					size="md"
				/>
				{pages.categories.length > 0 ? (
					<SelectWithCombobox
						label="Category"
						allValues={pages.categories}
						includeQueryKey="category"
						excludeQueryKey="excludeCategory"
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				<TVLRange size="md" quickPicks={pages.tvlQuickPicks} />
				<CSVDownloadButton onClick={downloadCsv} isLoading={false} smol size="md" />
			</TableToolbar>
			<div className="relative">
				<VirtualTable table={instance} />
				{pages.isReplacing ? <SurfaceLoadingOverlay label="Updating protocols…" /> : null}
			</div>
			<TablePagesStatus {...pages} rowCount={pages.rows.length} noun="protocols" />
		</Panel>
	)
}

const whiteLabeledVaultProviders = new Set(['Veda'])

const protocolsColumns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()

			return (
				<span
					className="relative flex items-center gap-2"
					style={{ paddingLeft: row.depth ? row.depth * 48 : row.depth === 0 ? 24 : 0 }}
				>
					{row.subRows?.length > 0 ? (
						<Button
							size="sm"
							variant="ghost"
							square
							aria-expanded={row.getIsExpanded()}
							type="button"
							className="absolute -left-1.5"
							{...{
								onClick: row.getToggleExpandedHandler()
							}}
						>
							{row.getIsExpanded() ? (
								<>
									<Icon name="chevron-down" className="size-4 text-tertiary" />
									<span className="sr-only">Hide child protocols</span>
								</>
							) : (
								<>
									<Icon name="chevron-right" className="size-4 text-tertiary" />
									<span className="sr-only">View child protocols</span>
								</>
							)}
						</Button>
					) : (
						<Bookmark size="sm" readableName={value} className="absolute -left-1.5 hidden lg:flex" />
					)}

					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo src={row.original.logo} data-lgonly alt={`Logo of ${value}`} />

					<span className="-my-2 flex flex-col">
						{row.original?.deprecated ? (
							<BasicLink
								href={`/protocol/${slug(value)}`}
								className="flex items-center gap-1 truncate label-md text-link hover:underline"
							>
								<span className="truncate hover:underline">{value}</span>
								<DeprecatedProtocolMarker />
							</BasicLink>
						) : (
							<BasicLink href={`/protocol/${slug(value)}`} className="truncate label-md text-link hover:underline">
								{`${value}`}
							</BasicLink>
						)}

						<ProtocolChainsHovercard chains={row.original.chains} />
					</span>
					{value === 'SyncDEX Finance' ? (
						<Tooltip content="Many users have reported issues with this protocol">
							<Icon name="alert-triangle" className="size-3.5" />
						</Tooltip>
					) : null}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[180px] lg:w-[240px] xl:w-[200px]'
		}
	}),
	columnHelper.accessor('category', {
		header: 'Category',
		cell: ({ getValue }) => {
			const value = getValue()
			return value ? (
				<BasicLink
					href={getCategoryRoute(slug(value))}
					className="label-md whitespace-nowrap text-link hover:underline"
				>
					{value}
				</BasicLink>
			) : (
				''
			)
		},
		meta: {
			headerClassName: 'w-[140px]'
		}
	}),
	columnHelper.accessor((row) => row.tvl ?? undefined, {
		id: 'tvl',
		header: 'TVL',
		cell: ({ getValue, row }) => <ProtocolTvlCell value={getValue()} rowValues={row.original} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: 'Sum of value of all coins held in smart contracts of the protocol'
		}
	}),
	columnHelper.accessor((row) => row.change_1d ?? undefined, {
		id: 'change_1d',
		header: '1d TVL Change',
		cell: ({ getValue }) => <Change value={getValue()} />,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Change in TVL in the last 24 hours'
		}
	}),
	columnHelper.accessor((row) => row.change_7d ?? undefined, {
		id: 'change_7d',
		header: '7d TVL Change',
		cell: ({ getValue }) => <Change value={getValue()} />,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Change in TVL in the last 7 days'
		}
	}),
	columnHelper.accessor((row) => row.change_1m ?? undefined, {
		id: 'change_1m',
		header: '1m TVL Change',
		cell: ({ getValue }) => <Change value={getValue()} />,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Change in TVL in the last 30 days'
		}
	}),
	columnHelper.accessor((row) => row.mcaptvl ?? undefined, {
		id: 'mcaptvl',
		header: 'Mcap/TVL',
		cell: (info) => <>{formatRatio(info.getValue())}</>,
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end',
			headerHelperText: 'Market cap / TVL ratio'
		}
	})
])
type ProtocolTvlRow = RecentProtocolTableRow & {
	strikeTvl?: boolean
	parentExcluded?: boolean
	isParentProtocol?: boolean
}

function ProtocolTvlCell({ value, rowValues }: { value: unknown; rowValues: ProtocolTvlRow }) {
	const tvlValue = typeof value === 'number' ? value : null

	let text: string | null = null

	if (rowValues.strikeTvl) {
		text = 'This protocol is excluded from chain TVL to avoid double counting'

		if (whiteLabeledVaultProviders.has(rowValues.name)) {
			text =
				'This protocol issues white-labeled vaults which may result in TVL being counted by another protocol (e.g., double counted).'
		}

		if (rowValues.category && removedCategoriesFromChainTvlSet.has(rowValues.category)) {
			text = `${rowValues.category} protocols are not counted into Chain TVL`
		}

		if (text && rowValues.isParentProtocol) {
			text = 'Some sub-protocols are excluded from chain tvl'
		}
	}

	if (!text && !rowValues.parentExcluded) {
		return (
			<>
				{tvlValue != null
					? formatUsd(tvlValue, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					: null}
			</>
		)
	}

	return (
		<span className="flex items-center justify-end gap-1">
			{text ? <QuestionHelper text={text} /> : null}
			{rowValues.parentExcluded ? (
				<QuestionHelper text="There's some internal doublecounting that is excluded from parent TVL, so sum won't match" />
			) : null}
			<span
				style={{
					color: rowValues.strikeTvl ? 'var(--color-tertiary)' : 'inherit'
				}}
			>
				{tvlValue != null
					? formatUsd(tvlValue, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					: null}
			</span>
		</span>
	)
}

const listedAtColumn = columnHelper.accessor((row) => row.listedAt ?? undefined, {
	id: 'listedAt',
	header: 'Listed At',
	cell: ({ getValue }) => {
		const listedAt = getValue()
		return listedAt != null ? <RelativeTime value={listedAt} input="seconds" /> : null
	},
	meta: {
		headerClassName: 'w-[120px]',
		align: 'end'
	}
})

const recentlyListedProtocolsColumns = [
	...protocolsColumns.slice(0, 3),
	listedAtColumn,
	...protocolsColumns.slice(3, -1)
]

const airdropsColumns = columnHelper.columns([
	...protocolsColumns.slice(0, 3),
	columnHelper.accessor((row) => row.raiseSummary?.totalUsd ?? undefined, {
		id: 'totalRaised',
		header: 'Total Money Raised',
		cell: ({ row }) => (row.original.raiseSummary ? <RaisesTotal {...row.original.raiseSummary} /> : null),
		meta: {
			headerClassName: 'w-[168px]',
			align: 'end'
		}
	}),
	listedAtColumn,
	...protocolsColumns.slice(3, -1)
])

function HideForkedProtocols() {
	const router = useRouter()

	const { hideForks } = router.query

	const toHide = !(hideForks && typeof hideForks === 'string' && hideForks === 'true')

	const hide = () => {
		void pushShallowQuery(router, { hideForks: toHide })
	}
	return <Switch label="Hide Forked Protocols" value="hideForks" checked={!toHide} onChange={hide} />
}
