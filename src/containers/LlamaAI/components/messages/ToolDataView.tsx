import { useEffect, useRef, type ReactNode } from 'react'
import { getOwnRegistryValue } from '~/containers/LlamaAI/utils/getOwnRegistryValue'
import { formatPercent } from '~/utils/numberFormat'
import { formatCellValue, humanizeColumn, type CitedCell } from './citationPillHelpers'

type ToolDataRenderer = (data: Record<string, any>) => ReactNode | null

const TOOL_DATA_RENDERERS = {
	resolve_entity: (data) => {
		const results = data.results || (data.topMatch ? { _single: data } : null)
		if (!results) return null
		return (
			<div className="mt-1 mb-1 flex flex-col gap-0.5 rounded-sm border border-ai-line bg-ai-surface p-1.5">
				{Object.entries(results).map(([term, value]: [string, any]) => (
					<div key={term} className="flex items-center gap-2 text-[10px]">
						{term !== '_single' ? <span className="font-medium text-ai-tertiary">{term}:</span> : null}
						{value.topMatch ? (
							<span className="text-ai-secondary">
								{value.topMatch.slug}{' '}
								<span className="text-ai-muted">
									({value.topMatch.type},{' '}
									{formatPercent(value.topMatch.confidence, { input: 'fraction', maximumFractionDigits: 0 })})
								</span>
								{value.matchCount > 1 ? <span className="text-ai-muted"> +{value.matchCount - 1} more</span> : null}
							</span>
						) : (
							<span className="text-ai-muted">no match</span>
						)}
					</div>
				))}
			</div>
		)
	},
	generate_chart: (data) => {
		if (!data.charts) return null
		return (
			<div className="mt-1 mb-1 flex flex-col gap-0.5 rounded-sm border border-ai-line bg-ai-surface p-1.5">
				{data.charts.map((chart: any) => (
					<div key={chart.id} className="text-[10px] text-ai-secondary">
						<span className="font-medium">{chart.title}</span>{' '}
						<span className="text-ai-muted">
							({chart.type}, {chart.seriesCount} series)
						</span>
					</div>
				))}
			</div>
		)
	},
	execute_code: (data) =>
		data.logs?.length ? (
			<pre className="mt-1 mb-1 overflow-x-auto rounded-sm border border-ai-line bg-ai-surface p-1.5 font-mono text-[10px] text-ai-secondary">
				{data.logs.join('\n')}
			</pre>
		) : null,
	load_skill: (data) => (
		<div className="mt-1 mb-1 text-[10px] text-ai-secondary">
			<span className="font-medium">{data.skill}</span>
			{data.unlockedTools?.length > 0 ? (
				<span className="text-ai-muted"> - unlocked: {data.unlockedTools.join(', ')}</span>
			) : null}
		</div>
	),
	spawn_agent: (data) => {
		if (!data.agents) return null
		return (
			<div className="mt-1 mb-1 flex flex-col gap-0.5 rounded-sm border border-ai-line bg-ai-surface p-1.5">
				{data.agents.map((agent: any) => (
					<div key={agent.id} className="text-[10px] text-ai-secondary">
						Agent {agent.id.slice(0, 6)}{' '}
						<span className="text-ai-muted">
							({agent.toolCalls} tool calls{agent.chartCount > 0 ? `, ${agent.chartCount} charts` : ''})
						</span>
					</div>
				))}
			</div>
		)
	},
	web_search: (data) => <span className="mt-1 mb-1 text-[10px] text-ai-muted">{data.citationCount} sources</span>,
	x_search: (data) => <span className="mt-1 mb-1 text-[10px] text-ai-muted">{data.tweetCount} tweets</span>
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
	columns?: string[]
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
		<div
			ref={scrollContainerRef}
			className="mt-1 mb-1 overflow-x-auto rounded-sm border border-ai-line bg-ai-surface p-1"
		>
			<table className="text-[11px]">
				<thead>
					<tr>
						{cols.map((c) => (
							<th
								key={c}
								className={`px-2 py-1 text-left font-medium ${
									citedCell && citedCell.column === c ? 'text-ai-accent-blue' : 'text-ai-tertiary'
								}`}
							>
								{humanizeColumn(c)}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, ri) => (
						<tr key={ri}>
							{cols.map((c, ci) => {
								const isCited = !!citedCell && citedCell.rowIndex === ri && citedCell.column === c
								return (
									<td
										key={ci}
										ref={isCited ? citedCellRef : null}
										className={
											isCited
												? 'rounded-[3px] border border-ai-accent-blue/45 bg-ai-accent-blue/12 px-2 py-1 font-medium text-ai-accent-blue'
												: 'px-2 py-1 text-ai-secondary'
										}
									>
										{isCited ? (
											<span className="inline-flex items-center gap-1">
												{formatCellValue(row[c])}
												<span className="rounded-[2px] bg-ai-accent-blue px-1 py-px text-[8px] leading-none font-semibold tracking-wide text-ai-white uppercase">
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
