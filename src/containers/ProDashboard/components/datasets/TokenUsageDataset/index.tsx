import type { PaginationState, SortingState } from '@tanstack/react-table'
import { matchSorter } from 'match-sorter'
import { useDeferredValue, useMemo, useState } from 'react'
import { MultiSelectCombobox } from '~/components/Select/MultiSelectCombobox'
import { usePaginatedTable } from '~/components/Table/features/pagination'
import { TablePager } from '~/components/Table/TablePager'
import { normalizeProTokenSymbols } from '~/containers/ProDashboard/tableQueryKeys'
import type { TokenUsageDatasetTableConfig } from '~/containers/ProDashboard/types'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles, searchFieldWrapperStyles } from '~/ui/Input'
import type { CsvCell } from '~/utils/csvCell'
import { downloadCSV as downloadCSVFile } from '~/utils/download'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { CSVExportButton } from '../../CSVExportButton'
import { ProCardError, ProCardLoading } from '../../ProCardStatus'
import { TABLE_PAGE_SIZES, TableBody } from '../../Table/TableBody'
import { getColumns } from './columns'
import { buildTokenUsageSummary } from './summary'
import { type TokenOption, useTokenSearch } from './useTokenSearch'
import { useTokenUsageData } from './useTokenUsageData'

const EMPTY_TOKEN_OPTIONS: Array<TokenOption> = []
const EMPTY_USAGE_DATA: Array<ProtocolTokenUsageData> = []

interface TokenUsageDatasetProps {
	config: TokenUsageDatasetTableConfig
	enableColumnManagement?: boolean
}

type EditableTokenUsageDatasetProps = TokenUsageDatasetProps & {
	editable: true
	onConfigChange: (config: TokenUsageDatasetTableConfig) => void
}

type ReadOnlyTokenUsageDatasetProps = TokenUsageDatasetProps & {
	editable: false
	onConfigChange?: never
}

interface TokenSelectorProps {
	config: TokenUsageDatasetTableConfig
	onConfigChange: (config: TokenUsageDatasetTableConfig) => void
	placeholder: string
}

const MAX_TOKENS = 4

function TokenSelector({ config, onConfigChange, placeholder }: TokenSelectorProps) {
	const [tokenSearchInput, setTokenSearchInput] = useState('')
	const tokenSymbols = useMemo(() => normalizeProTokenSymbols(config.tokenSymbols), [config.tokenSymbols])
	const { data: tokenOptionsResponse, isLoading } = useTokenSearch(tokenSearchInput, true)
	const { data: defaultTokensResponse } = useTokenSearch('', true)
	const tokenOptions = tokenOptionsResponse ?? EMPTY_TOKEN_OPTIONS
	const defaultTokens = defaultTokensResponse ?? EMPTY_TOKEN_OPTIONS

	return (
		<MultiSelectCombobox
			heading="Tokens"
			placeholder={placeholder}
			data={tokenSearchInput ? tokenOptions : defaultTokens}
			selectedValues={tokenSymbols}
			setSelectedValues={(symbols) => {
				if (symbols.length > MAX_TOKENS) return
				onConfigChange({ ...config, tokenSymbols: symbols })
			}}
			filterOptions={false}
			onSearchChange={setTokenSearchInput}
			isLoading={isLoading}
			emptyMessage="No tokens found"
		/>
	)
}

export function TokenUsageDataset(props: EditableTokenUsageDatasetProps | ReadOnlyTokenUsageDatasetProps) {
	const { config } = props
	const [search, setSearch] = useState('')
	const [sorting, setSorting] = useState<SortingState>([{ desc: true, id: 'amountUsd' }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
	const includeCex = config.includeCex

	const tokenSymbols = useMemo(() => normalizeProTokenSymbols(config.tokenSymbols), [config.tokenSymbols])

	const { query: usageQuery, isLoading } = useTokenUsageData(tokenSymbols, includeCex)
	const { data: rawDataResponse } = usageQuery

	const rawData = rawDataResponse ?? EMPTY_USAGE_DATA
	const deferredSearch = useDeferredValue(search)

	const filteredData = useMemo(() => {
		if (!deferredSearch) return rawData
		return matchSorter(rawData, deferredSearch, {
			keys: ['name', (item) => item.category ?? ''],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [rawData, deferredSearch])

	const columns = useMemo(() => getColumns(tokenSymbols), [tokenSymbols])

	const table = usePaginatedTable({
		defaultColumn: { sortUndefined: 'last' },
		data: filteredData,
		columns,
		state: {
			sorting,
			pagination
		},
		onSortingChange: setSorting,
		enableSortingRemoval: false,
		onPaginationChange: setPagination,
		autoResetPageIndex: true
	})

	const summary = useMemo(() => buildTokenUsageSummary(rawData, tokenSymbols), [rawData, tokenSymbols])
	const { totalAmount, protocolCount, topCategories, multiTokenProtocolCount } = summary

	const downloadCSV = () => {
		const isMultiToken = tokenSymbols.length > 1
		const headers: Array<CsvCell> = ['Protocol', 'Category']

		if (isMultiToken) {
			for (const symbol of tokenSymbols) {
				headers.push(`${symbol.toUpperCase()} (USD)`)
			}
		}
		headers.push('Total Amount (USD)')

		const csv: Array<Array<CsvCell>> = [headers]
		for (const row of table.getPrePaginatedRowModel().rows) {
			const data: Array<CsvCell> = [row.original.name, row.original.category ?? '']

			if (isMultiToken) {
				for (const symbol of tokenSymbols) {
					data.push(row.original.tokens[symbol] ?? 0)
				}
			}

			data.push(row.original.amountUsd)
			csv.push(data)
		}

		downloadCSVFile(`token-usage-${tokenSymbols.join('-')}.csv`, csv)
	}

	if (tokenSymbols.length === 0) {
		return (
			<div className="flex size-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col items-center justify-center gap-4 px-4">
					{props.editable ? (
						<>
							<h3 className="text-center heading-xs text-primary md:heading-sm">Select Tokens to Compare</h3>
							<div className="w-full max-w-md">
								<TokenSelector config={config} onConfigChange={props.onConfigChange} placeholder="Search tokens…" />
							</div>
							<p className="mt-2 body-md text-tertiary">Select up to {MAX_TOKENS} tokens to compare</p>
						</>
					) : (
						<p className="body-md text-secondary">No tokens configured.</p>
					)}
				</div>
			</div>
		)
	}

	// A retry from an error moves the query back to loading; the error and its waiting Try again stay until it succeeds.
	if (queryReadFailed(usageQuery)) {
		return (
			<div className="flex size-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col justify-center">
					<ProCardError title="Couldn't load token usage data" retry={usageQuery} />
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex size-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading variant="table" label="Loading token usage data" />
				</div>
			</div>
		)
	}

	return (
		<div className="flex size-full flex-col">
			{summary.kind === 'single' ? (
				<div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
					<div className="border border-subtle p-3">
						<div className="mb-1 body-sm text-tertiary">Total Value</div>
						<div className="heading-xs text-primary">
							{formatUsd(totalAmount, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
						</div>
					</div>
					<div className="border border-subtle p-3">
						<div className="mb-1 body-sm text-tertiary">Protocols</div>
						<div className="heading-xs text-primary">{protocolCount}</div>
					</div>
					<div className="border border-subtle p-3">
						<div className="mb-1 body-sm text-tertiary">Top Category</div>
						<div className="heading-xs text-primary">{topCategories[0] ? topCategories[0][0] : '-'}</div>
						<div className="body-sm text-tertiary">
							{topCategories[0] ? `${topCategories[0][1].count} protocols` : ''}
						</div>
					</div>
					<div className="border border-subtle p-3">
						<div className="mb-1 body-sm text-tertiary">Avg per Protocol</div>
						<div className="heading-xs text-primary">
							{protocolCount > 0
								? formatUsd(totalAmount / protocolCount, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})
								: '-'}
						</div>
					</div>
				</div>
			) : (
				<>
					<div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
						{tokenSymbols.map((symbol) => {
							const stats = summary.tokenStats[symbol]
							if (!stats) throw new Error(`Missing token-usage summary bucket for ${symbol}`)
							return (
								<div key={symbol} className="border border-subtle p-3">
									<div className="mb-1 body-sm text-tertiary">{symbol.toUpperCase()} Value</div>
									<div className="heading-xs text-primary">
										{formatUsd(stats.total, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}
									</div>
									<div className="body-sm text-tertiary">{stats.protocols} protocols</div>
									<div className="mt-2">
										<div className="mb-1 flex items-center justify-between">
											<span className="body-sm text-tertiary">Share</span>
											<span className="label-sm">
												{totalAmount > 0
													? `${formatPercent(stats.total / totalAmount, { input: 'fraction', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })}`
													: '0%'}
											</span>
										</div>
										<div className="h-1.5 overflow-hidden bg-surface-elevated-1">
											<div
												className="h-full bg-brand transition-[width] duration-300"
												style={{
													width: `${totalAmount > 0 ? (stats.total / totalAmount) * 100 : 0}%`
												}}
											/>
										</div>
									</div>
								</div>
							)
						})}

						{tokenSymbols.length <= 2 ? (
							<div className="border border-subtle p-3">
								<div className="mb-1 body-sm text-tertiary">Total Combined</div>
								<div className="heading-xs text-primary">
									{formatUsd(totalAmount, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								</div>
								<div className="body-sm text-tertiary">All tokens</div>
							</div>
						) : null}

						{tokenSymbols.length <= 3 ? (
							<div className="border border-subtle p-3">
								<div className="mb-1 body-sm text-tertiary">Unique Protocols</div>
								<div className="heading-xs text-primary">{protocolCount}</div>
								<div className="body-sm text-tertiary">
									{multiTokenProtocolCount > 0 ? `${multiTokenProtocolCount} use multiple` : 'Total count'}
								</div>
							</div>
						) : null}
					</div>

					<div className="mb-4 border border-subtle p-3">
						<div className="mb-2 body-sm text-tertiary">Protocol Distribution</div>
						<div className="flex flex-wrap items-center gap-4">
							<div className="flex items-center gap-2">
								<div className="size-3 bg-brand" />
								<span className="body-md">
									<span className="font-semibold">{summary.protocolOverlap.shared}</span>
									<span className="text-tertiary"> shared</span>
									{protocolCount > 0 ? (
										<span className="body-sm text-tertiary">
											{' '}
											(
											{formatPercent(summary.protocolOverlap.shared / protocolCount, {
												input: 'fraction',
												maximumFractionDigits: 0,
												useGrouping: false
											})}
											)
										</span>
									) : null}
								</span>
							</div>

							{tokenSymbols.map((symbol, index) => {
								const exclusiveCount = summary.protocolOverlap.exclusiveByToken[symbol]
								if (exclusiveCount === undefined) {
									throw new Error(`Missing token-usage overlap bucket for ${symbol}`)
								}
								return (
									<div key={symbol} className="flex items-center gap-2">
										<div
											className="size-3 border-2 border-subtle"
											style={{
												backgroundColor: `hsl(${index * 90}, 50%, 50%)`,
												opacity: 0.7
											}}
										/>
										<span className="body-md">
											<span className="font-semibold">{exclusiveCount}</span>
											<span className="text-tertiary"> {symbol.toUpperCase()} only</span>
										</span>
									</div>
								)
							})}

							<div className="ml-auto body-md text-tertiary">Total: {protocolCount} protocols</div>
						</div>
					</div>
				</>
			)}

			<div className="mb-3">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
					<div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
						{props.editable ? (
							<div className="order-2 w-full sm:order-1 sm:w-64 lg:w-96">
								<TokenSelector
									config={config}
									onConfigChange={props.onConfigChange}
									placeholder="Add or remove tokens (max 4)…"
								/>
							</div>
						) : null}
						<div className="order-1 flex items-center gap-2 sm:order-2 sm:gap-3">
							{props.editable ? (
								<Checkbox
									variant="filter"
									checked={includeCex}
									onChange={() => props.onConfigChange({ ...config, includeCex: !includeCex })}
								>
									<span className="whitespace-nowrap">Include CEXs</span>
								</Checkbox>
							) : null}
							<CSVExportButton onClick={downloadCSV} />
						</div>
					</div>
				</div>
				<div className="mt-3 flex items-center gap-2 sm:gap-4">
					<div className={searchFieldWrapperStyles}>
						<Icon name="search" className={searchFieldIconStyles} />
						<Input
							aria-label="Search protocols"
							placeholder="Search protocols…"
							onInput={(e) => setSearch(e.currentTarget.value)}
							className={searchFieldInputPlacementStyles}
						/>
					</div>
				</div>
			</div>

			<TableBody table={table} isLoading={isLoading} />
			<TablePager
				pageIndex={pagination.pageIndex}
				pageCount={table.getPageCount()}
				onPageChange={table.setPageIndex}
				pageSize={
					filteredData.length > 10
						? { value: pagination.pageSize, options: TABLE_PAGE_SIZES, onChange: table.setPageSize }
						: undefined
				}
				className="mt-2 justify-between"
			/>
		</div>
	)
}
