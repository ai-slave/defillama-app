import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { MetaLine } from '~/ui/MetaLine'
import { Select } from '~/ui/Select'
import { EmptyState } from '~/ui/Status'
import { formatNumber } from '~/utils/numberFormat'
import type { ChartConfig } from '../chartConfig'
import { ResultsChart } from '../ResultsChart'
import type { NotebookCell } from '../useSqlTabs'

export interface ChartSourceOption {
	name: string
	cellId: string
	hasRun: boolean
	result: NotebookCell['result']
}

interface ChartCellProps {
	cell: NotebookCell
	availableSources: Array<ChartSourceOption>
	onSourceChange: (sourceName: string) => void
	onChartConfigChange: (next: ChartConfig | null) => void
}

function describeShape(opt: ChartSourceOption): string {
	if (!opt.hasRun || !opt.result) return 'not run'
	const rows = opt.result.rows.length
	const cols = opt.result.columns.length
	return `${formatNumber(rows)}×${cols}`
}

export function ChartCell({ cell, availableSources, onSourceChange, onChartConfigChange }: ChartCellProps) {
	const selected = availableSources.find((s) => s.name === cell.source) ?? null
	const result = selected?.result ?? null
	const selectedCols = selected?.result?.columns ?? []

	return (
		<div className="flex flex-col gap-2">
			<Card padding="sm" className="flex flex-wrap items-center gap-x-2 gap-y-1">
				<span className="body-sm text-tertiary">Source</span>
				{availableSources.length === 0 ? (
					<span className="body-sm text-tertiary italic">
						Add a SQL cell and run it first — chart cells visualize prior cell output.
					</span>
				) : (
					<Select
						heading="Source cell"
						allValues={availableSources.map((s) => ({ key: s.name, name: `${s.name} · ${describeShape(s)}` }))}
						selectedValues={cell.source}
						setSelectedValues={onSourceChange}
						label={cell.source || 'Pick a cell'}
						labelType="none"
						variant="filter"
						size="sm"
						triggerProps={{ 'aria-label': 'Source cell' }}
					/>
				)}
				{selected && !selected.hasRun ? (
					<span className="inline-flex items-center gap-1 body-sm text-warning">
						<Icon name="alert-triangle" className="size-3" />
						source not yet run
					</span>
				) : selected?.result ? (
					<MetaLine className="min-w-0">
						<span>
							<span className="text-secondary tabular-nums">{formatNumber(selected.result.rows.length)}</span> rows
						</span>
						<span className="flex min-w-0 flex-wrap items-center gap-1">
							{selectedCols.slice(0, 4).map((c) => (
								<span key={c.name} className="truncate mono-sm text-secondary">
									{c.name}
								</span>
							))}
							{selectedCols.length > 4 ? (
								<span className="body-xs text-tertiary">+{selectedCols.length - 4}</span>
							) : null}
						</span>
					</MetaLine>
				) : null}
			</Card>

			{result ? (
				<ResultsChart result={result} chartConfig={cell.chartConfig} onChartConfigChange={onChartConfigChange} />
			) : (
				<EmptyState size="md" icon="bar-chart-2" title="No results to chart yet" framed>
					{cell.source
						? `${cell.source} has no results yet — run it first.`
						: 'Pick a source cell above to visualize its output.'}
				</EmptyState>
			)}
		</div>
	)
}
