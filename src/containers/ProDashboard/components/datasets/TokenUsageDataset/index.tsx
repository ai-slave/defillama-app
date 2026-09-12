import type { PaginationState, SortingState } from '@tanstack/react-table'
import { matchSorter } from 'match-sorter'
import { useDeferredValue, useMemo, useState } from 'react'
import { components, type GroupBase, type MultiValue, type OptionProps, type ValueContainerProps } from 'react-select'
import { ReactSelect } from '~/components/MultiSelect/ReactSelect'
import { paginatedTableFeatures, usePaginatedTable } from '~/components/Table/features/pagination'
import { normalizeProTokenSymbols } from '~/containers/ProDashboard/tableQueryKeys'
import type { TokenUsageDatasetTableConfig } from '~/containers/ProDashboard/types'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
import { useIsClient } from '~/hooks/useIsClient'
import type { CsvCell } from '~/utils/csvCell'
import { downloadCSV as downloadCSVFile } from '~/utils/download'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { reactSelectStyles } from '../../../utils/reactSelectStyles'
import { CSVExportButton } from '../../CSVExportButton'
import { LoadingSpinner } from '../../LoadingSpinner'
import { TableBody } from '../../Table/TableBody'
import { TablePagination } from '../../Table/TablePagination'
import { getColumns } from './columns'
import { buildTokenUsageSummary } from './summary'
import { type TokenOption, useTokenSearch } from './useTokenSearch'
import { useTokenUsageData } from './useTokenUsageData'

export const tableFeaturesConfig = paginatedTableFeatures

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

function TokenOptionComponent({ innerProps, label, data }: OptionProps<TokenOption, true>) {
	return (
		<div {...innerProps} className="flex cursor-pointer items-center gap-2 p-2">
			{data.logo ? (
				<img src={data.logo?.replace('/0/', '')} alt="" width={20} height={20} className="size-5 rounded-full" />
			) : (
				<div className="size-5 rounded-full bg-surface-elevated-2" />
			)}
			<span>{label}</span>
		</div>
	)
}

function CustomValueContainer({ children, ...props }: ValueContainerProps<TokenOption, true>) {
	const { getValue } = props
	const values = getValue()

	if (values.length === 0) {
		return <components.ValueContainer {...props}>{children}</components.ValueContainer>
	}

	const shouldShowCount = values.length > 1

	return (
		<components.ValueContainer {...props}>
			{shouldShowCount ? (
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium">{values.length} tokens selected</span>
				</div>
			) : (
				children
			)}
		</components.ValueContainer>
	)
}

interface TokenSelectorProps {
	config: TokenUsageDatasetTableConfig
	onConfigChange: (config: TokenUsageDatasetTableConfig) => void
	placeholder: string
	menuPortalTarget?: HTMLElement | null
}

function TokenSelector({ config, onConfigChange, placeholder, menuPortalTarget }: TokenSelectorProps) {
	const [tokenSearchInput, setTokenSearchInput] = useState('')
	const tokenSymbols = useMemo(() => normalizeProTokenSymbols(config.tokenSymbols), [config.tokenSymbols])
	const { data: tokenOptionsResponse, isLoading } = useTokenSearch(tokenSearchInput, true)
	const { data: defaultTokensResponse } = useTokenSearch('', true)
	const tokenOptions = tokenOptionsResponse ?? EMPTY_TOKEN_OPTIONS
	const defaultTokens = defaultTokensResponse ?? EMPTY_TOKEN_OPTIONS
	const value = useMemo(
		() => tokenSymbols.map((symbol) => ({ id: symbol, label: symbol, value: symbol })),
		[tokenSymbols]
	)

	const handleChange = (selectedOptions: MultiValue<TokenOption>) => {
		const symbols = selectedOptions.map((option) => option.value)
		if (symbols.length > 4) return
		onConfigChange({ ...config, tokenSymbols: symbols })
	}

	return (
		<ReactSelect
			placeholder={placeholder}
			value={value}
			onChange={handleChange}
			options={tokenSearchInput ? tokenOptions : defaultTokens}
			onInputChange={setTokenSearchInput}
			isLoading={isLoading}
			isClearable
			isMulti
			components={{ Option: TokenOptionComponent, ValueContainer: CustomValueContainer }}
			styles={{
				...reactSelectStyles<TokenOption, true, GroupBase<TokenOption>>({ minHeight: '38px', height: '38px' }),
				valueContainer: (provided) => ({ ...provided, height: '36px', padding: '0 8px' }),
				input: (provided) => ({ ...provided, margin: '0', padding: '0' })
			}}
			{...(menuPortalTarget !== undefined ? { menuPortalTarget } : {})}
		/>
	)
}

export function TokenUsageDataset(props: EditableTokenUsageDatasetProps | ReadOnlyTokenUsageDatasetProps) {
	const { config } = props
	const isClient = useIsClient()
	const menuPortalTarget =
		isClient && props.editable ? document.querySelector<HTMLElement>('.pro-dashboard-container') : null
	const [search, setSearch] = useState('')
	const [sorting, setSorting] = useState<SortingState>([{ desc: true, id: 'amountUsd' }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
	const includeCex = config.includeCex

	const tokenSymbols = useMemo(() => normalizeProTokenSymbols(config.tokenSymbols), [config.tokenSymbols])

	const { data: rawDataResponse, isLoading, isError, refetch } = useTokenUsageData(tokenSymbols, includeCex)

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
			<div className="flex size-full flex-col p-4">
				<div className="mb-3">
					<div className="flex items-center justify-between gap-4">
						<h3 className="text-base font-semibold text-pro-text-primary md:text-lg">Token Usage Comparison</h3>
					</div>
				</div>
				<div className="flex min-h-[500px] flex-1 flex-col items-center justify-center gap-4 px-4">
					{props.editable ? (
						<>
							<h3 className="text-center text-lg font-medium text-pro-text-primary md:text-xl">
								Select Tokens to Compare
							</h3>
							<div className="w-full max-w-md">
								<TokenSelector
									config={config}
									onConfigChange={props.onConfigChange}
									placeholder="Search tokens..."
									menuPortalTarget={menuPortalTarget}
								/>
							</div>
							<p className="mt-2 text-sm text-pro-text-tertiary">Select up to 4 tokens for comparison (max 4)</p>
						</>
					) : (
						<p className="text-sm text-pro-text-secondary">No tokens configured.</p>
					)}
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex size-full flex-col p-4">
				<div className="mb-3">
					<div className="flex items-center justify-between gap-4">
						<h3 className="text-base font-semibold text-pro-text-primary md:text-lg">
							{tokenSymbols.length > 0 ? `Token Usage Comparison` : 'Token Usage'}
						</h3>
					</div>
				</div>
				<div className="flex min-h-[500px] flex-1 flex-col items-center justify-center gap-4">
					<LoadingSpinner />
					<p className="text-sm text-pro-text-secondary">Loading token usage data...</p>
				</div>
			</div>
		)
	}

	if (isError) {
		return (
			<div className="flex size-full flex-col p-4">
				<div className="mb-3">
					<div className="flex items-center justify-between gap-4">
						<h3 className="text-base font-semibold text-pro-text-primary md:text-lg">Token Usage Comparison</h3>
					</div>
				</div>
				<div className="flex min-h-[500px] flex-1 flex-col items-center justify-center gap-4">
					<p className="mb-2 text-sm text-pro-text-secondary">Failed to load token usage data</p>
					<button
						type="button"
						onClick={() => {
							void refetch()
						}}
						className="rounded-sm bg-brand px-4 py-2 text-on-brand hover:bg-brand-muted"
					>
						Try again
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className="flex size-full flex-col p-4">
			<div className="mb-3">
				<div className="flex items-center justify-between gap-4">
					<h3 className="truncate text-base font-semibold text-pro-text-primary md:text-lg">
						Token Usage {tokenSymbols.length > 0 ? `- ${tokenSymbols.map((s) => s.toUpperCase()).join(', ')}` : ''}
					</h3>
				</div>
			</div>

			{summary.kind === 'single' ? (
				<div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
					<div className="border border-subtle p-3">
						<div className="mb-1 text-xs text-pro-text-tertiary">Total Value</div>
						<div className="text-lg font-semibold text-pro-text-primary">
							{formatUsd(totalAmount, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
						</div>
					</div>
					<div className="border border-subtle p-3">
						<div className="mb-1 text-xs text-pro-text-tertiary">Protocols</div>
						<div className="text-lg font-semibold text-pro-text-primary">{protocolCount}</div>
					</div>
					<div className="border border-subtle p-3">
						<div className="mb-1 text-xs text-pro-text-tertiary">Top Category</div>
						<div className="text-lg font-semibold text-pro-text-primary">
							{topCategories[0] ? topCategories[0][0] : '-'}
						</div>
						<div className="text-xs text-pro-text-tertiary">
							{topCategories[0] ? `${topCategories[0][1].count} protocols` : ''}
						</div>
					</div>
					<div className="border border-subtle p-3">
						<div className="mb-1 text-xs text-pro-text-tertiary">Avg per Protocol</div>
						<div className="text-lg font-semibold text-pro-text-primary">
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
									<div className="mb-1 text-xs text-pro-text-tertiary">{symbol.toUpperCase()} Value</div>
									<div className="text-lg font-semibold text-pro-text-primary">
										{formatUsd(stats.total, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}
									</div>
									<div className="text-xs text-pro-text-tertiary">{stats.protocols} protocols</div>
									<div className="mt-2">
										<div className="mb-1 flex items-center justify-between">
											<span className="text-xs text-pro-text-tertiary">Share</span>
											<span className="text-xs font-medium">
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
								<div className="mb-1 text-xs text-pro-text-tertiary">Total Combined</div>
								<div className="text-lg font-semibold text-pro-text-primary">
									{formatUsd(totalAmount, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								</div>
								<div className="text-xs text-pro-text-tertiary">All tokens</div>
							</div>
						) : null}

						{tokenSymbols.length <= 3 ? (
							<div className="border border-subtle p-3">
								<div className="mb-1 text-xs text-pro-text-tertiary">Unique Protocols</div>
								<div className="text-lg font-semibold text-pro-text-primary">{protocolCount}</div>
								<div className="text-xs text-pro-text-tertiary">
									{multiTokenProtocolCount > 0 ? `${multiTokenProtocolCount} use multiple` : 'Total count'}
								</div>
							</div>
						) : null}
					</div>

					<div className="mb-4 border border-subtle p-3">
						<div className="mb-2 text-xs text-pro-text-tertiary">Protocol Distribution</div>
						<div className="flex flex-wrap items-center gap-4">
							<div className="flex items-center gap-2">
								<div className="size-3 bg-brand" />
								<span className="text-sm">
									<span className="font-semibold">{summary.protocolOverlap.shared}</span>
									<span className="text-pro-text-tertiary"> shared</span>
									{protocolCount > 0 ? (
										<span className="text-xs text-pro-text-tertiary">
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
										<span className="text-sm">
											<span className="font-semibold">{exclusiveCount}</span>
											<span className="text-pro-text-tertiary"> {symbol.toUpperCase()} only</span>
										</span>
									</div>
								)
							})}

							<div className="ml-auto text-sm text-pro-text-tertiary">Total: {protocolCount} protocols</div>
						</div>
					</div>
				</>
			)}

			<div className="mb-3">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<h3 className="truncate text-base font-semibold text-pro-text-primary md:text-lg">
						{tokenSymbols.length === 1 && tokenSymbols[0]
							? `${tokenSymbols[0].toUpperCase()} Usage`
							: `Comparing ${tokenSymbols.map((t) => t.toUpperCase()).join(', ')}`}
					</h3>
					<div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
						{props.editable ? (
							<div className="order-2 w-full sm:order-1 sm:w-64 lg:w-96">
								<TokenSelector
									config={config}
									onConfigChange={props.onConfigChange}
									placeholder="Add or remove tokens (max 4)..."
								/>
							</div>
						) : null}
						<div className="order-1 flex items-center gap-2 sm:order-2 sm:gap-3">
							{props.editable ? (
								<button
									type="button"
									className="flex h-[38px] items-center gap-2 border border-subtle px-2 text-sm transition-colors hover:border-pro-text-tertiary sm:px-3"
									onClick={() => props.onConfigChange({ ...config, includeCex: !includeCex })}
								>
									<div className="relative size-4">
										<input type="checkbox" checked={includeCex} readOnly className="sr-only" />
										<div
											className={`size-4 border-2 transition-all ${
												includeCex ? 'border-brand bg-brand' : 'border-pro-text-tertiary bg-transparent'
											}`}
										>
											{includeCex ? (
												<svg
													className="size-3 text-on-brand"
													fill="currentColor"
													viewBox="0 0 20 20"
													aria-hidden="true"
													focusable="false"
												>
													<path
														fillRule="evenodd"
														d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
														clipRule="evenodd"
													/>
												</svg>
											) : null}
										</div>
									</div>
									<span className="text-xs font-medium whitespace-nowrap text-pro-text-primary sm:text-sm">
										Include CEXs
									</span>
								</button>
							) : null}
							<CSVExportButton
								onClick={downloadCSV}
								className="flex h-[38px] items-center gap-2 border pro-border bg-surface px-3 text-sm text-pro-text-primary transition-colors hover:bg-surface-elevated-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#070e0f]"
							/>
						</div>
					</div>
				</div>
				<div className="mt-3 flex items-center gap-2 sm:gap-4">
					<input
						placeholder="Search protocols..."
						onInput={(e) => setSearch(e.currentTarget.value)}
						className="w-full max-w-xs rounded-sm border pro-border pro-panel-bg px-2 py-1.5 text-sm text-pro-text-primary focus:ring-1 focus:ring-brand focus:outline-hidden sm:w-auto sm:px-3"
					/>
				</div>
			</div>

			<TableBody table={table} isLoading={isLoading} />
			<TablePagination
				pageSize={pagination.pageSize}
				pageIndex={pagination.pageIndex}
				pageCount={table.getPageCount()}
				canPreviousPage={table.getCanPreviousPage()}
				canNextPage={table.getCanNextPage()}
				previousPage={table.previousPage}
				nextPage={table.nextPage}
				setPageSize={table.setPageSize}
				showPageSizes={filteredData.length > 10}
			/>
		</div>
	)
}
