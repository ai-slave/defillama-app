import * as Ariakit from '@ariakit/react'
import { selectTriggerStyles } from '~/components/Select/types'
import { VirtualizedSelect } from '~/components/Select/VirtualizedSelect'
import { CHART_COLORS } from '~/constants/colors'
import { keepFocus, neighbourRowControl } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { canUseChartType, type ChartConfig, type ChartType, type NumberFormat, type StackMode } from '../chartConfig'
import type { ClassifiedColumn } from '../columnKind'
import { ChartTypePicker } from './ChartTypePicker'
import { SeriesChip } from './SeriesChip'

interface ChartToolbarProps {
	config: ChartConfig
	classified: Array<ClassifiedColumn>
	onChange: (patch: Partial<ChartConfig>) => void
}

const FORMAT_OPTIONS: Array<{ value: NumberFormat; label: string }> = [
	{ value: 'auto', label: 'auto' },
	{ value: 'humanized', label: '3.4M' },
	{ value: 'currency', label: '$' },
	{ value: 'percent', label: '%' }
]

const STACK_OPTIONS: Array<{ value: StackMode; label: string }> = [
	{ value: 'off', label: 'off' },
	{ value: 'stacked', label: 'stack' },
	{ value: 'expand', label: '100%' }
]

const TYPES_SUPPORTING_STACK = new Set<ChartType>(['bar', 'hbar', 'area', 'areaStacked', 'areaPct'])
const TYPES_SUPPORTING_SPLIT = new Set<ChartType>(['line', 'area', 'areaStacked', 'areaPct', 'bar', 'hbar'])

export function ChartToolbar({ config, classified, onChange }: ChartToolbarProps) {
	const xOptions = classified.filter(
		(c) => c.coarse !== 'number' || classified.every((o) => o.coarse !== 'date' && o.coarse !== 'category')
	)
	const yOptions = classified.filter((c) => c.coarse === 'number')
	const categoryOptions = classified.filter((c) => c.coarse === 'category' && c.name !== config.xCol)

	const canStack = TYPES_SUPPORTING_STACK.has(config.chartType) && config.yCols.length >= 2
	const canSplit =
		TYPES_SUPPORTING_SPLIT.has(config.chartType) && categoryOptions.length > 0 && config.yCols.length <= 1

	const handleChartType = (next: ChartType) => {
		if (!canUseChartType(next, classified)) return
		onChange({ chartType: next })
	}

	const handleXCol = (next: string) => {
		if (next === config.xCol) return
		onChange({ xCol: next, yCols: config.yCols.filter((y) => y !== next) })
	}

	const handleYToggle = (name: string) => {
		const isSelected = config.yCols.includes(name)
		const nextYCols = isSelected ? config.yCols.filter((y) => y !== name) : [...config.yCols, name]
		onChange({ yCols: nextYCols.slice(0, 8) })
	}

	const handleSplitBy = (next: string | null) => {
		onChange({ splitByCol: next })
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
				<ChartTypePicker value={config.chartType} onChange={handleChartType} classified={classified} />
				<div className="ml-auto flex items-center gap-2">
					<SegmentedControl
						label="Number format"
						variant="default"
						size="md"
						options={FORMAT_OPTIONS}
						value={config.numberFormat}
						onValueChange={(v) => onChange({ numberFormat: v })}
					/>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 body-sm text-pro-text-secondary">
				<PickerChip
					label="x"
					value={config.xCol}
					hint={
						config.xCol
							? classified.find((c) => c.name === config.xCol)?.coarse === 'date'
								? 'time'
								: classified.find((c) => c.name === config.xCol)?.coarse === 'number'
									? 'numeric'
									: 'category'
							: undefined
					}
					onChange={handleXCol}
					options={xOptions.map((c) => c.name)}
				/>

				<YSeriesPicker
					yCols={config.yCols}
					available={yOptions.map((c) => c.name).filter((n) => n !== config.xCol)}
					onToggle={handleYToggle}
					splitByActive={!!config.splitByCol}
					config={config}
					onChange={onChange}
				/>

				{canSplit ? (
					<PickerChip
						label="split by"
						value={config.splitByCol ?? '∅'}
						onChange={(next) => handleSplitBy(next === '∅' ? null : next)}
						options={['∅', ...categoryOptions.map((c) => c.name)]}
						optionLabel={(v) => (v === '∅' ? 'none' : v)}
					/>
				) : null}

				{canStack ? (
					<SegmentedControl
						label="Stack mode"
						variant="default"
						size="md"
						options={STACK_OPTIONS}
						value={config.stackMode}
						onValueChange={(v) => onChange({ stackMode: v })}
					/>
				) : null}

				<span className="ml-auto body-sm text-pro-text-tertiary">{seriesSummary(config)}</span>
			</div>
		</div>
	)
}

function seriesSummary(config: ChartConfig): string {
	if (config.splitByCol) return `${config.yCols[0] ?? ''} by ${config.splitByCol}`
	if (config.yCols.length === 0) return 'pick a series'
	if (config.yCols.length === 1) return config.yCols[0]
	return `${config.yCols.length} series`
}

function PickerChip({
	label,
	value,
	hint,
	onChange,
	options,
	optionLabel
}: {
	label: string
	value: string | null
	hint?: string
	onChange: (next: string) => void
	options: Array<string>
	optionLabel?: (v: string) => string
}) {
	return (
		<div className="flex items-center gap-1.5">
			<VirtualizedSelect
				variant="chip"
				label={label}
				placeholder="—"
				options={options.map((opt) => ({ value: opt, label: optionLabel ? optionLabel(opt) : opt }))}
				selectedValue={value}
				onChange={(option) => onChange(option.value)}
			/>
			{hint ? <span className="body-xs text-pro-text-tertiary">{hint}</span> : null}
		</div>
	)
}

const DUAL_AXIS_TYPES = new Set<ChartType>(['line', 'bar', 'area', 'areaStacked'])
const KIND_EDIT_TYPES = new Set<ChartType>(['line', 'bar'])

function YSeriesPicker({
	yCols,
	available,
	onToggle,
	splitByActive,
	config,
	onChange
}: {
	yCols: Array<string>
	available: Array<string>
	onToggle: (name: string) => void
	splitByActive: boolean
	config: ChartConfig
	onChange: (patch: Partial<ChartConfig>) => void
}) {
	const label = splitByActive
		? 'split series'
		: yCols.length === 0
			? 'none'
			: yCols.length === 1
				? yCols[0]
				: `${yCols.length} series`

	const dualAxisEligible = DUAL_AXIS_TYPES.has(config.chartType) && yCols.length >= 2
	const seriesKindEligible = KIND_EDIT_TYPES.has(config.chartType)

	return (
		<div className="flex items-center gap-1.5">
			<Ariakit.PopoverProvider>
				<Ariakit.PopoverDisclosure
					aria-label="Y series"
					disabled={splitByActive}
					className={`${selectTriggerStyles('filter', 'md')} max-w-72 shrink-0`}
				>
					{/* Reads "y: value" like the x and split-by chips beside it. */}
					<span className="shrink-0">y: </span>
					<span className="truncate text-link">{label}</span>
					<Icon name="chevron-down" className="size-3 shrink-0 text-tertiary" />
				</Ariakit.PopoverDisclosure>
				<PopoverSurface
					variant="panel"
					heading="Y series"
					aria-label="Y series settings"
					gutter={4}
					className="w-[280px]"
				>
					<div className="flex flex-col gap-1 p-2">
						{yCols.length > 0 ? (
							<div className="flex flex-col gap-1">
								<span className="px-1 label-xs tracking-wide text-pro-text-tertiary uppercase">selected</span>
								{yCols.map((name, i) => (
									<SeriesChip
										key={name}
										name={name}
										paletteColor={config.seriesColors[name] ?? CHART_COLORS[i % CHART_COLORS.length]}
										chartType={config.chartType}
										config={config}
										onChange={onChange}
										onRemove={() => onToggle(name)}
										dualAxisEligible={dualAxisEligible}
										seriesKindEligible={seriesKindEligible}
									/>
								))}
								<span className="my-1 h-px bg-border-subtle" aria-hidden />
							</div>
						) : null}

						<span className="px-1 label-xs tracking-wide text-pro-text-tertiary uppercase">add</span>
						{yCols.length >= 8 ? (
							<p className="px-2 py-1 body-sm text-pro-text-secondary">Up to 8 series. Remove one to add another.</p>
						) : null}
						{available.filter((n) => !yCols.includes(n)).length === 0 ? (
							<div className="px-2 py-1 body-sm text-pro-text-tertiary">No more numeric columns</div>
						) : (
							// `contents` keeps the rows in the column's gap; the wrapper makes them each other's only neighbours.
							<div className="contents">
								{available
									.filter((n) => !yCols.includes(n))
									.map((name) => (
										<button
											type="button"
											disabled={yCols.length >= 8}
											aria-label={`Add ${name}`}
											key={name}
											onClick={(event) => {
												// The added column leaves this list: the next one takes focus, else the previous one.
												const next = neighbourRowControl(event.currentTarget, event.currentTarget)
												keepFocus(
													() => onToggle(name),
													() => next
												)
											}}
											className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 mono-sm text-pro-text-primary hover:bg-hover-row disabled:cursor-not-allowed disabled:text-disabled"
										>
											<Icon name="plus" className="size-3 text-pro-text-tertiary" />
											<span className="truncate">{name}</span>
										</button>
									))}
							</div>
						)}
					</div>
				</PopoverSurface>
			</Ariakit.PopoverProvider>
		</div>
	)
}
