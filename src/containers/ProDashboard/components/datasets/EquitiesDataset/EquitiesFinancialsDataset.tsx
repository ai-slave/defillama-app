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
import { SegmentedControl } from '~/ui/SegmentedControl'
import type { CsvCell } from '~/utils/csvCell'
import { formatDate } from '~/utils/dateFormat'
import { downloadCSV } from '~/utils/download'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import { CSVExportButton } from '../../CSVExportButton'
import { ProCardEmpty, ProCardError, ProCardLoading, ProCardRefreshFailed } from '../../ProCardStatus'

const STATEMENT_OPTIONS = EQUITIES_STATEMENT_OPTIONS.map((option) => ({ value: option, label: option }))
const PERIOD_OPTIONS = EQUITIES_STATEMENT_PERIOD_OPTIONS.map((option) => ({ value: option, label: option }))

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
				<th className="w-[28%] truncate border border-medium bg-surface p-2 text-left font-semibold group-hover:bg-hover-row">
					{hasSubRows ? (
						<button
							type="button"
							aria-expanded={isExpanded}
							onClick={(event) => {
								event.stopPropagation()
								setIsExpanded((expanded) => !expanded)
							}}
							className="-ml-1 flex w-full items-center gap-1 rounded-sm text-left text-secondary hover:bg-hover-row focus-visible:bg-hover-row"
						>
							<Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} height={14} width={14} className="shrink-0" />
							<span className="truncate">{row.label}</span>
						</button>
					) : (
						<div className="flex items-center gap-1">
							{showExpandPlaceholder ? <span aria-hidden="true" className="-ml-1 block size-5 shrink-0" /> : null}
							<span className="truncate">{row.label}</span>
						</div>
					)}
				</th>
				{headers.map((header) => (
					<td
						key={`${row.id}-${header.index}`}
						className="truncate border border-medium p-2 text-left font-medium group-hover:bg-hover-row"
					>
						{formatEquitiesStatementCellValue(row.label, getEquitiesStatementValue(row, header))}
					</td>
				))}
			</tr>
			{hasSubRows && isExpanded
				? row.subRows?.map((subRow) => (
						<tr key={subRow.id} className="group text-secondary">
							<th className="w-[28%] truncate border border-medium bg-surface p-2 pl-9 text-left font-normal italic group-hover:bg-hover-row">
								<span className="truncate">{subRow.label}</span>
							</th>
							{headers.map((header) => (
								<td
									key={`${subRow.id}-${header.index}`}
									className="truncate border border-medium p-2 text-left font-normal group-hover:bg-hover-row"
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

	const query = useQuery({
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
		query,
		isLoading: query.isLoading || (tickerCountry !== null && !streamDone && query.data === undefined)
	}
}

export function EquitiesFinancialsDataset({ ticker }: { ticker: string }) {
	const [statementType, setStatementType] = useState<EquitiesStatementOption>('Income Statement')
	const [periodType, setPeriodType] = useState<EquitiesStatementPeriodOption>('Quarterly')

	const { query: statementsQuery, isLoading } = useEquitiesStatementsData(ticker)
	const statements = statementsQuery.data

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
			<div className="flex size-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col justify-center">
					<ProCardEmpty message="No ticker specified." />
				</div>
			</div>
		)
	}

	if (queryReadFailed(statementsQuery)) {
		return (
			<div className="flex size-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col justify-center">
					<ProCardError title="Couldn't load financial statements" retry={statementsQuery} />
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex size-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading variant="table" label="Loading financial statements" />
				</div>
			</div>
		)
	}

	// The read is disabled without a proxy token (a viewer without Pro on a public dashboard), so nothing failed.
	if (!statements) {
		return (
			<div className="flex size-full flex-col">
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col justify-center">
					<ProCardEmpty message="No financial statements to show." />
				</div>
			</div>
		)
	}

	return (
		<div className="flex size-full flex-col">
			<div className="mb-3">
				<div className="flex flex-wrap items-center justify-end gap-4">
					<div className="flex flex-wrap items-center justify-end gap-2">
						<SegmentedControl<EquitiesStatementOption>
							label="Statement"
							variant="default"
							size="sm"
							value={statementType}
							onValueChange={setStatementType}
							options={STATEMENT_OPTIONS}
						/>
						<SegmentedControl<EquitiesStatementPeriodOption>
							label="Period"
							variant="default"
							size="sm"
							value={periodType}
							onValueChange={setPeriodType}
							options={PERIOD_OPTIONS}
						/>
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
			{queryRefreshFailed(statementsQuery) ? <ProCardRefreshFailed retry={statementsQuery} /> : null}
			<div className="overflow-x-auto">
				<table className="w-full border-collapse body-md">
					<thead>
						<tr>
							<th className="min-w-[220px] truncate border border-medium bg-page p-2 text-left font-semibold">Name</th>
							{statementHeaders.map((header) => (
								<th
									key={`${statementType}-${periodType}-${header.periodEnding}`}
									className="min-w-[132px] truncate border border-medium bg-page p-2 text-left font-semibold"
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
