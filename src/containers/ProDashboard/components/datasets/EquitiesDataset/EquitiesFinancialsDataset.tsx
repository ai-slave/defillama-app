import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { useContext, useMemo, useState } from 'react'
import { formatEquitiesStatementCellValue } from '~/containers/Equities/financialsFormatting'
import {
	buildEquitiesStatementRows,
	EQUITIES_STATEMENT_OPTIONS,
	EQUITIES_STATEMENT_PERIOD_OPTIONS,
	equitiesStatementPeriodMap,
	equitiesStatementSectionMap,
	flattenEquitiesStatementRows,
	getEquitiesStatementHeaders,
	getEquitiesStatementValue,
	type EquitiesStatementHeader,
	type EquitiesStatementOption,
	type EquitiesStatementPeriodOption
} from '~/containers/Equities/financialStatements'
import { parseEquityTickerCountryParam } from '~/containers/Equities/tickerCountry'
import type { IEquitiesStatementTableRow } from '~/containers/Equities/types'
import { getEquitiesTableQueryKey } from '~/containers/ProDashboard/equitiesTableQueryKeys'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchProDashboardProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import { getProEquitiesStatementsCacheKey } from '~/containers/ProDashboard/tableQueryKeys'
import { Icon } from '~/ui/Icon'
import type { CsvCell } from '~/utils/csvCell'
import { formatDate } from '~/utils/dateFormat'
import { downloadCSV } from '~/utils/download'
import { CSVExportButton } from '../../CSVExportButton'
import { LoadingSpinner } from '../../LoadingSpinner'

function formatStatementPeriodLabel(periodEnding: string): string {
	return formatDate(periodEnding) ?? '-'
}

function FinancialRow({
	row,
	headers,
	showExpandPlaceholder
}: {
	row: IEquitiesStatementTableRow
	headers: Array<EquitiesStatementHeader>
	showExpandPlaceholder: boolean
}) {
	const hasSubRows = Boolean(row.subRows?.length)
	const [isExpanded, setIsExpanded] = useState(true)

	return (
		<>
			<tr className="group">
				<th className="w-[28%] truncate border border-medium bg-pro-cards-bg p-2 text-left font-semibold group-hover:bg-pro-link-hover-bg">
					<div
						className="flex items-center gap-1"
						onClick={(event) => {
							if (!hasSubRows) return
							event.stopPropagation()
							setIsExpanded((expanded) => !expanded)
						}}
					>
						{hasSubRows ? (
							<button
								type="button"
								aria-expanded={isExpanded}
								aria-label={`${isExpanded ? 'Hide' : 'Show'} ${row.label} breakdown`}
								onClick={(event) => {
									event.stopPropagation()
									setIsExpanded((expanded) => !expanded)
								}}
								className="-ml-1 flex size-5 shrink-0 items-center justify-center rounded-sm text-pro-text-secondary transition-transform hover:bg-pro-link-hover-bg focus-visible:bg-pro-link-hover-bg"
							>
								<Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} height={14} width={14} />
							</button>
						) : showExpandPlaceholder ? (
							<span aria-hidden="true" className="-ml-1 block size-5 shrink-0" />
						) : null}
						<span className="truncate">{row.label}</span>
					</div>
				</th>
				{headers.map((header) => (
					<td
						key={`${row.id}-${header.index}`}
						className="truncate border border-medium p-2 text-left font-medium group-hover:bg-pro-link-hover-bg"
					>
						{formatEquitiesStatementCellValue(row.label, getEquitiesStatementValue(row, header))}
					</td>
				))}
			</tr>
			{hasSubRows && isExpanded
				? row.subRows?.map((subRow) => (
						<tr key={subRow.id} className="group text-pro-text-secondary">
							<th className="w-[28%] truncate border border-medium bg-pro-cards-bg p-2 pl-9 text-left font-normal italic group-hover:bg-pro-link-hover-bg">
								<span className="truncate">{subRow.label}</span>
							</th>
							{headers.map((header) => (
								<td
									key={`${subRow.id}-${header.index}`}
									className="truncate border border-medium p-2 text-left font-normal group-hover:bg-pro-link-hover-bg"
								>
									{formatEquitiesStatementCellValue(subRow.label, getEquitiesStatementValue(subRow, header))}
								</td>
							))}
						</tr>
					))
				: null}
		</>
	)
}

const STALE_TIME = 5 * 60 * 1000

function useEquitiesStatementsData(ticker: string) {
	const authToken = useContext(ProxyAuthTokenContext)
	const streamDone = useContext(StreamDoneContext)
	const tickerCountry = parseEquityTickerCountryParam(ticker)

	const { data, isLoading, error } = useQuery({
		queryKey: getEquitiesTableQueryKey('statements', ticker) ?? getProEquitiesStatementsCacheKey(ticker),
		queryFn: async () => {
			if (!tickerCountry) throw new Error('Missing ticker param')
			if (!authToken) throw new Error('Missing Pro dashboard proxy auth token')
			return fetchProDashboardProxy(
				'equitiesStatements',
				{ ticker: tickerCountry.ticker, country: tickerCountry.country },
				authToken
			)
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: Boolean(tickerCountry) && Boolean(authToken) && streamDone
	})
	return {
		data,
		isLoading: isLoading || (tickerCountry !== null && !streamDone && data === undefined),
		error
	}
}

export function EquitiesFinancialsDataset({ ticker }: { ticker: string }) {
	const [statementType, setStatementType] = useState<EquitiesStatementOption>('Income Statement')
	const [periodType, setPeriodType] = useState<EquitiesStatementPeriodOption>('Quarterly')

	const { data: statements, isLoading, error } = useEquitiesStatementsData(ticker)

	const section = statements ? statements[equitiesStatementSectionMap[statementType]] : null
	const periodData = section ? section[equitiesStatementPeriodMap[periodType]] : null

	const rows = useMemo(
		() => (statements ? buildEquitiesStatementRows(statements, statementType, periodType) : []),
		[statements, statementType, periodType]
	)

	const statementHeaders = useMemo(
		() => (periodData ? getEquitiesStatementHeaders(periodData.periodEnding) : []),
		[periodData]
	)

	const hasAnyBreakdownRows = rows.some((row) => (row.subRows?.length ?? 0) > 0)

	if (!ticker) {
		return (
			<div className="flex size-full flex-col p-4">
				<div className="mb-3">
					<h3 className="text-lg font-semibold text-pro-text-primary">Equities Financials</h3>
				</div>
				<div className="flex min-h-[500px] flex-1 items-center justify-center">
					<div className="text-center text-pro-text-secondary">No ticker specified</div>
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex size-full flex-col p-4">
				<div className="mb-3">
					<h3 className="text-lg font-semibold text-pro-text-primary">Financials — {ticker}</h3>
				</div>
				<div className="flex min-h-[500px] flex-1 flex-col items-center justify-center gap-4">
					<LoadingSpinner />
					<p className="text-sm text-pro-text-secondary">Loading financial statements...</p>
				</div>
			</div>
		)
	}

	if (error || !statements) {
		return (
			<div className="flex size-full flex-col p-4">
				<div className="mb-3">
					<h3 className="text-lg font-semibold text-pro-text-primary">Financials — {ticker}</h3>
				</div>
				<div className="flex min-h-[500px] flex-1 items-center justify-center">
					<div className="text-center text-pro-text-secondary">Failed to load financial statements</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex size-full flex-col p-4">
			<div className="mb-3">
				<div className="flex flex-wrap items-center justify-end gap-4">
					<h3 className="mr-auto text-lg font-semibold text-pro-text-primary">Financials — {ticker}</h3>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<div className="flex items-center gap-1 rounded-md border pro-border p-0.5">
							{EQUITIES_STATEMENT_OPTIONS.map((option) => (
								<button
									key={option}
									type="button"
									onClick={() => setStatementType(option)}
									className={`rounded-sm px-2 py-1 text-xs font-medium transition ${
										statementType === option
											? 'bg-brand/10 text-brand'
											: 'text-pro-text-secondary hover:text-pro-text-primary'
									}`}
								>
									{option}
								</button>
							))}
						</div>
						<div className="flex items-center gap-1 rounded-md border pro-border p-0.5">
							{EQUITIES_STATEMENT_PERIOD_OPTIONS.map((option) => (
								<button
									key={option}
									type="button"
									onClick={() => setPeriodType(option)}
									className={`rounded-sm px-2 py-1 text-xs font-medium transition ${
										periodType === option
											? 'bg-brand/10 text-brand'
											: 'text-pro-text-secondary hover:text-pro-text-primary'
									}`}
								>
									{option}
								</button>
							))}
						</div>
						<CSVExportButton
							onClick={() => {
								const headers: Array<CsvCell> = ['Name']
								for (const header of statementHeaders) {
									headers.push(formatStatementPeriodLabel(header.periodEnding))
								}
								const flattenedRows = flattenEquitiesStatementRows(rows)
								const csv: Array<Array<CsvCell>> = [headers]
								for (const row of flattenedRows) {
									const csvRow: Array<CsvCell> = [row.depth > 0 ? `  ${row.label}` : row.label]
									for (const header of statementHeaders) {
										csvRow.push(getEquitiesStatementValue(row, header))
									}
									csv.push(csvRow)
								}
								downloadCSV(
									`equities-${ticker}-${statementType.toLowerCase().replaceAll(' ', '-')}-${periodType.toLowerCase()}.csv`,
									csv,
									{ addTimestamp: true }
								)
							}}
							smol
						/>
					</div>
				</div>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr>
							<th className="min-w-[220px] truncate border border-medium bg-pro-app-bg p-2 text-left font-semibold">
								Name
							</th>
							{statementHeaders.map((header) => (
								<th
									key={`${statementType}-${periodType}-${header.periodEnding}`}
									className="min-w-[132px] truncate border border-medium bg-pro-app-bg p-2 text-left font-semibold"
								>
									{formatStatementPeriodLabel(header.periodEnding)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<FinancialRow
								key={row.id}
								row={row}
								headers={statementHeaders}
								showExpandPlaceholder={hasAnyBreakdownRows}
							/>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
