import { useMutation } from '@tanstack/react-query'
import {
	createColumnHelper,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import * as React from 'react'
import { useBlockExplorers } from '~/api/client'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { selectTriggerStyles } from '~/components/Select/types'
import { VirtualTable } from '~/components/Table/Table'
import { TokenLogo } from '~/components/TokenLogo'
import { useDateRangeValidation } from '~/hooks/useDateRangeValidation'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { inputStyles, searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { LoadingDots } from '~/ui/Loaders'
import { Panel } from '~/ui/Panel'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { slug } from '~/utils'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { formatDate, formatDateTime } from '~/utils/dateFormat'
import { formatUsd, formatCompactNumber } from '~/utils/numberFormat'
import { fetchBridgeTransactionsClient } from './api'
import type { RawBridgeInfo, RawBridgeTransaction } from './api.types'

export type BridgeTransaction = RawBridgeTransaction

const MAX_ITERATIONS = 50

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

export function createBridgeTransactionSearchIndex(rows: TransformedTransaction[]): BridgeTransactionSearchIndex {
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
	rows: TransformedTransaction[]
	stats: BridgeTransactionStats | null
}

const parseTransactionTimestamp = (timestamp: string): number => Math.floor(Date.parse(timestamp) / 1000)

const buildBridgeTransactionRow = (tx: BridgeTransaction, timestamp: number): TransformedTransaction => {
	const parsedUsdValue = tx.usd_value === null ? null : Number.parseFloat(tx.usd_value)
	return {
		timestamp,
		bridge_name: tx.bridge_name,
		bridge_slug: slug(tx.bridge_name ?? ''),
		chain: tx.chain,
		is_deposit: tx.is_deposit,
		token: tx.token,
		amount: tx.amount,
		usd_value: parsedUsdValue !== null && Number.isFinite(parsedUsdValue) ? parsedUsdValue : null,
		tx_from: tx.tx_from,
		tx_to: tx.tx_to,
		tx_hash: tx.tx_hash
	}
}

export const createBridgeTransactionCollector = () => {
	const rows: TransformedTransaction[] = []
	const seenTransactionHashes = new Set<string>()
	const uniqueChains = new Set<string>()
	let previousAcceptedTimestamp = Number.POSITIVE_INFINITY
	let isDescending = true
	let deposits = 0
	let withdrawals = 0
	let depositVolume = 0
	let withdrawalVolume = 0
	let unknownValueCount = 0

	return {
		addPage(transactions: BridgeTransaction[]): number | null {
			let terminalTimestamp: number | null = null
			for (const tx of transactions) {
				const timestamp = parseTransactionTimestamp(tx.ts)
				terminalTimestamp = timestamp
				if (seenTransactionHashes.has(tx.tx_hash)) continue
				seenTransactionHashes.add(tx.tx_hash)

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
			return terminalTimestamp
		},
		finish(): BridgeTransactionResult {
			if (!isDescending) {
				// Array sorting is stable, so equal timestamps retain API encounter order as before.
				rows.sort((left, right) => right.timestamp - left.timestamp)
			}
			return {
				rows,
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

const columnHelper = createColumnHelper<TransformedTransaction>()

const truncateMiddle = (value: string, lead = 6, tail = 4) => {
	if (!value) return ''
	if (value.length <= lead + tail + 1) return value
	return `${value.slice(0, lead)}…${value.slice(-tail)}`
}

const buildBridgeColumns = (blockExplorersData: ReturnType<typeof useBlockExplorers>['data']) => [
	columnHelper.accessor('timestamp', {
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
						deposit ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
					}`}
				>
					<Icon name={deposit ? 'arrow-down' : 'arrow-up-right'} height={12} width={12} />
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
					<span className="font-mono text-xs text-secondary" title={value}>
						{truncateMiddle(value, 8, 4)}
					</span>
				)
			}
			return (
				<a
					href={explorer.url}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 font-mono text-xs text-link hover:underline"
					title={value}
				>
					{truncateMiddle(value, 8, 4)}
					<Icon name="external-link" height={10} width={10} />
				</a>
			)
		},
		meta: {
			headerClassName: 'w-[140px]'
		}
	}),
	columnHelper.accessor('amount', {
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
	columnHelper.accessor('usd_value', {
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
			const display = <span className="font-mono text-xs">{truncateMiddle(value)}</span>
			if (!explorer) return display
			return (
				<a
					href={explorer.url}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-link hover:underline"
					title={value}
				>
					{display}
					<Icon name="external-link" height={10} width={10} />
				</a>
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
			const display = <span className="font-mono text-xs">{truncateMiddle(value)}</span>
			if (!explorer) return display
			return (
				<a
					href={explorer.url}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-link hover:underline"
					title={value}
				>
					{display}
					<Icon name="external-link" height={10} width={10} />
				</a>
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
					<span className="font-mono text-xs" title={value}>
						{truncateMiddle(value)}
					</span>
				)
			}
			return (
				<a
					href={explorer.url}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-link hover:underline"
					title={value}
				>
					<span className="font-mono text-xs">{truncateMiddle(value)}</span>
					<Icon name="external-link" height={10} width={10} />
				</a>
			)
		},
		meta: {
			headerClassName: 'w-[170px]'
		}
	})
]

interface FetchArgs {
	bridges: RawBridgeInfo[]
	startDate: string
	endDate: string
	selectedBridge: string
}

export const fetchTransactions = async ({ bridges, startDate, endDate, selectedBridge }: FetchArgs) => {
	const selectedBridgeData = bridges.find((bridge) => bridge.displayName === selectedBridge)
	if (!selectedBridgeData?.id) {
		throw new Error('Invalid bridge selected')
	}

	const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000)
	const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000) + 86400

	if (startTimestamp >= endTimestamp) {
		throw new Error('Invalid date range')
	}

	const bridgeId = selectedBridgeData.id
	const collector = createBridgeTransactionCollector()
	let currentEndTimestamp = endTimestamp
	let iterations = 0

	while (iterations < MAX_ITERATIONS) {
		const transactions = await fetchBridgeTransactionsClient(bridgeId, startTimestamp, currentEndTimestamp)

		if (!transactions?.length) {
			break
		}

		// The paging API contract is newest-to-oldest with a 6,000-row cap. The collector
		// verifies accepted rows across pages and sorts once only if that contract is violated.
		const terminalTimestamp = collector.addPage(transactions)

		if (transactions.length < 6000) {
			break
		}

		if (terminalTimestamp === null || terminalTimestamp >= currentEndTimestamp) {
			break
		}

		currentEndTimestamp = terminalTimestamp - 1
		if (currentEndTimestamp <= startTimestamp) {
			break
		}
		iterations++
	}

	return collector.finish()
}

const toDateOnly = (date: Date) => date.toISOString().split('T')[0]

interface StatCardProps {
	label: string
	value: React.ReactNode
	sublabel?: React.ReactNode
	accent?: 'default' | 'success' | 'error'
}

function StatCard({ label, value, sublabel, accent = 'default' }: StatCardProps) {
	const accentClass = accent === 'success' ? 'text-success' : accent === 'error' ? 'text-error' : 'text-primary'
	return (
		<Card padding="md" className="flex flex-col gap-1">
			<span className="label-sm text-secondary uppercase">{label}</span>
			<span className={`text-2xl font-semibold ${accentClass}`}>{value}</span>
			{sublabel ? <span className="label-sm text-tertiary">{sublabel}</span> : null}
		</Card>
	)
}

function EmptyState({ hasFetched }: { hasFetched: boolean }) {
	return (
		<Card padding="md" className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
			<div className="flex size-12 items-center justify-center rounded-full bg-brand-muted text-link">
				<Icon name={hasFetched ? 'search' : 'activity'} height={22} width={22} />
			</div>
			<h2 className="heading-xs">{hasFetched ? 'No transactions in this range' : 'Explore bridge transaction data'}</h2>
			<p className="max-w-md body-sm text-secondary">
				{hasFetched
					? 'Try a wider date range or a different bridge. Transactions may be sparse for smaller bridges or short windows.'
					: 'Pick a bridge and a date range, then fetch transactions. Results can be filtered, sorted, and exported as CSV.'}
			</p>
		</Card>
	)
}

export const BridgeTransactionsPage = ({ bridges }: { bridges: RawBridgeInfo[] }) => {
	const defaultEndDate = new Date()
	const defaultStartDate = new Date(defaultEndDate)
	defaultStartDate.setMonth(defaultEndDate.getMonth() - 1)

	const [transactionResult, setTransactionResult] = React.useState<BridgeTransactionResult>({ rows: [], stats: null })
	const [fetchedContext, setFetchedContext] = React.useState<{
		startDate: string
		endDate: string
		bridgeName: string
	} | null>(null)
	const [selectedBridge, setSelectedBridge] = React.useState<string[]>([])

	const { mutate, isPending, error } = useMutation({
		mutationFn: fetchTransactions,
		onSuccess: (data, variables) => {
			setTransactionResult(data)
			setFetchedContext({
				startDate: variables.startDate,
				endDate: variables.endDate,
				bridgeName: variables.selectedBridge
			})
		}
	})

	const { startDate, endDate, dateError, handleStartDateChange, handleEndDateChange, validateDateRange } =
		useDateRangeValidation({
			initialStartDate: toDateOnly(defaultStartDate),
			initialEndDate: toDateOnly(defaultEndDate)
		})

	const { data: blockExplorersData } = useBlockExplorers()

	const bridgeOptions = React.useMemo(
		() =>
			[...bridges]
				.sort((a, b) => (b.last24hVolume ?? 0) - (a.last24hVolume ?? 0))
				.map((bridge) => ({ key: bridge.displayName, name: bridge.displayName })),
		[bridges]
	)

	const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault()
		const bridgeName = selectedBridge[0]
		if (!bridgeName) {
			return
		}
		if (!validateDateRange(startDate, endDate)) {
			return
		}
		mutate({
			startDate,
			endDate,
			selectedBridge: bridgeName,
			bridges
		})
	}

	const maxDate = toDateOnly(new Date())

	const tableData = transactionResult.rows
	const columns = React.useMemo(() => buildBridgeColumns(blockExplorersData), [blockExplorersData])
	const stats = transactionResult.stats

	const csvFileName = fetchedContext
		? `bridge-transactions_${slug(fetchedContext.bridgeName)}_${fetchedContext.startDate}_${fetchedContext.endDate}`
		: `bridge-transactions_${startDate}_${endDate}`

	const formError = (error as Error | null)?.message ?? dateError ?? null
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

			<Card
				padding="md"
				as="form"
				onSubmit={handleSubmit}
				className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(240px,1.4fr)_repeat(2,minmax(150px,1fr))_auto] md:items-end"
			>
				<label className="flex flex-col gap-1.5">
					<span className="label-sm text-secondary uppercase">Bridge</span>
					<SelectWithCombobox
						allValues={bridgeOptions}
						selectedValues={selectedBridge}
						setSelectedValues={setSelectedBridge}
						singleSelect
						label={selectedBridge[0] ?? 'Select a bridge'}
						labelType="none"
						variant="default"
						size="sm"
						triggerProps={{
							className: `${selectTriggerStyles('filter', 'md')} w-full`
						}}
					/>
				</label>
				<label className="flex flex-col gap-1.5">
					<span className="label-sm text-secondary uppercase">Start Date</span>
					<input
						type="date"
						name="startDate"
						value={startDate}
						onChange={(e) => handleStartDateChange(e.target.value)}
						max={maxDate}
						required
						className={`${inputStyles} cursor-pointer dark:scheme-dark`}
					/>
				</label>
				<label className="flex flex-col gap-1.5">
					<span className="label-sm text-secondary uppercase">End Date</span>
					<input
						type="date"
						name="endDate"
						value={endDate}
						onChange={(e) => handleEndDateChange(e.target.value)}
						min={startDate}
						max={maxDate}
						required
						className={`${inputStyles} cursor-pointer dark:scheme-dark`}
					/>
				</label>
				<Button type="submit" variant="primary" size="md" disabled={isPending || !selectedBridge[0]}>
					{isPending ? (
						<>
							Fetching
							<LoadingDots />
						</>
					) : (
						<>
							<Icon name="search" height={14} width={14} />
							Fetch Transactions
						</>
					)}
				</Button>

				{formError ? (
					<div
						role="alert"
						className="col-span-full flex items-center gap-2 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
					>
						<Icon name="alert-triangle" height={14} width={14} />
						<p>{formError}</p>
					</div>
				) : null}
			</Card>

			{isPending ? (
				<Card padding="md" className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
					<LoadingDots />
					<p className="body-sm text-secondary">
						Fetching transactions. Large ranges may take a moment as we page through results.
					</p>
				</Card>
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
						<StatCard
							label="Transactions"
							value={formatCompactNumber(stats.total, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
							sublabel={stats.unknownValueCount > 0 ? `${stats.unknownValueCount} without USD value` : undefined}
						/>
						<StatCard
							label="Total Volume"
							value={formatUsd(stats.totalVolume, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
							sublabel="USD, priced rows only"
						/>
						<StatCard
							label="Deposits"
							value={formatCompactNumber(stats.deposits, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
							sublabel={formatUsd(stats.depositVolume, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
							accent="success"
						/>
						<StatCard
							label="Withdrawals"
							value={formatCompactNumber(stats.withdrawals, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
							sublabel={formatUsd(stats.withdrawalVolume, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
							accent="error"
						/>
					</div>
				</div>
			) : null}

			{!isPending && tableData.length > 0 ? (
				<TransactionsTable data={tableData} columns={columns} csvFileName={csvFileName} />
			) : null}

			{showEmpty ? <EmptyState hasFetched={fetchedContext != null} /> : null}
		</div>
	)
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500] as const
const DEFAULT_PAGE_SIZE = 100

export const toBridgeTransactionCsvCell = (value: unknown): string | number | boolean => {
	if (value == null) return ''
	if (typeof value === 'number') return Number.isFinite(value) ? value : ''
	if (typeof value === 'string' || typeof value === 'boolean') return value
	return ''
}

function TransactionsTable({
	data,
	columns,
	csvFileName
}: {
	data: TransformedTransaction[]
	columns: ReturnType<typeof buildBridgeColumns>
	csvFileName: string
}) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'timestamp', desc: true }])
	const [globalFilter, setGlobalFilter] = React.useState('')
	const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE })
	const deferredFilter = React.useDeferredValue(globalFilter)
	const normalizedFilter = deferredFilter.toLowerCase()
	const searchIndex = React.useMemo(() => createBridgeTransactionSearchIndex(data), [data])

	const instance = useReactTable({
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
		defaultColumn: { sortUndefined: 'last' },
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	})

	React.useEffect(() => {
		React.startTransition(() => {
			setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }))
		})
	}, [normalizedFilter, sorting])

	const filteredCount = instance.getFilteredRowModel().rows.length
	const pageCount = instance.getPageCount()
	const { pageIndex, pageSize } = instance.getState().pagination
	const pageStart = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
	const pageEnd = Math.min(filteredCount, pageStart + pageSize - 1)

	const prepareCsv = React.useCallback(() => {
		const visibleCols = instance.getVisibleLeafColumns().filter((c) => !c.columnDef.meta?.hidden)
		const headers = visibleCols.map((column) => {
			const csvHeader = (column.columnDef.meta as { csvHeader?: unknown } | undefined)?.csvHeader
			if (typeof csvHeader === 'string' && csvHeader.length > 0) return csvHeader
			const h = column.columnDef.header
			return typeof h === 'string' ? h : (column.columnDef.id ?? column.id)
		})
		const filteredRows = instance.getPrePaginationRowModel().rows
		const rows = filteredRows.map((row) =>
			visibleCols.map((column) => toBridgeTransactionCsvCell(row.getValue(column.id)))
		)
		return { filename: csvFileName, rows: [headers, ...rows] }
	}, [instance, csvFileName])

	return (
		<Panel padding="none">
			<TableToolbar className="w-full justify-end">
				<h2 className="mr-auto label-md">Transactions</h2>
				<TableToolbarControlGroup>
					<label className={searchFieldInlineWrapperStyles}>
						<span className="sr-only">Search transactions</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<input
							value={globalFilter}
							onChange={(e) => setGlobalFilter(e.target.value)}
							placeholder="Search hash, address, token, chain…"
							className={searchFieldInputStyles}
						/>
					</label>
					<span className="body-sm whitespace-nowrap text-secondary">
						{filteredCount === data.length
							? `${formatCompactNumber(filteredCount, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} rows`
							: `${formatCompactNumber(filteredCount, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} of ${formatCompactNumber(data.length, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}
					</span>
					<CSVDownloadButton prepareCsv={prepareCsv} smol size="md" />
				</TableToolbarControlGroup>
			</TableToolbar>

			<VirtualTable instance={instance} rowSize={48} />

			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle p-2 label-sm text-secondary">
				<span>
					{filteredCount === 0
						? 'No rows'
						: `${formatCompactNumber(pageStart, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}–${formatCompactNumber(pageEnd, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} of ${formatCompactNumber(filteredCount, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}
				</span>

				<div className="flex items-center gap-1">
					<PagerButton
						aria-label="First page"
						onClick={() => React.startTransition(() => instance.setPageIndex(0))}
						disabled={!instance.getCanPreviousPage()}
					>
						<Icon name="chevrons-left" height={14} width={14} />
					</PagerButton>
					<PagerButton
						aria-label="Previous page"
						onClick={() => React.startTransition(() => instance.previousPage())}
						disabled={!instance.getCanPreviousPage()}
					>
						<Icon name="chevron-left" height={14} width={14} />
					</PagerButton>
					<span className="px-2 font-medium text-primary">
						{pageCount === 0 ? '0 / 0' : `${pageIndex + 1} / ${pageCount}`}
					</span>
					<PagerButton
						aria-label="Next page"
						onClick={() => React.startTransition(() => instance.nextPage())}
						disabled={!instance.getCanNextPage()}
					>
						<Icon name="chevron-right" height={14} width={14} />
					</PagerButton>
					<PagerButton
						aria-label="Last page"
						onClick={() => React.startTransition(() => instance.setPageIndex(Math.max(0, pageCount - 1)))}
						disabled={!instance.getCanNextPage()}
					>
						<Icon name="chevrons-right" height={14} width={14} />
					</PagerButton>
				</div>

				<label className="flex items-center gap-2">
					<span>Rows</span>
					<select
						value={pageSize}
						onChange={(e) =>
							React.startTransition(() => {
								instance.setPageSize(Number(e.target.value))
								instance.setPageIndex(0)
							})
						}
						className={selectTriggerStyles('filter', 'md')}
					>
						{PAGE_SIZE_OPTIONS.map((size) => (
							<option key={size} value={size}>
								{size}
							</option>
						))}
					</select>
				</label>
			</div>
		</Panel>
	)
}

function PagerButton({ children, disabled, onClick, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<Button type="button" variant="ghost" size="sm" onClick={onClick} disabled={disabled} square {...rest}>
			{children}
		</Button>
	)
}
