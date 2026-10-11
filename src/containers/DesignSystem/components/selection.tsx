import { useState } from 'react'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { OptionTile } from '~/ui/OptionTile'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Switch } from '~/ui/Switch'
import { TabPanel, Tabs } from '~/ui/Tabs'
import { Cell, DoDont, Example, type Family, type ForcedState, type KnobValues, Row, StateGrid } from '../shared'

const PERIODS = [
	{ value: '7d', label: '7d' },
	{ value: '30d', label: '30d' },
	{ value: '90d', label: '90d' },
	{ value: 'all', label: 'All', disabled: true }
] as const
const VARIANTS = ['default', 'responsive', 'field', 'mode', 'chips', 'solid', 'solid-responsive'] as const
const SEGMENT_STATES = ['Rest', 'Hover', 'Focus', 'Pressed', 'Selected', 'Disabled'] as const
const SEGMENT = [{ value: '30d', label: '30d' }] as const
const DISABLED_SEGMENT = [{ value: '30d', label: '30d', disabled: true }] as const
const VIEW_VALUES = ['chart', 'table'] as const
const METRICS = [
	{ value: 'tvl', label: 'TVL', tooltip: 'Total value locked in the protocol' },
	{ value: 'fees', label: 'Fees', tooltip: 'Fees paid by users' },
	{ value: 'volume', label: 'Volume', tooltip: 'Traded volume' }
] as const

const ICON_OPTIONS = [
	{ value: 'bar', label: <Icon name="bar-chart" className="size-4" aria-hidden />, ariaLabel: 'Bar chart' },
	{ value: 'line', label: <Icon name="activity" className="size-4" aria-hidden />, ariaLabel: 'Line chart' }
]
const OPTION_TILE_LAYOUTS = ['stack', 'row', 'center'] as const
const CHECKBOX_VARIANTS = ['default', 'inline', 'inline-sm', 'consent', 'filter', 'filter-borderless'] as const

function segmentRow(variant: (typeof VARIANTS)[number]) {
	// The forced state sits on the group itself, so it reaches its only segment.
	const cell = (force?: ForcedState, selected = false, disabled = false) => (
		<SegmentedControl
			label={`${variant} segment`}
			options={disabled ? DISABLED_SEGMENT : SEGMENT}
			value={selected ? '30d' : null}
			onValueChange={() => {}}
			variant={variant}
			size="md"
			data-force={force}
		/>
	)
	return (
		<>
			{cell()}
			{cell('hover')}
			{cell('focus-visible')}
			{cell('active')}
			{cell(undefined, true)}
			{cell(undefined, false, true)}
		</>
	)
}

type Variant = (typeof VARIANTS)[number]

function SegmentedDemo({ values }: { values: KnobValues }) {
	const [period, setPeriod] = useState<string>('30d')
	const variant = values.variant as Variant
	return (
		<SegmentedControl
			data-anatomy="SegmentedControl"
			label="Period"
			options={PERIODS}
			value={period}
			onValueChange={setPeriod}
			variant={variant}
			size={values.size as 'md' | 'sm'}
			// mode stacks unless the caller lays it out.
			className={variant === 'mode' ? 'grid-flow-col' : undefined}
		/>
	)
}

function SegmentedExamples() {
	const [period, setPeriod] = useState<string>('30d')
	const [metric, setMetric] = useState<string>('tvl')
	const [view, setView] = useState<'chart' | 'table'>('chart')
	return (
		<>
			<Example wide name="Variant × size" prop="variant, size" note="The last option is disabled.">
				<StateGrid
					columns={['size md', 'size sm']}
					rows={VARIANTS.map((variant) => [
						variant,
						<>
							<SegmentedControl
								label={`Period ${variant}`}
								options={PERIODS}
								value={period}
								onValueChange={setPeriod}
								variant={variant}
								size="md"
								className={variant === 'mode' ? 'grid-flow-col' : undefined}
							/>
							<SegmentedControl
								label={`Period ${variant} small`}
								options={PERIODS}
								value={period}
								onValueChange={setPeriod}
								variant={variant}
								size="sm"
								className={variant === 'mode' ? 'grid-flow-col' : undefined}
							/>
						</>
					])}
				/>
			</Example>
			<Example wide name="Variant × state" note="One segment per cell, so the forced state reaches it alone.">
				<StateGrid columns={SEGMENT_STATES} rows={VARIANTS.map((variant) => [variant, segmentRow(variant)])} />
			</Example>
			<Example
				name="Tooltip, leading icon, icon-only"
				prop="tooltip, leading, ariaLabel"
				note="Hover or focus an option for its tooltip."
			>
				<div className="flex flex-col items-start gap-3">
					<SegmentedControl
						label="Metric"
						options={METRICS}
						value={metric}
						onValueChange={setMetric}
						variant="default"
						size="md"
					/>
					<SegmentedControl
						label="Metric with icon"
						leading={<Icon name="bar-chart" className="size-4" aria-hidden />}
						options={PERIODS}
						value={period}
						onValueChange={setPeriod}
						variant="default"
						size="md"
					/>
					<SegmentedControl
						label="Chart type"
						options={ICON_OPTIONS}
						value="bar"
						onValueChange={() => {}}
						variant="default"
						size="md"
					/>
				</div>
			</Example>
			<Example name="Tab semantics" prop='semantics="tabs"' note="Arrow keys move focus; Enter or Space selects.">
				<Tabs<(typeof VIEW_VALUES)[number]> value={view} onValueChange={setView} values={VIEW_VALUES}>
					<SegmentedControl
						semantics="tabs"
						label="View"
						options={[
							{ value: 'chart', label: 'Chart' },
							{ value: 'table', label: 'Table' }
						]}
						variant="default"
						size="md"
					/>
					<TabPanel value="chart" className="pt-3 body-sm text-secondary">
						Chart panel
					</TabPanel>
					<TabPanel value="table" className="pt-3 body-sm text-secondary">
						Table panel
					</TabPanel>
				</Tabs>
			</Example>
		</>
	)
}

function OptionTileDemo({ values }: { values: KnobValues }) {
	const [picked, setPicked] = useState(false)
	const layout = values.layout as (typeof OPTION_TILE_LAYOUTS)[number]
	return (
		<OptionTile
			layout={layout}
			selected={picked}
			aria-pressed={picked}
			disabled={values.state === 'disabled'}
			onClick={() => setPicked(!picked)}
			className="w-40"
		>
			{optionTileBody(layout)}
		</OptionTile>
	)
}

function RadioGroupExample() {
	const [grouping, setGrouping] = useState('chain')
	return (
		<Example name="Radio group" prop='role="radio"'>
			<div role="radiogroup" aria-label="Grouping" className="flex gap-2">
				{(
					[
						['chain', 'By chain'],
						['protocol', 'By protocol']
					] as const
				).map(([value, title]) => (
					<OptionTile
						key={value}
						layout="stack"
						selected={grouping === value}
						role="radio"
						aria-checked={grouping === value}
						onClick={() => setGrouping(value)}
						className="w-40"
					>
						<span className="label-md">{title}</span>
						<span className="body-xs text-secondary">One row per {value}</span>
					</OptionTile>
				))}
			</div>
		</Example>
	)
}

function optionTileBody(layout: (typeof OPTION_TILE_LAYOUTS)[number]) {
	return (
		<>
			{layout === 'row' ? <Icon name="layers" className="size-4 shrink-0 text-tertiary" aria-hidden /> : null}
			{layout === 'center' ? <Icon name="layers" className="size-5 text-tertiary" aria-hidden /> : null}
			<span className="flex flex-col gap-0.5">
				<span className="label-md">By chain</span>
				<span className="body-xs text-secondary">One row per chain</span>
			</span>
		</>
	)
}

function SwitchDemo({ values }: { values: KnobValues }) {
	const [checked, setChecked] = useState(false)
	return (
		<Switch
			label="Alerts"
			value="alerts"
			checked={checked}
			disabled={values.state === 'disabled'}
			isLoading={values.state === 'saving'}
			onChange={() => setChecked(!checked)}
		/>
	)
}

function CheckboxDemo({ values }: { values: KnobValues }) {
	const [checked, setChecked] = useState(false)
	return (
		<Checkbox
			variant={values.variant as (typeof CHECKBOX_VARIANTS)[number]}
			checked={checked}
			disabled={values.state === 'disabled'}
			isLoading={values.state === 'saving'}
			onChange={() => setChecked(!checked)}
		>
			Show fees
		</Checkbox>
	)
}

export const selection: Family = {
	id: 'selection',
	title: 'Selection',
	parts: [
		{
			name: 'SegmentedControl',
			source: 'src/ui/SegmentedControl.tsx',
			knobs: [
				{ name: 'variant', values: VARIANTS },
				{ name: 'size', values: ['md', 'sm'] }
			],
			render: (values) => <SegmentedDemo values={values} />,
			anatomy: true,
			states: () => <SegmentedExamples />,
			dos: () => (
				<Example name="Icon-only options" prop="ariaLabel">
					<DoDont
						good={
							<SegmentedControl
								label="Chart type"
								options={ICON_OPTIONS}
								value="bar"
								onValueChange={() => {}}
								variant="default"
								size="md"
							/>
						}
						goodCaption="Each option has a name: “Bar chart”, “Line chart”."
						bad={
							<SegmentedControl
								label="Chart type"
								options={ICON_OPTIONS.map(({ value, label }) => ({ value, label }))}
								value="bar"
								onValueChange={() => {}}
								variant="default"
								size="md"
							/>
						}
						badCaption="No ariaLabel: screen readers hear each option as a bare “radio”."
					/>
				</Example>
			)
		},
		{
			name: 'OptionTile',
			source: 'src/ui/OptionTile.tsx',
			knobs: [
				{ name: 'layout', values: OPTION_TILE_LAYOUTS },
				{ name: 'state', values: ['rest', 'disabled'], default: 'rest', prop: false }
			],
			note: 'Click the tile to pick it.',
			render: (values) => <OptionTileDemo values={values} />,
			states: () => (
				<>
					<Example wide name="Layout × state" note="aria-pressed tiles.">
						<StateGrid
							columns={['Rest', 'Hover', 'Focus', 'Pressed', 'Selected', 'Disabled']}
							rows={OPTION_TILE_LAYOUTS.map((layout) => {
								const tile = (props: { selected?: boolean; disabled?: boolean }) => (
									<OptionTile
										layout={layout}
										selected={props.selected ?? false}
										disabled={props.disabled}
										aria-pressed={props.selected ?? false}
										className="w-40"
									>
										{optionTileBody(layout)}
									</OptionTile>
								)
								return [
									layout,
									<>
										<Cell>{tile({})}</Cell>
										<Cell force="hover">{tile({})}</Cell>
										<Cell force="focus-visible">{tile({})}</Cell>
										<Cell force="active">{tile({})}</Cell>
										<Cell>{tile({ selected: true })}</Cell>
										<Cell>{tile({ disabled: true })}</Cell>
									</>
								]
							})}
						/>
					</Example>
					<RadioGroupExample />
				</>
			)
		},
		{
			name: 'Checkbox',
			source: 'src/ui/Checkbox.tsx',
			knobs: [
				{ name: 'variant', values: CHECKBOX_VARIANTS },
				{ name: 'state', values: ['rest', 'disabled', 'saving'], default: 'rest', prop: false }
			],
			note: 'Click it to check it; checked is the demo’s own state. Saving is isLoading.',
			render: (values) => <CheckboxDemo values={values} />,
			states: () => (
				<Example wide name="Variant × state">
					<StateGrid
						columns={['Unchecked', 'Checked', 'Hover', 'Focus', 'Disabled', 'Saving']}
						rows={CHECKBOX_VARIANTS.map((variant) => [
							variant,
							<>
								<Checkbox variant={variant} checked={false} onChange={() => {}}>
									Show fees
								</Checkbox>
								<Checkbox variant={variant} checked onChange={() => {}}>
									Show fees
								</Checkbox>
								<Cell force="hover">
									<Checkbox variant={variant} checked={false} onChange={() => {}}>
										Show fees
									</Checkbox>
								</Cell>
								<Cell force="focus-visible">
									<Checkbox variant={variant} checked onChange={() => {}}>
										Show fees
									</Checkbox>
								</Cell>
								<Checkbox variant={variant} checked disabled onChange={() => {}}>
									Show fees
								</Checkbox>
								<Checkbox variant={variant} checked isLoading onChange={() => {}}>
									Show fees
								</Checkbox>
							</>
						])}
					/>
				</Example>
			)
		},
		{
			name: 'Switch',
			source: 'src/ui/Switch.tsx',
			knobs: [{ name: 'state', values: ['rest', 'disabled', 'saving'], default: 'rest', prop: false }],
			note: 'Click it to turn it on; checked is the demo’s own state. Saving is isLoading.',
			render: (values) => <SwitchDemo values={values} />,
			states: () => (
				<>
					<Example
						name="Disabled and saving"
						note="Focus follows the input, which a forced state cannot reach: Tab to a switch."
					>
						<StateGrid
							columns={['Disabled', 'Saving']}
							rows={[
								[
									'off',
									<>
										<Switch label="Alerts" value="off-disabled" checked={false} disabled onChange={() => {}} />
										<Switch label="Alerts" value="off-saving" checked={false} isLoading onChange={() => {}} />
									</>
								],
								[
									'on',
									<>
										<Switch label="Alerts" value="on-disabled" checked disabled onChange={() => {}} />
										<Switch label="Alerts" value="on-saving" checked isLoading onChange={() => {}} />
									</>
								]
							]}
						/>
					</Example>
					<Example
						name="Hidden label and help"
						prop="hideLabel, help"
						note="hideLabel keeps the name for assistive tech only."
					>
						<Row>
							<Switch label="Weekly digest" value="digest" hideLabel checked onChange={() => {}} />
							<Switch
								label="Price alerts"
								value="price"
								help="Email when a token moves 10% in a day"
								checked={false}
								onChange={() => {}}
							/>
						</Row>
					</Example>
				</>
			)
		}
	]
}
