import * as Ariakit from '@ariakit/react'
import { Icon, type IIcon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
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

/** Not a SegmentedControl: its 13 icons sit in five groups (time, categorical, distribution, hierarchy, finance),
    split by dividers, and wrap on a narrow pane, where a SegmentedControl is one row that scrolls. It takes the
    segmented look: the muted brand selection, a Tooltip for each name, the disabled color. Arrow keys skip a type the
    columns cannot draw, as in a SegmentedControl; its tooltip anchors on the segment instead, so hover still says why. */
export function ChartTypePicker({ value, onChange, classified }: ChartTypePickerProps) {
	const selectedIsDisabled = !canUseChartType(value, classified)
	const firstEnabled = selectedIsDisabled
		? GROUPS.flatMap((group) => group.options).find((option) => canUseChartType(option.type, classified))?.type
		: undefined
	return (
		<Ariakit.RadioProvider value={value} orientation="both">
			<Ariakit.RadioGroup
				aria-label="Chart type"
				className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-medium bg-surface p-0.5"
			>
				{GROUPS.map((group, groupIndex) => (
					<div key={group.key} className="flex items-center gap-0.5">
						{group.options.map((opt) => {
							const active = value === opt.type
							const available = canUseChartType(opt.type, classified)
							const radio = (
								<Ariakit.Radio
									value={opt.type}
									disabled={!available}
									tabIndex={selectedIsDisabled ? (opt.type === firstEnabled ? 0 : -1) : undefined}
									onChange={() => onChange(opt.type)}
									// The radio spreads over its segment, so hover and keyboard focus both open the name. A disabled
									// one lets the pointer through: a disabled input swallows hover, and its segment shows the reason.
									className={`absolute inset-0 cursor-[inherit] opacity-[0.00001] ${available ? '' : 'pointer-events-none'}`}
								/>
							)
							const content = (
								<>
									{available ? <Tooltip content={opt.label} render={radio} /> : radio}
									<Icon name={opt.icon} className="size-3.5" aria-hidden />
									<span className="sr-only">{opt.label}</span>
								</>
							)
							const segmentClassName = `relative flex h-6 w-7 items-center justify-center rounded-md transition-colors has-focus-visible:focus-ring ${
								active
									? 'cursor-pointer bg-brand-muted text-link'
									: available
										? 'cursor-pointer text-secondary hover:bg-hover-row hover:text-primary'
										: 'cursor-not-allowed text-disabled'
							}`
							return available ? (
								<label key={opt.type} className={segmentClassName}>
									{content}
								</label>
							) : (
								<Tooltip
									key={opt.type}
									content={`${opt.label}: not compatible with the current columns`}
									render={<span className="flex" />}
								>
									<label className={segmentClassName}>{content}</label>
								</Tooltip>
							)
						})}
						{groupIndex < GROUPS.length - 1 ? <span aria-hidden className="mx-0.5 h-4 w-px bg-border-subtle" /> : null}
					</div>
				))}
			</Ariakit.RadioGroup>
		</Ariakit.RadioProvider>
	)
}
