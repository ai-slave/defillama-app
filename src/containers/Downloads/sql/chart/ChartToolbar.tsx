import * as Ariakit from '@ariakit/react'
import { useRef } from 'react'
import { CHART_COLORS } from '~/constants/colors'
import { Icon } from '~/ui/Icon'
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
						aria-label="Number format"
						options={FORMAT_OPTIONS}
						value={config.numberFormat}
						onChange={(v) => onChange({ numberFormat: v })}
					/>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-pro-text-secondary">
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
						aria-label="Stack mode"
						options={STACK_OPTIONS}
						value={config.stackMode}
						onChange={(v) => onChange({ stackMode: v })}
					/>
				) : null}

				<span className="ml-auto text-[11px] text-pro-text-tertiary">{seriesSummary(config)}</span>
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

function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
	'aria-label': ariaLabel
}: {
	options: Array<{ value: T; label: string }>
	value: T
	onChange: (next: T) => void
	'aria-label': string
}) {
	return (
		<Ariakit.RadioProvider value={value} orientation="both">
			<Ariakit.RadioGroup
				aria-label={ariaLabel}
				className="inline-flex items-center gap-0.5 rounded-md border border-subtle bg-pro-app-bg/50 p-0.5"
			>
				{options.map((opt) => (
					<label
						key={opt.value}
						className={`relative cursor-pointer rounded-[3px] px-2 py-1 font-mono text-[10.5px] transition-colors has-focus-visible:focus-ring ${value === opt.value ? 'bg-brand text-on-brand' : 'text-pro-text-secondary hover:bg-hover-row hover:text-pro-text-primary'}`}
					>
						<Ariakit.Radio value={opt.value} onChange={() => onChange(opt.value)} className="sr-only" />
						{opt.label}
					</label>
				))}
			</Ariakit.RadioGroup>
		</Ariakit.RadioProvider>
	)
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
			<span className="text-pro-text-tertiary">{label}</span>
			<Ariakit.MenuProvider values={{ choice: value ?? false }}>
				<Ariakit.MenuButton
					aria-label={label}
					className="inline-flex max-w-[200px] items-center gap-1 rounded-md border border-subtle px-2 py-1 font-mono text-[11px] text-pro-text-primary hover:bg-hover-row"
				>
					<span className="truncate">{value == null ? '—' : optionLabel ? optionLabel(value) : value}</span>
					<Icon name="chevron-down" className="size-3 shrink-0" />
				</Ariakit.MenuButton>
				<Ariakit.Menu
					portal
					gutter={4}
					className="z-50 max-h-64 overflow-auto rounded-lg border border-medium bg-surface-elevated-1 p-1 shadow-lg"
				>
					{options.length === 0 ? (
						<div className="px-2 py-1 text-[11px] text-pro-text-tertiary">No options</div>
					) : (
						options.map((opt) => (
							<Ariakit.MenuItemRadio
								name="choice"
								value={opt}
								hideOnClick
								key={opt}
								onChange={() => onChange(opt)}
								className={`flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 font-mono text-[11px] text-pro-text-primary hover:bg-hover-row data-active-item:bg-hover-row ${
									opt === value ? 'bg-hover-row' : ''
								}`}
							>
								<span className="truncate">{optionLabel ? optionLabel(opt) : opt}</span>
							</Ariakit.MenuItemRadio>
						))
					)}
				</Ariakit.Menu>
			</Ariakit.MenuProvider>
			{hint ? <span className="text-[10px] text-pro-text-tertiary">{hint}</span> : null}
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
	const popoverRef = useRef<HTMLDivElement>(null)
	const toggleSeries = (name: string) => {
		// Adding/removing a series replaces the focused control. Keep focus in settings.
		popoverRef.current?.focus()
		onToggle(name)
	}
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
			<span className="text-pro-text-tertiary">y</span>
			<Ariakit.PopoverProvider>
				<Ariakit.PopoverDisclosure
					aria-label="Y series"
					disabled={splitByActive}
					className="inline-flex max-w-[240px] items-center gap-1 rounded-md border border-subtle px-2 py-1 font-mono text-[11px] text-pro-text-primary hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-60"
				>
					<span className="truncate">{label}</span>
					<Icon name="chevron-down" className="size-3 shrink-0" />
				</Ariakit.PopoverDisclosure>
				<Ariakit.Popover
					ref={popoverRef}
					aria-label="Y series settings"
					portal
					gutter={4}
					className="z-50 flex max-h-[60vh] w-[280px] flex-col gap-1 overflow-auto rounded-lg border border-medium bg-surface-elevated-1 p-2 shadow-lg"
				>
					{yCols.length > 0 ? (
						<div className="flex flex-col gap-1">
							<span className="px-1 text-[10px] font-semibold tracking-wide text-pro-text-tertiary uppercase">
								selected
							</span>
							{yCols.map((name, i) => (
								<SeriesChip
									key={name}
									name={name}
									paletteColor={config.seriesColors[name] ?? CHART_COLORS[i % CHART_COLORS.length]}
									chartType={config.chartType}
									config={config}
									onChange={onChange}
									onRemove={() => toggleSeries(name)}
									dualAxisEligible={dualAxisEligible}
									seriesKindEligible={seriesKindEligible}
								/>
							))}
							<span className="my-1 h-px bg-border-subtle" aria-hidden />
						</div>
					) : null}

					<span className="px-1 text-[10px] font-semibold tracking-wide text-pro-text-tertiary uppercase">add</span>
					{available.filter((n) => !yCols.includes(n)).length === 0 ? (
						<div className="px-2 py-1 text-[11px] text-pro-text-tertiary">No more numeric columns</div>
					) : (
						available
							.filter((n) => !yCols.includes(n))
							.map((name) => (
								<button
									type="button"
									disabled={yCols.length >= 8}
									aria-label={`Add ${name}`}
									key={name}
									onClick={() => toggleSeries(name)}
									className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 font-mono text-[11px] text-pro-text-primary hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-40"
								>
									<Icon name="plus" className="size-3 text-pro-text-tertiary" />
									<span className="truncate">{name}</span>
								</button>
							))
					)}
				</Ariakit.Popover>
			</Ariakit.PopoverProvider>
		</div>
	)
}
