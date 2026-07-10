import { useRouter } from 'next/router'
import { startTransition, useMemo, useState } from 'react'
import { CSVDownloadButton } from '~/components/ButtonStyled/CsvButton'
import { Icon } from '~/components/Icon'
import { TagGroup } from '~/components/TagGroup'
import { tableIconHitTargetStyles } from '~/ui/IconHitTarget'
import { Panel } from '~/ui/Panel'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import type { IEquitiesStatementsResponse } from './api.types'
import { formatEquitiesStatementCellValue } from './financialsFormatting'
import type { IEquitiesStatementTableRow } from './types'
import { formatEquitiesDate } from './utils'

const STATEMENT_OPTIONS = ['Income Statement', 'Balance Sheet', 'Cash Flow'] as const
const PERIOD_OPTIONS = ['Quarterly', 'Annual'] as const

type StatementOption = (typeof STATEMENT_OPTIONS)[number]
type PeriodOption = (typeof PERIOD_OPTIONS)[number]
type StatementSectionKey = 'incomeStatement' | 'balanceSheet' | 'cashflow'
type StatementPeriodKey = 'quarterly' | 'annual'

const statementSectionMap: Record<StatementOption, StatementSectionKey> = {
	'Income Statement': 'incomeStatement',
	'Balance Sheet': 'balanceSheet',
	'Cash Flow': 'cashflow'
}

const statementQueryValueMap: Record<StatementOption, string> = {
	'Income Statement': 'income-statement',
	'Balance Sheet': 'balance-sheet',
	'Cash Flow': 'cash-flow'
}

const periodKeyMap: Record<PeriodOption, StatementPeriodKey> = {
	Quarterly: 'quarterly',
	Annual: 'annual'
}

const periodQueryValueMap: Record<PeriodOption, string> = {
	Quarterly: 'quarterly',
	Annual: 'annual'
}

function getStatementTypeFromQueryValue(value?: string): StatementOption {
	const statementType = STATEMENT_OPTIONS.find((option) => statementQueryValueMap[option] === value)
	return statementType ?? 'Income Statement'
}

function getPeriodTypeFromQueryValue(value?: string): PeriodOption {
	const periodType = PERIOD_OPTIONS.find((option) => periodQueryValueMap[option] === value)
	return periodType ?? 'Quarterly'
}

function buildStatementRows(
	statements: IEquitiesStatementsResponse,
	statementType: StatementOption,
	periodType: PeriodOption
): IEquitiesStatementTableRow[] {
	const section = statements[statementSectionMap[statementType]]
	const periodData = section[periodKeyMap[periodType]]
	const childrenMeta = section.children[periodKeyMap[periodType]]
	const rows: IEquitiesStatementTableRow[] = []

	for (let rowIndex = 0; rowIndex < section.labels.length; rowIndex++) {
		const label = section.labels[rowIndex]
		const childLabels = childrenMeta[label]?.labels ?? []
		const childValues = periodData.children[label]?.values ?? []
		let subRows: IEquitiesStatementTableRow[] | undefined

		if (childLabels.length > 0) {
			subRows = []
			for (let childIndex = 0; childIndex < childLabels.length; childIndex++) {
				const childLabel = childLabels[childIndex]
				subRows.push({
					id: `${label}-${childLabel}`,
					label: childLabel,
					values: childValues[childIndex] ?? [],
					depth: 1
				})
			}
		}

		rows.push({
			id: label,
			label,
			values: periodData.values[rowIndex] ?? [],
			depth: 0,
			subRows
		})
	}

	return rows
}

export function getStatementHeaderIndexes(periodEnding: string[]): number[] {
	const indexes: number[] = []
	for (let index = 0; index < periodEnding.length; index++) {
		indexes.push(index)
	}
	return indexes.sort((a, b) => {
		const aTime = new Date(`${periodEnding[a] ?? ''}T00:00:00Z`).getTime()
		const bTime = new Date(`${periodEnding[b] ?? ''}T00:00:00Z`).getTime()
		return bTime - aTime
	})
}

function formatStatementPeriodLabel(periodEnding: string): string {
	return formatEquitiesDate(periodEnding)
}

function flattenStatementRows(rows: IEquitiesStatementTableRow[]): IEquitiesStatementTableRow[] {
	const flattened: IEquitiesStatementTableRow[] = []

	for (const row of rows) {
		flattened.push(row)
		if (row.subRows?.length) {
			flattened.push(...row.subRows)
		}
	}

	return flattened
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
				<th className="group-hover-wash w-[28%] overflow-hidden border border-subtle bg-surface p-2 text-left font-semibold text-ellipsis whitespace-nowrap">
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
						<span className="overflow-hidden text-ellipsis whitespace-nowrap">{row.label}</span>
					</div>
				</th>
				{headerIndexes.map((index) => (
					<td
						key={`${row.id}-${index}`}
						className="group-hover-wash overflow-hidden border border-subtle p-2 text-left font-medium text-ellipsis whitespace-nowrap"
					>
						{formatEquitiesStatementCellValue(row.label, row.values[index] ?? null)}
					</td>
				))}
			</tr>
			{hasSubRows && isExpanded
				? row.subRows?.map((subRow) => (
						<tr key={subRow.id} className="group text-secondary">
							<th className="group-hover-wash w-[28%] overflow-hidden border border-subtle bg-surface p-2 pl-9 text-left font-normal text-ellipsis whitespace-nowrap italic">
								<span className="overflow-hidden text-ellipsis whitespace-nowrap">{subRow.label}</span>
							</th>
							{headerIndexes.map((index) => (
								<td
									key={`${subRow.id}-${index}`}
									className="group-hover-wash overflow-hidden border border-subtle p-2 text-left font-normal text-ellipsis whitespace-nowrap"
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
	const statementType = useMemo<StatementOption>(() => {
		return getStatementTypeFromQueryValue(statementQueryValue)
	}, [statementQueryValue])
	const periodType = useMemo<PeriodOption>(() => {
		return getPeriodTypeFromQueryValue(periodQueryValue)
	}, [periodQueryValue])

	const section = statements[statementSectionMap[statementType]]
	const periodData = section[periodKeyMap[periodType]]
	const rows = useMemo(
		() => buildStatementRows(statements, statementType, periodType),
		[statements, statementType, periodType]
	)
	const headerIndexes = useMemo(() => getStatementHeaderIndexes(periodData.periodEnding), [periodData.periodEnding])
	const hasAnyBreakdownRows = rows.some((row) => (row.subRows?.length ?? 0) > 0)
	const setStatementType = (value: StatementOption) => {
		void pushShallowQuery(router, {
			'financials-table': value === 'Income Statement' ? undefined : statementQueryValueMap[value]
		})
	}
	const setPeriodType = (value: PeriodOption) => {
		void pushShallowQuery(router, {
			'financials-timeframe': value === 'Quarterly' ? undefined : periodQueryValueMap[value]
		})
	}
	const prepareCsv = () => {
		const headers = ['Name']
		for (const index of headerIndexes) {
			headers.push(formatStatementPeriodLabel(periodData.periodEnding[index]))
		}
		const flattenedRows = flattenStatementRows(rows)
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
						values={STATEMENT_OPTIONS}
					/>
					<TagGroup
						variant="default"
						size="md"
						selectedValue={periodType}
						setValue={(value) => startTransition(() => setPeriodType(value))}
						values={PERIOD_OPTIONS}
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
							<th className="min-w-[220px] overflow-hidden border border-subtle bg-page p-2 text-left font-medium text-ellipsis whitespace-nowrap">
								Name
							</th>
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
										className="min-w-[132px] overflow-hidden border border-subtle bg-page p-2 text-left font-medium text-ellipsis whitespace-nowrap"
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
