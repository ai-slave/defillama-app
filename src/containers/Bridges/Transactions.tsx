import { useMutation } from '@tanstack/react-query'
import {
	createColumnHelper,
	createPaginatedRowModel,
	globalFilteringFeature,
	rowPaginationFeature,
	type SortingState,
	tableFeatures,
	useTable
} from '@tanstack/react-table'
import * as React from 'react'
import { useBlockExplorers } from '~/api/client'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { filteredTableFeatures } from '~/components/Table/features/filtering'
import { TablePager } from '~/components/Table/TablePager'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { TokenLogo } from '~/components/TokenLogo'
import { dateRangeErrors, useDateRangeValidation } from '~/hooks/useDateRangeValidation'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldInlineWrapperStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { SearchField } from '~/ui/SearchField'
import { EmptyState, InlineStatus, PanelLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { httpErrorMessage } from '~/utils/async'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { formatDate, formatDateTime } from '~/utils/dateFormat'
import { formatCompactNumber, formatUsd } from '~/utils/numberFormat'
import { fetchBridgeTransactionsClient } from './api'
import type { RawBridgeInfo, RawBridgeTransaction } from './api.types'

const tableFeaturesConfig = tableFeatures({
	...filteredTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel(),
	globalFilteringFeature
})

export type BridgeTransaction = RawBridgeTransaction

const MAX_TRANSACTION_PAGES = 50

export interface TransformedTransaction {
	timestamp: number
	bridge_name: string
	bridge_slug: string
	chain: string
	is_deposit: boolean
	token: string
	amount: string
	usd_value: number | null
	tx_from: string
	tx_to: string
	tx_hash: string
}

type BridgeTransactionSearchIndex = WeakMap<TransformedTransaction, string>

export function createBridgeTransactionSearchIndex(rows: Array<TransformedTransaction>): BridgeTransactionSearchIndex {
	const index: BridgeTransactionSearchIndex = new WeakMap()
	for (const row of rows) {
		index.set(
			row,
			`${row.timestamp}\0${row.bridge_name}\0${row.chain}\0${row.token}\0${row.amount}\0${row.usd_value ?? ''}\0${row.tx_from}\0${row.tx_to}\0${row.tx_hash}`.toLowerCase()
		)
	}
	return index
}

export function matchesBridgeTransactionSearch(
	row: TransformedTransaction,
	searchIndex: BridgeTransactionSearchIndex,
	normalizedSearchValue: string
): boolean {
	return searchIndex.get(row)!.includes(normalizedSearchValue)
}

export interface BridgeTransactionStats {
	total: number
	deposits: number
	withdrawals: number
	depositVolume: number
	withdrawalVolume: number
	totalVolume: number
	unknownValueCount: number
	uniqueChains: number
}

export interface BridgeTransactionResult {
	rows: Array<TransformedTransaction>
	stats: BridgeTransactionStats | null
	truncated: boolean
}

interface BridgeTransactionRange {
	startTimestamp: number
	endTimestamp: number
}

const parseTransactionTimestamp = (timestamp: string): number => Math.floor(Date.parse(timestamp) / 1000)

const buildBridgeTransactionRow = (tx: BridgeTransaction, timestamp: number): TransformedTransaction => {
	return {
		timestamp,
		bridge_name: tx.bridge_name,
		bridge_slug: slug(tx.bridge_name ?? ''),
		chain: tx.chain,
		is_deposit: tx.is_deposit,
		token: tx.token,
		amount: tx.amount,
		usd_value: tx.usd_value === null ? null : Number(tx.usd_value),
		tx_from: tx.tx_from,
		tx_to: tx.tx_to,
		tx_hash: tx.tx_hash
	}
}

export const createBridgeTransactionCollector = ({ startTimestamp, endTimestamp }: BridgeTransactionRange) => {
	const rows: Array<TransformedTransaction> = []
	const uniqueChains = new Set<string>()
	let previousAcceptedTimestamp = Number.POSITIVE_INFINITY
	let isDescending = true
	let deposits = 0
	let withdrawals = 0
	let depositVolume = 0
	let withdrawalVolume = 0
	let unknownValueCount = 0

	return {
		addPage(transactions: Array<BridgeTransaction>): void {
			for (const tx of transactions) {
				const timestamp = parseTransactionTimestamp(tx.ts)
				if (timestamp < startTimestamp || timestamp >= endTimestamp) continue

				const row = buildBridgeTransactionRow(tx, timestamp)
				if (timestamp > previousAcceptedTimestamp) isDescending = false
				previousAcceptedTimestamp = timestamp
				rows.push(row)
				uniqueChains.add(row.chain)
				if (row.is_deposit) {
					deposits++
					if (row.usd_value === null) unknownValueCount++
					else depositVolume += row.usd_value
				} else {
					withdrawals++
					if (row.usd_value === null) unknownValueCount++
					else withdrawalVolume += row.usd_value
				}
			}
		},
		finish(truncated: boolean): BridgeTransactionResult {
			if (!isDescending) {
				// Array sorting is stable, so equal timestamps retain API encounter order as before.
				rows.sort((left, right) => right.timestamp - left.timestamp)
			}
			return {
				rows,
				truncated,
				stats:
					rows.length === 0
						? null
						: {
								total: rows.length,
								deposits,
								withdrawals,
								depositVolume,
								withdrawalVolume,
								totalVolume: depositVolume + withdrawalVolume,
								unknownValueCount,
								uniqueChains: uniqueChains.size
							}
			}
		}
	}
}

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, TransformedTransaction>()

const truncateMiddle = (value: string, lead = 6, tail = 4) => {
	if (!value) return ''
	if (value.length <= lead + tail + 1) return value
	return `${value.slice(0, lead)}…${value.slice(-tail)}`
}

const buildBridgeColumns = (blockExplorersData: ReturnType<typeof useBlockExplorers>['data']) =>
	columnHelper.columns([
		columnHelper.accessor((row) => row.timestamp ?? undefined, {
			id: 'timestamp',
			header: 'Timestamp',
			cell: ({ getValue }) => (
				<span className="whitespace-nowrap text-secondary">
					{formatDateTime(getValue(), { input: 'seconds', timeZone: 'UTC' }) ?? '–'}
				</span>
			),
			meta: {
				headerClassName: 'w-[220px]'
			}
		}),
		columnHelper.accessor('bridge_name', {
			header: 'Bridge',
			cell: ({ row }) => (
				<BasicLink href={`/bridge/${row.original.bridge_slug}`} className="font-medium text-link hover:underline">
					{row.original.bridge_name}
				</BasicLink>
			),
			meta: {
				headerClassName: 'w-[160px]'
			}
		}),
		columnHelper.accessor('chain', {
			header: 'Chain',
			cell: ({ getValue }) => (
				<span className="inline-flex items-center gap-1.5">
					<TokenLogo name={getValue()} kind="chain" size={16} />
					<span>{getValue()}</span>
				</span>
			),
			meta: {
				headerClassName: 'w-[140px]'
			}
		}),
		columnHelper.accessor('is_deposit', {
			header: 'Direction',
			cell: ({ getValue }) => {
				const deposit = getValue()
				return (
					<span
						className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 label-sm ${
							deposit ? 'bg-data-up-tint text-data-up' : 'bg-data-down-tint text-data-down'
						}`}
					>
						<Icon name={deposit ? 'arrow-down' : 'arrow-up-right'} className="size-3" />
						{deposit ? 'Deposit' : 'Withdrawal'}
					</span>
				)
			},
			meta: {
				headerClassName: 'w-[130px]'
			}
		}),
		columnHelper.accessor('token', {
			header: 'Token',
			cell: ({ getValue, row }) => {
				const value = getValue() ?? ''
				if (!value) return <span className="text-tertiary">—</span>

				const looksLikeAddress = /^0x[0-9a-fA-F]{4,}$/.test(value) || value.includes(':')
				const explorer = looksLikeAddress
					? getBlockExplorerNew({
							apiResponse: blockExplorersData ?? [],
							address: value,
							chainName: row.original.chain,
							urlType: 'token'
						})
					: null

				if (!explorer) {
					return (
						<span className="mono-sm text-secondary" title={value}>
							{truncateMiddle(value, 8, 4)}
						</span>
					)
				}
				return (
					<Tooltip
						content={<span className="break-all">{value}</span>}
						render={
							<a
								href={explorer.url}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 mono-sm text-link hover:underline"
							/>
						}
					>
						{truncateMiddle(value, 8, 4)}
						<Icon name="external-link" className="size-3.5" />
					</Tooltip>
				)
			},
			meta: {
				headerClassName: 'w-[140px]'
			}
		}),
		columnHelper.accessor((row) => row.amount ?? undefined, {
			id: 'amount',
			header: 'Amount',
			cell: ({ getValue }) => (
				<span className="block max-w-[120px] truncate text-right" title={getValue()}>
					{getValue()}
				</span>
			),
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end' as const
			}
		}),
		columnHelper.accessor((row) => row.usd_value ?? undefined, {
			id: 'usd_value',
			header: 'USD Value',
			cell: ({ getValue }) => {
				const value = getValue()
				if (value == null) return <span className="text-tertiary">—</span>
				return (
					<span className="font-medium">
						{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
					</span>
				)
			},
			meta: {
				headerClassName: 'w-[130px]',
				align: 'end' as const
			}
		}),
		columnHelper.accessor('tx_from', {
			header: 'From',
			cell: ({ getValue, row }) => {
				const value = getValue()
				if (!value) return <span className="text-tertiary">—</span>
				const explorer = getBlockExplorerNew({
					apiResponse: blockExplorersData ?? [],
					address: value,
					chainName: row.original.chain,
					urlType: 'address'
				})
				const display = <span className="mono-sm">{truncateMiddle(value)}</span>
				if (!explorer) return display
				return (
					<Tooltip
						content={<span className="break-all">{value}</span>}
						render={
							<a
								href={explorer.url}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-link hover:underline"
							/>
						}
					>
						{display}
						<Icon name="external-link" className="size-3.5" />
					</Tooltip>
				)
			},
			meta: {
				headerClassName: 'w-[160px]'
			}
		}),
		columnHelper.accessor('tx_to', {
			header: 'To',
			cell: ({ getValue, row }) => {
				const value = getValue()
				if (!value) return <span className="text-tertiary">—</span>
				const explorer = getBlockExplorerNew({
					apiResponse: blockExplorersData ?? [],
					address: value,
					chainName: row.original.chain,
					urlType: 'address'
				})
				const display = <span className="mono-sm">{truncateMiddle(value)}</span>
				if (!explorer) return display
				return (
					<Tooltip
						content={<span className="break-all">{value}</span>}
						render={
							<a
								href={explorer.url}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-link hover:underline"
							/>
						}
					>
						{display}
						<Icon name="external-link" className="size-3.5" />
					</Tooltip>
				)
			},
			meta: {
				headerClassName: 'w-[160px]'
			}
		}),
		columnHelper.accessor('tx_hash', {
			header: 'Transaction',
			cell: ({ getValue, row }) => {
				const value = getValue()
				if (!value) return <span className="text-tertiary">—</span>
				const explorer = getBlockExplorerNew({
					apiResponse: blockExplorersData ?? [],
					address: value,
					chainName: row.original.chain,
					urlType: 'tx'
				})
				if (!explorer) {
					return (
						<span className="mono-sm" title={value}>
							{truncateMiddle(value)}
						</span>
					)
				}
				return (
					<Tooltip
						content={<span className="break-all">{value}</span>}
						render={
							<a
								href={explorer.url}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-link hover:underline"
							/>
						}
					>
						<span className="mono-sm">{truncateMiddle(value)}</span>
						<Icon name="external-link" className="size-3.5" />
					</Tooltip>
				)
			},
			meta: {
				headerClassName: 'w-[170px]'
			}
		})
	])

interface FetchArgs {
	bridge: Pick<RawBridgeInfo, 'id' | 'displayName'>
	startDate: string
	endDate: string
}

export const fetchTransactions = async ({ bridge, startDate, endDate }: FetchArgs) => {
	const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000)
	const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000) + 86_400

	if (startTimestamp >= endTimestamp) {
		throw new Error('Invalid date range')
	}

	const collector = createBridgeTransactionCollector({ startTimestamp, endTimestamp })
	let cursor: string | undefined

	for (let page = 0; page < MAX_TRANSACTION_PAGES; page++) {
		const response = await fetchBridgeTransactionsClient(bridge.id, startTimestamp, endTimestamp, cursor)
		collector.addPage(response.rows)

		if (!response.hasMore) {
			return collector.finish(false)
		}
		if (!response.nextCursor) {
			throw new Error('Bridge transactions response is missing its continuation cursor')
		}
		cursor = response.nextCursor
	}

	return collector.finish(true)
}

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10)

/** The month up to the page clock, in UTC so the server and every visitor seed the same days. */
export function getDefaultBridgeTransactionRange(nowSec: number): { startDate: string; endDate: string } {
	const end = new Date(nowSec * 1000)
	const start = new Date(end)
	start.setUTCMonth(end.getUTCMonth() - 1)
	return { startDate: toDateOnly(start), endDate: toDateOnly(end) }
}

export function BridgeTransactionsPage({ bridges }: { bridges: Array<RawBridgeInfo> }) {
	const nowSec = useNowSeconds()
	const defaultRange = getDefaultBridgeTransactionRange(nowSec)

	const [transactionResult, setTransactionResult] = React.useState<BridgeTransactionResult>({
		rows: [],
		stats: null,
		truncated: false
	})
	const [fetchedContext, setFetchedContext] = React.useState<{
		startDate: string
		endDate: string
		bridgeName: string
	} | null>(null)
	const [selectedBridgeId, setSelectedBridgeId] = React.useState<Array<string>>([])

	// The last failed fetch, kept while a retry runs: the mutation clears its own error when the retry starts.
	const [fetchFailure, setFetchFailure] = React.useState<string | null>(null)

	const { mutate, isPending } = useMutation({
		mutationFn: fetchTransactions,
		onError: (error) => setFetchFailure(httpErrorMessage(error, "Couldn't load bridge transactions.")),
		onSuccess: (data, variables) => {
			setFetchFailure(null)
			setTransactionResult(data)
			setFetchedContext({
				startDate: variables.startDate,
				endDate: variables.endDate,
				bridgeName: variables.bridge.displayName
			})
		}
	})

	const { startDate, endDate, handleStartDateChange, handleEndDateChange } = useDateRangeValidation({
		defaultStartDate: defaultRange.startDate,
		defaultEndDate: defaultRange.endDate
	})
	const [submitted, setSubmitted] = React.useState(false)

	const { data: blockExplorersData } = useBlockExplorers()

	const bridgeOptions = React.useMemo(
		() =>
			[...bridges]
				.sort((a, b) => (b.last24hVolume ?? 0) - (a.last24hVolume ?? 0))
				.map((bridge) => ({ key: String(bridge.id), name: bridge.displayName })),
		[bridges]
	)
	const selectedBridge = bridges.find((bridge) => String(bridge.id) === selectedBridgeId[0])

	const maxDate = toDateOnly(new Date(nowSec * 1000))
	const dateErrors = dateRangeErrors(startDate, endDate, maxDate)

	const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (!selectedBridge || dateErrors.startDate || dateErrors.endDate) {
			return showFieldErrors(e.currentTarget, () => setSubmitted(true))
		}
		mutate({
			startDate,
			endDate,
			bridge: selectedBridge
		})
	}

	const tableData = transactionResult.rows
	const columns = React.useMemo(() => buildBridgeColumns(blockExplorersData), [blockExplorersData])
	const stats = transactionResult.stats

	const csvFileName = fetchedContext
		? `bridge-transactions_${slug(fetchedContext.bridgeName)}_${fetchedContext.startDate}_${fetchedContext.endDate}${transactionResult.truncated ? '_newest-loaded-truncated' : ''}`
		: `bridge-transactions_${startDate}_${endDate}`

	const showEmpty = tableData.length === 0 && !isPending

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-2">
				<h1 className="heading-sm">Bridge Transactions</h1>
				<p className="max-w-2xl body-sm text-secondary">
					Download cross-chain bridge transaction data by protocol and time window. Results include deposits,
					withdrawals, USD value, and explorer links — exportable as CSV.
				</p>
			</header>

			{/* From md the fields share subgrid rows (label, control, error), so an error under one field never moves the
			    controls beside it. */}
			<Card
				padding="md"
				as="form"
				noValidate
				onSubmit={handleSubmit}
				className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(240px,1.4fr)_repeat(2,minmax(150px,1fr))_auto] md:grid-rows-[auto_auto_auto] md:gap-y-1"
			>
				<Field
					label="Bridge"
					error={submitted && !selectedBridge ? 'Choose a bridge.' : null}
					className="md:row-span-3 md:grid md:grid-rows-subgrid"
				>
					{(control) => (
						<SelectWithCombobox
							heading="Bridge"
							allValues={bridgeOptions}
							selectedValues={selectedBridgeId}
							setSelectedValues={setSelectedBridgeId}
							singleSelect
							label={selectedBridge?.displayName ?? 'Select a bridge'}
							labelType="none"
							variant="filter"
							size="md"
							className="w-full"
							triggerProps={control}
						/>
					)}
				</Field>
				<Field
					label="Start Date"
					error={submitted ? dateErrors.startDate : null}
					className="md:row-span-3 md:grid md:grid-rows-subgrid"
				>
					{(control) => (
						<Input
							{...control}
							type="date"
							name="startDate"
							value={startDate}
							onChange={(e) => handleStartDateChange(e.target.value)}
							max={maxDate}
							required
							className="cursor-pointer"
						/>
					)}
				</Field>
				<Field
					label="End Date"
					error={submitted ? dateErrors.endDate : null}
					className="md:row-span-3 md:grid md:grid-rows-subgrid"
				>
					{(control) => (
						<Input
							{...control}
							type="date"
							name="endDate"
							value={endDate}
							onChange={(e) => handleEndDateChange(e.target.value)}
							min={startDate}
							max={maxDate}
							required
							className="cursor-pointer"
						/>
					)}
				</Field>
				<Button
					type="submit"
					variant="primary"
					size="md"
					pendingLabel="Fetching…"
					pending={isPending}
					className="md:col-start-4 md:row-start-2"
				>
					<Icon name="search" className="size-3.5" />
					Fetch Transactions
				</Button>

				{fetchFailure ? (
					<div className="col-span-full md:mt-3">
						<InlineStatus variant="error">{fetchFailure}</InlineStatus>
					</div>
				) : null}
			</Card>

			{isPending ? (
				<PanelLoadingStatus label="Fetching transactions, large ranges take longer" className="min-h-[200px]" />
			) : null}

			{!isPending && stats && fetchedContext ? (
				<div className="flex flex-col gap-4">
					<div className="flex flex-wrap items-center gap-2 label-sm text-secondary">
						<span className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-surface px-2.5 py-1 font-medium text-primary">
							{fetchedContext.bridgeName}
						</span>
						<span className="text-tertiary">
							{formatDate(fetchedContext.startDate)} → {formatDate(fetchedContext.endDate)}
						</span>
						<span className="text-tertiary">
							· {stats.uniqueChains} chain{stats.uniqueChains === 1 ? '' : 's'}
						</span>
					</div>

					<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
						<StatTile
							label="Transactions"
							value={formatCompactNumber(stats.total, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
							sub={stats.unknownValueCount > 0 ? `${stats.unknownValueCount} without USD value` : undefined}
						/>
						<StatTile
							label="Total Volume"
							value={formatUsd(stats.totalVolume, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
							sub="USD, priced rows only"
						/>
						<StatTile
							label="Deposits"
							value={formatCompactNumber(stats.deposits, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
							sub={formatUsd(stats.depositVolume, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
						<StatTile
							label="Withdrawals"
							value={formatCompactNumber(stats.withdrawals, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
							sub={formatUsd(stats.withdrawalVolume, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
					</div>
				</div>
			) : null}

			{!isPending && transactionResult.truncated ? (
				<InlineStatus variant="warning">
					Results reached the 50-page limit. Counts, statistics, table rows, and CSV cover the newest loaded
					transactions only. Narrow the date range for a complete result.
				</InlineStatus>
			) : null}

			{!isPending && tableData.length > 0 ? (
				<TransactionsTable
					data={tableData}
					columns={columns}
					csvFileName={csvFileName}
					truncated={transactionResult.truncated}
				/>
			) : null}

			{showEmpty ? (
				<EmptyState
					size="md"
					framed
					icon={fetchedContext ? 'search' : 'activity'}
					title={fetchedContext ? 'No transactions in this range' : 'Explore bridge transaction data'}
					className="min-h-[240px]"
				>
					{fetchedContext
						? 'Try a wider date range or a different bridge. Transactions may be sparse for smaller bridges or short windows.'
						: 'Pick a bridge and a date range, then fetch transactions. Results can be filtered, sorted, and exported as CSV.'}
				</EmptyState>
			) : null}
		</div>
	)
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500] as const
const DEFAULT_PAGE_SIZE = 100

type BridgeTransactionCsvCell = string | number | boolean

const BRIDGE_TRANSACTION_CSV_HEADERS: Array<BridgeTransactionCsvCell> = [
	'Timestamp',
	'Bridge',
	'Chain',
	'Direction',
	'Token',
	'Amount',
	'USD Value',
	'From',
	'To',
	'Transaction'
]

export const toBridgeTransactionCsvRow = (row: TransformedTransaction): Array<BridgeTransactionCsvCell> => [
	row.timestamp,
	row.bridge_name,
	row.chain,
	row.is_deposit,
	row.token,
	row.amount,
	row.usd_value ?? '',
	row.tx_from,
	row.tx_to,
	row.tx_hash
]

function TransactionsTable({
	data,
	columns,
	csvFileName,
	truncated
}: {
	data: Array<TransformedTransaction>
	columns: ReturnType<typeof buildBridgeColumns>
	csvFileName: string
	truncated: boolean
}) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'timestamp', desc: true }])
	const [globalFilter, setGlobalFilter] = React.useState('')
	const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE })
	const deferredFilter = React.useDeferredValue(globalFilter)
	const normalizedFilter = deferredFilter.toLowerCase()
	const searchIndex = React.useMemo(() => createBridgeTransactionSearchIndex(data), [data])

	const [pageInputs, setPageInputs] = React.useState({ filter: normalizedFilter, sorting })
	if (pageInputs.filter !== normalizedFilter || pageInputs.sorting !== sorting) {
		setPageInputs({ filter: normalizedFilter, sorting })
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }))
	}

	const instance = useTable({
		features: tableFeaturesConfig,
		data,
		columns,
		state: { sorting, globalFilter: normalizedFilter, pagination },
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onGlobalFilterChange: setGlobalFilter,
		onPaginationChange: (updater) => React.startTransition(() => setPagination(updater)),
		globalFilterFn: (row, _columnId, searchValue: string) =>
			matchesBridgeTransactionSearch(row.original, searchIndex, searchValue),
		// The index contains every searchable value, so TanStack only needs to call it once per row.
		getColumnCanGlobalFilter: (column) => column.id === 'timestamp',
		enableSortingRemoval: false,
		defaultColumn: { sortUndefined: 'last' }
	})

	const filteredCount = instance.getFilteredRowModel().rows.length
	const pageCount = instance.getPageCount()
	const { pageIndex, pageSize } = instance.state.pagination
	const pageStart = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
	const pageEnd = Math.min(filteredCount, pageStart + pageSize - 1)

	const prepareCsv = React.useCallback(() => {
		const filteredRows = instance.getPrePaginatedRowModel().rows
		const rows: Array<Array<BridgeTransactionCsvCell>> = new Array(filteredRows.length + 1)
		rows[0] = BRIDGE_TRANSACTION_CSV_HEADERS
		let outputIndex = 1
		for (const row of filteredRows) {
			rows[outputIndex++] = toBridgeTransactionCsvRow(row.original)
		}
		return { filename: csvFileName, rows }
	}, [instance, csvFileName])

	return (
		<Panel>
			<TableToolbar>
				<h2 className="mr-auto label-md">
					Transactions
					{truncated ? <span className="ml-2 text-warning">· newest loaded rows</span> : null}
				</h2>
				<TableToolbarControlGroup>
					<SearchField
						label="Search transactions"
						value={globalFilter}
						onChange={setGlobalFilter}
						placeholder="Search hash, address, token, chain…"
						className={searchFieldInlineWrapperStyles}
					/>
					<span className="body-sm whitespace-nowrap text-secondary">
						{filteredCount === data.length
							? `${formatCompactNumber(filteredCount, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} rows`
							: `${formatCompactNumber(filteredCount, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} of ${formatCompactNumber(data.length, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}
					</span>
					<CSVDownloadButton prepareCsv={prepareCsv} smol size="md" />
				</TableToolbarControlGroup>
			</TableToolbar>

			<VirtualTable table={instance} rowSize={48} />

			<TablePager
				pageIndex={pageIndex}
				pageCount={pageCount}
				onPageChange={(index) => React.startTransition(() => instance.setPageIndex(index))}
				range={{ from: pageStart, to: pageEnd, total: filteredCount }}
				pageSize={{
					value: pageSize,
					options: PAGE_SIZE_OPTIONS,
					onChange: (value) =>
						React.startTransition(() => {
							instance.setPageSize(value)
							instance.setPageIndex(0)
						})
				}}
				className="justify-between border-t border-subtle p-2"
			/>
		</Panel>
	)
}
