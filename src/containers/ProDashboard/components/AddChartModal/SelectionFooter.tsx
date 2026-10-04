import { useId } from 'react'
import { Icon } from '~/ui/Icon'
import { type ChartConfig, getProDashboardChartTypeConfig, MAX_MULTI_CHART_SERIES } from '../../types'
import { ProChip, proInputStyles } from '../../ui'
import { ChartCreationModeToggle } from './ChartCreationModeToggle'

/** The combined card's optional name, asked only while the series combine into one chart. */
export function ComposerNameField({ value, onChange }: { value: string; onChange: (name: string) => void }) {
	const id = useId()
	return (
		<div className="shrink-0">
			<label htmlFor={id} className="mb-1 block text-xs font-medium text-pro-text-secondary">
				Card name (optional)
			</label>
			<input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} className={proInputStyles} />
		</div>
	)
}

/** One chip per picked series: its colour and a remove button. */
export function ComposerChips({
	composerItems,
	onComposerItemColorChange,
	onRemoveFromComposer
}: {
	composerItems: Array<ChartConfig>
	onComposerItemColorChange: (id: string, color: string) => void
	onRemoveFromComposer: (id: string) => void
}) {
	return composerItems.map((item) => {
		const chartType = getProDashboardChartTypeConfig(item.type)
		const label = `${item.subjectType === 'protocol' ? item.protocol : item.chain} - ${chartType?.title || item.type}`
		return (
			<ProChip key={item.id} className="shrink-0 gap-1.5">
				<span className="whitespace-nowrap text-pro-text-primary">{label}</span>
				<input
					type="color"
					value={item.color || chartType?.color || '#3e61cc'}
					onChange={(e) => onComposerItemColorChange(item.id, e.target.value)}
					className="size-5 cursor-pointer rounded-sm border border-pro-cards-border bg-transparent p-0"
					aria-label={`Color for ${label}`}
				/>
				<button
					type="button"
					onClick={() => onRemoveFromComposer(item.id)}
					className="text-pro-text-tertiary transition-colors hover:text-error"
					aria-label={`Remove ${label}`}
				>
					<Icon name="x" height={12} width={12} />
				</button>
			</ProChip>
		)
	})
}

interface SelectionFooterProps {
	composerItems: Array<ChartConfig>
	chartCreationMode: 'separate' | 'combined'
	unifiedChartName: string
	onChartCreationModeChange: (mode: 'separate' | 'combined') => void
	onUnifiedChartNameChange: (name: string) => void
	onComposerItemColorChange: (id: string, color: string) => void
	onRemoveFromComposer: (id: string) => void
}

/** The series picked so far, under the category grid: the same name, layout and chips as the chart form. */
export function SelectionFooter({
	composerItems,
	chartCreationMode,
	unifiedChartName,
	onChartCreationModeChange,
	onUnifiedChartNameChange,
	onComposerItemColorChange,
	onRemoveFromComposer
}: SelectionFooterProps) {
	if (composerItems.length === 0) return null
	return (
		<div className="shrink-0 space-y-2">
			{chartCreationMode === 'combined' ? (
				<ComposerNameField value={unifiedChartName} onChange={onUnifiedChartNameChange} />
			) : null}
			{composerItems.length > 1 ? (
				<ChartCreationModeToggle
					chartCreationMode={chartCreationMode}
					seriesCount={composerItems.length}
					onChartCreationModeChange={onChartCreationModeChange}
				/>
			) : null}
			<div className="flex flex-wrap items-center gap-2">
				<ComposerChips
					composerItems={composerItems}
					onComposerItemColorChange={onComposerItemColorChange}
					onRemoveFromComposer={onRemoveFromComposer}
				/>
			</div>
			<div className="text-xs text-pro-text-tertiary">
				{chartCreationMode === 'combined'
					? `1 combined chart with ${composerItems.length} series (max ${MAX_MULTI_CHART_SERIES})`
					: `${composerItems.length} separate card${composerItems.length !== 1 ? 's' : ''}`}
			</div>
		</div>
	)
}
