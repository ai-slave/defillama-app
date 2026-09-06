import { Icon } from '~/ui/Icon'
import { type ChartConfig, getProDashboardChartTypeConfig, MAX_MULTI_CHART_SERIES } from '../../types'

interface SelectionFooterProps {
	composerItems: Array<ChartConfig>
	chartCreationMode: 'separate' | 'combined'
	unifiedChartName: string
	onChartCreationModeChange: (mode: 'separate' | 'combined') => void
	onUnifiedChartNameChange: (name: string) => void
	onComposerItemColorChange: (id: string, color: string) => void
	onRemoveFromComposer: (id: string) => void
}

export function SelectionFooter({
	composerItems,
	chartCreationMode,
	unifiedChartName,
	onChartCreationModeChange,
	onUnifiedChartNameChange,
	onComposerItemColorChange,
	onRemoveFromComposer
}: SelectionFooterProps) {
	if (composerItems.length === 0) {
		return null
	}

	return (
		<div className="shrink-0 space-y-2">
			{chartCreationMode === 'combined' ? (
				<input
					type="text"
					value={unifiedChartName}
					onChange={(e) => onUnifiedChartNameChange(e.target.value)}
					placeholder="Chart name..."
					className="w-full rounded-sm border border-pro-form-control-border bg-surface-elevated-1 px-2 py-1.5 text-xs text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden"
				/>
			) : null}
			<div className="flex flex-wrap items-center gap-2">
				<label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-pro-text-secondary">
					<input
						type="checkbox"
						checked={chartCreationMode === 'combined'}
						onChange={() => onChartCreationModeChange(chartCreationMode === 'combined' ? 'separate' : 'combined')}
						className="size-3.5 rounded-sm border-gray-600 bg-transparent"
					/>
					<span>Multi-Chart</span>
				</label>
				{composerItems.map((item) => {
					const chartType = getProDashboardChartTypeConfig(item.type)
					return (
						<div
							key={item.id}
							className="flex shrink-0 items-center gap-1.5 rounded-md border border-pro-cards-border bg-pro-cards-bg px-2 py-1 text-xs"
						>
							<span className="text-pro-text-primary">
								{item.subjectType === 'protocol' ? item.protocol : item.chain} - {chartType?.title || item.type}
							</span>
							<input
								type="color"
								value={item.color || chartType?.color || '#3e61cc'}
								onChange={(e) => onComposerItemColorChange(item.id, e.target.value)}
								className="size-5 cursor-pointer rounded-sm border border-pro-cards-border bg-transparent p-0"
								aria-label="Select chart color"
							/>
							<button
								type="button"
								onClick={() => onRemoveFromComposer(item.id)}
								className="text-pro-text-tertiary transition-colors hover:text-error"
								title="Remove from selection"
							>
								<Icon name="x" height={12} width={12} />
							</button>
						</div>
					)
				})}
			</div>
			<div className="text-[10px] text-pro-text-tertiary">
				{chartCreationMode === 'combined'
					? `Create 1 multi-chart with ${composerItems.length} chart${composerItems.length !== 1 ? 's' : ''}`
					: `Create ${composerItems.length} separate chart${composerItems.length !== 1 ? 's' : ''}`}
				{` (maximum ${MAX_MULTI_CHART_SERIES})`}
			</div>
		</div>
	)
}
