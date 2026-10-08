import { useId } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { Tooltip } from '~/ui/Tooltip'
import { type ChartConfig, getProDashboardChartTypeConfig, MAX_MULTI_CHART_SERIES } from '../../types'
import { ChartCreationModeToggle } from './ChartCreationModeToggle'

/** The combined card's optional name, asked only while the series combine into one chart. */
export function ComposerNameField({ value, onChange }: { value: string; onChange: (name: string) => void }) {
	const id = useId()
	return (
		<div className="shrink-0">
			<label htmlFor={id} className="mb-1 block label-sm text-secondary">
				Card name (optional)
			</label>
			<Input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full" />
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
			<span
				key={item.id}
				className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-medium py-0.5 pr-0.5 pl-2.5 label-sm text-primary"
			>
				<span className="whitespace-nowrap">{label}</span>
				<input
					type="color"
					value={item.color || chartType?.color || '#3e61cc'}
					onChange={(e) => onComposerItemColorChange(item.id, e.target.value)}
					className="size-5 cursor-pointer rounded-sm border border-medium bg-transparent p-0"
					aria-label={`Color for ${label}`}
				/>
				<Tooltip
					content={`Remove ${label}`}
					render={
						<Button
							variant="ghost"
							size="sm"
							square
							onClick={() => onRemoveFromComposer(item.id)}
							aria-label={`Remove ${label}`}
						/>
					}
				>
					<Icon name="x" className="size-4" />
				</Tooltip>
			</span>
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
			<div className="body-sm text-tertiary">
				{chartCreationMode === 'combined'
					? `1 combined chart with ${composerItems.length} series (max ${MAX_MULTI_CHART_SERIES})`
					: `${composerItems.length} separate card${composerItems.length !== 1 ? 's' : ''}`}
			</div>
		</div>
	)
}
