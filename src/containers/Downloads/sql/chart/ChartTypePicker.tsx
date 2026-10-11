import * as Ariakit from '@ariakit/react'
import { Icon, type IIcon } from '~/ui/Icon'
import { canUseChartType, type ChartType } from '../chartConfig'
import type { ClassifiedColumn } from '../columnKind'

interface ChartTypeOption {
	type: ChartType
	label: string
	icon: IIcon['name']
}

const GROUPS: Array<{ key: string; options: Array<ChartTypeOption> }> = [
	{
		key: 'time',
		options: [
			{ type: 'line', label: 'Line', icon: 'chart-type-line' },
			{ type: 'area', label: 'Area', icon: 'chart-type-area' },
			{ type: 'areaStacked', label: 'Stacked area', icon: 'chart-type-area-stacked' },
			{ type: 'areaPct', label: '100% area', icon: 'chart-type-area-percent' },
			{ type: 'bar', label: 'Bar', icon: 'chart-type-bar' }
		]
	},
	{
		key: 'categorical',
		options: [
			{ type: 'hbar', label: 'Horizontal bar', icon: 'chart-type-hbar' },
			{ type: 'pie', label: 'Pie', icon: 'pie-chart' },
			{ type: 'donut', label: 'Donut', icon: 'chart-type-donut' }
		]
	},
	{
		key: 'distribution',
		options: [
			{ type: 'scatter', label: 'Scatter', icon: 'chart-type-scatter' },
			{ type: 'bubble', label: 'Bubble', icon: 'chart-type-bubble' },
			{ type: 'histogram', label: 'Histogram', icon: 'chart-type-histogram' }
		]
	},
	{
		key: 'hierarchy',
		options: [{ type: 'treemap', label: 'Treemap', icon: 'chart-type-treemap' }]
	},
	{
		key: 'finance',
		options: [{ type: 'candlestick', label: 'Candlestick', icon: 'chart-type-candlestick' }]
	}
]

interface ChartTypePickerProps {
	value: ChartType
	onChange: (next: ChartType) => void
	classified: Array<ClassifiedColumn>
}

export function ChartTypePicker({ value, onChange, classified }: ChartTypePickerProps) {
	const selectedIsDisabled = !canUseChartType(value, classified)
	const firstEnabled = selectedIsDisabled
		? GROUPS.flatMap((group) => group.options).find((option) => canUseChartType(option.type, classified))?.type
		: undefined
	return (
		<Ariakit.RadioProvider value={value} orientation="both">
			<Ariakit.RadioGroup
				aria-label="Chart type"
				className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-subtle bg-surface-elevated-1 p-0.5"
			>
				{GROUPS.map((group, groupIndex) => (
					<div key={group.key} className="flex items-center gap-0.5">
						{group.options.map((opt) => {
							const active = value === opt.type
							const available = canUseChartType(opt.type, classified)
							return (
								<label
									key={opt.type}
									title={available ? opt.label : `${opt.label} (not compatible with current columns)`}
									className={`relative flex h-6 w-7 cursor-pointer items-center justify-center rounded-[4px] transition-colors has-focus-visible:focus-ring ${
										active
											? 'bg-brand text-on-brand '
											: available
												? 'text-secondary hover:bg-hover-row hover:text-primary'
												: 'cursor-not-allowed text-tertiary'
									}`}
								>
									<Ariakit.Radio
										value={opt.type}
										disabled={!available}
										tabIndex={selectedIsDisabled ? (opt.type === firstEnabled ? 0 : -1) : undefined}
										onChange={() => onChange(opt.type)}
										className="sr-only"
									/>
									<Icon name={opt.icon} className="size-3.5" aria-hidden />
									<span className="sr-only">{opt.label}</span>
								</label>
							)
						})}
						{groupIndex < GROUPS.length - 1 ? <span aria-hidden className="mx-0.5 h-4 w-px bg-border-subtle" /> : null}
					</div>
				))}
			</Ariakit.RadioGroup>
		</Ariakit.RadioProvider>
	)
}
