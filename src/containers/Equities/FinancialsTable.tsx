import { useRouter } from 'next/router'
import { startTransition, useMemo, useState } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { TagGroup } from '~/ui/SegmentedControl'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { formatDate } from '~/utils/dateFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import type { IEquitiesStatementsResponse } from './api.types'
import { formatEquitiesStatementCellValue } from './financialsFormatting'
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
} from './financialStatements'
import type { IEquitiesStatementTableRow } from './types'

const statementQueryValueMap: Record<EquitiesStatementOption, string> = {
	'Income Statement': 'income-statement',
	'Balance Sheet': 'balance-sheet',
	'Cash Flow': 'cash-flow'
}

const periodQueryValueMap: Record<EquitiesStatementPeriodOption, string> = {
	Quarterly: 'quarterly',
	Annual: 'annual'
}

function getStatementTypeFromQueryValue(value: string | undefined): EquitiesStatementOption {
	const requested = EQUITIES_STATEMENT_OPTIONS.find((option) => statementQueryValueMap[option] === value)
	return requested ?? 'Income Statement'
}

function getPeriodTypeFromQueryValue(value?: string): EquitiesStatementPeriodOption {
	const periodType = EQUITIES_STATEMENT_PERIOD_OPTIONS.find((option) => periodQueryValueMap[option] === value)
	return periodType ?? 'Quarterly'
}

export function getStatementHeaders(periodEnding: Array<string>): Array<EquitiesStatementHeader> {
	return getEquitiesStatementHeaders(periodEnding)
}

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
				<th className="group-hover-wash w-[28%] truncate border border-subtle bg-surface p-2 text-left font-semibold">
					{hasSubRows ? (
						<Button
							size="sm"
							variant="ghost"
							type="button"
							aria-expanded={isExpanded}
							onClick={(event) => {
								event.stopPropagation()
								setIsExpanded((expanded) => !expanded)
							}}
							className="-m-1 flex w-full items-center gap-1 text-left font-semibold"
						>
							<Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} height={14} width={14} />
							<span className="truncate">{row.label}</span>
						</Button>
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
						className="group-hover-wash truncate border border-subtle p-2 text-left font-medium"
					>
						{formatEquitiesStatementCellValue(row.label, getEquitiesStatementValue(row, header))}
					</td>
				))}
			</tr>
			{hasSubRows && isExpanded
				? row.subRows?.map((subRow) => (
						<tr key={subRow.id} className="group text-secondary">
							<th className="group-hover-wash w-[28%] truncate border border-subtle bg-surface p-2 pl-9 text-left font-normal italic">
								<span className="truncate">{subRow.label}</span>
							</th>
							{headers.map((header) => (
								<td
									key={`${subRow.id}-${header.index}`}
									className="group-hover-wash truncate border border-subtle p-2 text-left font-normal"
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

export function EquitiesFinancialsTable({ statements }: { statements: IEquitiesStatementsResponse }) {
	const router = useRouter()
	const statementQueryValue = readSingleQueryValue(router.query['financials-table'])
	const periodQueryValue = readSingleQueryValue(router.query['financials-timeframe'])
	const statementType: EquitiesStatementOption = getStatementTypeFromQueryValue(statementQueryValue)
	const periodType: EquitiesStatementPeriodOption = getPeriodTypeFromQueryValue(periodQueryValue)

	const section = statements[equitiesStatementSectionMap[statementType]]
	const periodData = section[equitiesStatementPeriodMap[periodType]]
	const rows = useMemo(
		() => buildEquitiesStatementRows(statements, statementType, periodType),
		[statements, statementType, periodType]
	)
	const statementHeaders = useMemo(() => getStatementHeaders(periodData.periodEnding), [periodData.periodEnding])
	const hasAnyBreakdownRows = rows.some((row) => (row.subRows?.length ?? 0) > 0)
	const setStatementType = (value: EquitiesStatementOption) => {
		void pushShallowQuery(router, {
			'financials-table': value === 'Income Statement' ? undefined : statementQueryValueMap[value]
		})
	}
	const setPeriodType = (value: EquitiesStatementPeriodOption) => {
		void pushShallowQuery(router, {
			'financials-timeframe': value === 'Quarterly' ? undefined : periodQueryValueMap[value]
		})
	}
	const prepareCsv = () => {
		const csvHeaders = ['Name']
		for (const header of statementHeaders) {
			csvHeaders.push(formatStatementPeriodLabel(header.periodEnding))
		}
		const flattenedRows = flattenEquitiesStatementRows(rows)
		const csvRows: Array<Array<string | number>> = []
		for (const row of flattenedRows) {
			const csvRow: Array<string | number> = [row.depth > 0 ? `  ${row.label}` : row.label]
			for (const header of statementHeaders) {
				csvRow.push(getEquitiesStatementValue(row, header) ?? '')
			}
			csvRows.push(csvRow)
		}

		return {
			filename: `equities-${statementType.toLowerCase().replaceAll(' ', '-')}-${periodType.toLowerCase()}`,
			rows: [csvHeaders, ...csvRows]
		}
	}

	return (
		<Panel padding="none" className="col-span-full">
			<TableToolbar>
				<h2 className="label-md">Financials</h2>
				<TableToolbarControlGroup className="ml-auto">
					<TagGroup
						variant="default"
						size="md"
						selectedValue={statementType}
						setValue={(value) => startTransition(() => setStatementType(value))}
						values={EQUITIES_STATEMENT_OPTIONS}
					/>
					<TagGroup
						variant="default"
						size="md"
						selectedValue={periodType}
						setValue={(value) => startTransition(() => setPeriodType(value))}
						values={EQUITIES_STATEMENT_PERIOD_OPTIONS}
					/>
					<CSVDownloadButton prepareCsv={prepareCsv} smol size="md" />
				</TableToolbarControlGroup>
			</TableToolbar>

			<div className="relative overflow-x-auto">
				<div className="pointer-events-none sticky left-0 z-0 h-0 w-full max-sm:hidden" style={{ top: '50%' }}>
					<img
						src="/assets/defillama-dark-neutral.webp"
						alt="defillama"
						height={53}
						width={155}
						className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 dark:hidden"
					/>
					<img
						src="/assets/defillama-light-neutral.webp"
						alt="defillama"
						height={53}
						width={155}
						className="absolute left-1/2 hidden -translate-x-1/2 -translate-y-1/2 opacity-30 dark:block"
					/>
				</div>
				<table className="z-10 w-full border-collapse text-sm">
					<thead>
						<tr>
							<th className="min-w-[220px] truncate border border-subtle bg-page p-2 text-left font-medium">Name</th>
							{statementHeaders.map((header, position) => {
								let tooltipContent = `Ends at ${header.periodEnding}`
								const previousHeader = statementHeaders[position + 1]

								if (previousHeader !== undefined) {
									const startDate = new Date(`${previousHeader.periodEnding}T00:00:00Z`)
									startDate.setUTCDate(startDate.getUTCDate() + 1)
									tooltipContent = `From ${startDate.toISOString().slice(0, 10)} till ${header.periodEnding}`
								}

								return (
									<th
										key={`${statementType}-${periodType}-${header.periodEnding}`}
										className="min-w-[132px] truncate border border-subtle bg-page p-2 text-left font-medium"
									>
										<Tooltip className="underline decoration-dotted underline-offset-3" content={tooltipContent}>
											{formatStatementPeriodLabel(header.periodEnding)}
										</Tooltip>
									</th>
								)
							})}
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
		</Panel>
	)
}
