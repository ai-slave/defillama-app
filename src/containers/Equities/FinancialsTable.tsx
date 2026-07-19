import { useRouter } from 'next/router'
import { startTransition, useMemo, useState } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { Icon } from '~/ui/Icon'
import { tableIconHitTargetStyles } from '~/ui/IconHitTarget'
import { Panel } from '~/ui/Panel'
import { TagGroup } from '~/ui/SegmentedControl'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
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
	getAvailableEquitiesStatementOptions,
	getEquitiesStatementHeaderIndexes,
	resolveEquitiesStatementOption,
	type EquitiesStatementOption,
	type EquitiesStatementPeriodOption
} from './financialStatements'
import type { IEquitiesStatementTableRow } from './types'
import { formatEquitiesDate } from './utils'

const statementQueryValueMap: Record<EquitiesStatementOption, string> = {
	'Income Statement': 'income-statement',
	'Balance Sheet': 'balance-sheet',
	'Cash Flow': 'cash-flow'
}

const periodQueryValueMap: Record<EquitiesStatementPeriodOption, string> = {
	Quarterly: 'quarterly',
	Annual: 'annual'
}

function getStatementTypeFromQueryValue(
	value: string | undefined,
	statements: IEquitiesStatementsResponse
): EquitiesStatementOption {
	const requested = EQUITIES_STATEMENT_OPTIONS.find((option) => statementQueryValueMap[option] === value)
	return resolveEquitiesStatementOption(statements, requested ?? 'Income Statement')
}

function getPeriodTypeFromQueryValue(value?: string): EquitiesStatementPeriodOption {
	const periodType = EQUITIES_STATEMENT_PERIOD_OPTIONS.find((option) => periodQueryValueMap[option] === value)
	return periodType ?? 'Quarterly'
}

export function getStatementHeaderIndexes(periodEnding: string[]): number[] {
	return getEquitiesStatementHeaderIndexes(periodEnding)
}

function formatStatementPeriodLabel(periodEnding: string): string {
	return formatEquitiesDate(periodEnding)
}

function FinancialRow({
	row,
	headerIndexes,
	showExpandPlaceholder
}: {
	row: IEquitiesStatementTableRow
	headerIndexes: number[]
	showExpandPlaceholder: boolean
}) {
	const hasSubRows = Boolean(row.subRows?.length)
	const [isExpanded, setIsExpanded] = useState(true)

	return (
		<>
			<tr className="group">
				<th className="group-hover-wash w-[28%] truncate border border-subtle bg-surface p-2 text-left font-semibold">
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
								className={tableIconHitTargetStyles}
							>
								<Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} height={14} width={14} />
							</button>
						) : showExpandPlaceholder ? (
							<span aria-hidden="true" className="-ml-1 block size-5 shrink-0" />
						) : null}
						<span className="truncate">{row.label}</span>
					</div>
				</th>
				{headerIndexes.map((index) => (
					<td
						key={`${row.id}-${index}`}
						className="group-hover-wash truncate border border-subtle p-2 text-left font-medium"
					>
						{formatEquitiesStatementCellValue(row.label, row.values[index] ?? null)}
					</td>
				))}
			</tr>
			{hasSubRows && isExpanded
				? row.subRows?.map((subRow) => (
						<tr key={subRow.id} className="group text-secondary">
							<th className="group-hover-wash w-[28%] truncate border border-subtle bg-surface p-2 pl-9 text-left font-normal italic">
								<span className="truncate">{subRow.label}</span>
							</th>
							{headerIndexes.map((index) => (
								<td
									key={`${subRow.id}-${index}`}
									className="group-hover-wash truncate border border-subtle p-2 text-left font-normal"
								>
									{formatEquitiesStatementCellValue(subRow.label, subRow.values[index] ?? null)}
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
	const availableStatementOptions = useMemo(() => getAvailableEquitiesStatementOptions(statements), [statements])
	const statementType = useMemo<EquitiesStatementOption>(() => {
		return getStatementTypeFromQueryValue(statementQueryValue, statements)
	}, [statementQueryValue, statements])
	const periodType = useMemo<EquitiesStatementPeriodOption>(() => {
		return getPeriodTypeFromQueryValue(periodQueryValue)
	}, [periodQueryValue])

	const section = statements[equitiesStatementSectionMap[statementType]]!
	const periodData = section[equitiesStatementPeriodMap[periodType]]
	const rows = useMemo(
		() => buildEquitiesStatementRows(statements, statementType, periodType),
		[statements, statementType, periodType]
	)
	const headerIndexes = useMemo(() => getStatementHeaderIndexes(periodData.periodEnding), [periodData.periodEnding])
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
		const headers = ['Name']
		for (const index of headerIndexes) {
			headers.push(formatStatementPeriodLabel(periodData.periodEnding[index]))
		}
		const flattenedRows = flattenEquitiesStatementRows(rows)
		const csvRows: Array<Array<string | number>> = []
		for (const row of flattenedRows) {
			const csvRow: Array<string | number> = [row.depth > 0 ? `  ${row.label}` : row.label]
			for (const index of headerIndexes) {
				csvRow.push(row.values[index] ?? '')
			}
			csvRows.push(csvRow)
		}

		return {
			filename: `equities-${statementType.toLowerCase().replaceAll(' ', '-')}-${periodType.toLowerCase()}`,
			rows: [headers, ...csvRows]
		}
	}

	return (
		<Panel padding="none" className="col-span-full">
			<TableToolbar className="justify-between">
				<h2 className="label-md">Financials</h2>
				<TableToolbarControlGroup className="ml-auto">
					<TagGroup
						variant="default"
						size="md"
						selectedValue={statementType}
						setValue={(value) => startTransition(() => setStatementType(value))}
						values={availableStatementOptions}
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
							{headerIndexes.map((index, position) => {
								let tooltipContent = `Ends at ${periodData.periodEnding[index]}`
								const previousIndex = headerIndexes[position + 1]

								if (previousIndex !== undefined) {
									const startDate = new Date(`${periodData.periodEnding[previousIndex]}T00:00:00Z`)
									startDate.setUTCDate(startDate.getUTCDate() + 1)
									tooltipContent = `From ${startDate.toISOString().slice(0, 10)} till ${periodData.periodEnding[index]}`
								}

								return (
									<th
										key={`${statementType}-${periodType}-${periodData.periodEnding[index]}`}
										className="min-w-[132px] truncate border border-subtle bg-page p-2 text-left font-medium"
									>
										<Tooltip content={tooltipContent}>
											<span className="underline decoration-dotted underline-offset-3">
												{formatStatementPeriodLabel(periodData.periodEnding[index])}
											</span>
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
								headerIndexes={headerIndexes}
								showExpandPlaceholder={hasAnyBreakdownRows}
							/>
						))}
					</tbody>
				</table>
			</div>
		</Panel>
	)
}
