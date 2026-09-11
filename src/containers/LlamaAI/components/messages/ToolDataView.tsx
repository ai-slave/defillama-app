import { useEffect, useRef, type ReactNode } from 'react'
import {
	CODE_BLOCK,
	DATA_TABLE,
	DATA_TABLE_CELL,
	DATA_TABLE_HEAD,
	DATA_TABLE_WRAPPER
} from '~/containers/LlamaAI/components/codeBlockStyles'
import { getOwnRegistryValue } from '~/containers/LlamaAI/utils/getOwnRegistryValue'
import { formatPercent } from '~/utils/numberFormat'
import { formatCellValue, humanizeColumn, type CitedCell } from './citationPillHelpers'

type ToolDataRenderer = (data: Record<string, any>) => ReactNode | null

const TOOL_DATA_RENDERERS = {
	resolve_entity: (data) => {
		const results = data.results || (data.topMatch ? { _single: data } : null)
		if (!results) return null
		return (
			<div className="flex flex-col gap-0.5 rounded-lg border border-medium bg-surface-elevated-1 p-2">
				{Object.entries(results).map(([term, value]: [string, any]) => (
					<div key={term} className="flex items-center gap-2 body-sm">
						{term !== '_single' ? <span className="font-medium text-secondary">{term}:</span> : null}
						{value.topMatch ? (
							<span className="text-primary">
								{value.topMatch.slug}{' '}
								<span className="text-tertiary">
									({value.topMatch.type},{' '}
									{formatPercent(value.topMatch.confidence, { input: 'fraction', maximumFractionDigits: 0 })})
								</span>
								{value.matchCount > 1 ? <span className="text-tertiary"> +{value.matchCount - 1} more</span> : null}
							</span>
						) : (
							<span className="text-tertiary">no match</span>
						)}
					</div>
				))}
			</div>
		)
	},
	generate_chart: (data) => {
		if (!data.charts) return null
		return (
			<div className="flex flex-col gap-0.5 rounded-lg border border-medium bg-surface-elevated-1 p-2">
				{data.charts.map((chart: any) => (
					<div key={chart.id} className="body-sm text-primary">
						<span className="font-medium">{chart.title}</span>{' '}
						<span className="text-tertiary">
							({chart.type}, {chart.seriesCount} series)
						</span>
					</div>
				))}
			</div>
		)
	},
	execute_code: (data) => (data.logs?.length ? <pre className={CODE_BLOCK}>{data.logs.join('\n')}</pre> : null),
	load_skill: (data) => (
		<div className="body-sm text-secondary">
			<span className="font-medium">{data.skill}</span>
			{data.unlockedTools?.length > 0 ? (
				<span className="text-tertiary"> - unlocked: {data.unlockedTools.join(', ')}</span>
			) : null}
		</div>
	),
	spawn_agent: (data) => {
		if (!data.agents) return null
		return (
			<div className="flex flex-col gap-0.5 rounded-lg border border-medium bg-surface-elevated-1 p-2">
				{data.agents.map((agent: any) => (
					<div key={agent.id} className="body-sm text-primary">
						Agent {agent.id.slice(0, 6)}{' '}
						<span className="text-tertiary">
							({agent.toolCalls} tool calls{agent.chartCount > 0 ? `, ${agent.chartCount} charts` : ''})
						</span>
					</div>
				))}
			</div>
		)
	},
	web_search: (data) => <span className="body-sm text-tertiary">{data.citationCount} sources</span>,
	x_search: (data) => <span className="body-sm text-tertiary">{data.tweetCount} tweets</span>
} satisfies Record<string, ToolDataRenderer>

export function ToolDataView({ name, data }: { name: string; data: Record<string, any> }) {
	return getOwnRegistryValue(TOOL_DATA_RENDERERS, name)?.(data) ?? null
}

export function CitationRowsTable({
	rows,
	columns,
	citedCell
}: {
	rows?: Array<Record<string, unknown>>
	columns?: Array<string>
	citedCell?: CitedCell | null
}) {
	const scrollContainerRef = useRef<HTMLDivElement | null>(null)
	const citedCellRef = useRef<HTMLTableCellElement | null>(null)
	const citedRowIndex = citedCell?.rowIndex
	const citedColumn = citedCell?.column

	useEffect(() => {
		const container = scrollContainerRef.current
		const cell = citedCellRef.current
		if (citedRowIndex == null || !citedColumn || !container || !cell) return
		const targetLeft = cell.offsetLeft - (container.clientWidth - cell.offsetWidth) / 2
		container.scrollLeft = Math.max(0, targetLeft)
	}, [citedRowIndex, citedColumn])

	if (!rows || rows.length === 0) return null
	const cols = columns && columns.length > 0 ? columns : Object.keys(rows[0])

	return (
		<div ref={scrollContainerRef} className={DATA_TABLE_WRAPPER}>
			<table className={DATA_TABLE}>
				<thead>
					<tr>
						{cols.map((c) => (
							<th key={c} className={`${DATA_TABLE_HEAD} ${citedCell && citedCell.column === c ? 'text-link' : ''}`}>
								{humanizeColumn(c)}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, ri) => (
						// oxlint-disable-next-line react/no-array-index-key -- Citations address rows by ordinal within this result snapshot.
						<tr key={ri}>
							{cols.map((c) => {
								const isCited = !!citedCell && citedCell.rowIndex === ri && citedCell.column === c
								return (
									<td
										key={c}
										ref={isCited ? citedCellRef : null}
										className={`${DATA_TABLE_CELL} ${isCited ? 'bg-brand-muted font-medium text-link-on-tint' : ''}`}
									>
										{isCited ? (
											<span className="inline-flex items-center gap-1">
												{formatCellValue(row[c])}
												<span className="rounded-xs bg-brand px-1 py-px label-xs tracking-wide text-on-brand uppercase">
													cited
												</span>
											</span>
										) : (
											formatCellValue(row[c])
										)}
									</td>
								)
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
