import * as Ariakit from '@ariakit/react'
import { type ReactNode, useState } from 'react'
import { Select } from '~/components/Select/Select'
import { ViewTabs } from '~/components/ViewTabs'
import { CHART_COLORS } from '~/constants/colors'
import { Button, ButtonGroup } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { Checkbox } from '~/ui/Checkbox'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { CountBadge } from '~/ui/CountBadge'
import { Dialog, DialogBody, DialogCancelButton, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Field, FieldGroup } from '~/ui/Field'
import { FileButton } from '~/ui/FileButton'
import { Icon } from '~/ui/Icon'
import { Input, Textarea } from '~/ui/Input'
import { Keycap } from '~/ui/Keycap'
import { ListRow } from '~/ui/ListRow'
import { LoadingSpinner } from '~/ui/Loaders'
import { MetricChip, metricOptionChipStyles, metricSeriesToggleStyles } from '~/ui/MetricChip'
import { NoResults } from '~/ui/NoResults'
import { OptionTile } from '~/ui/OptionTile'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { popoverMenuItemStyles } from '~/ui/Popover'
import { MenuItem, MenuSurface } from '~/ui/PopoverSurface'
import { PromoBadge } from '~/ui/PromoBadge'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { RailItem } from '~/ui/RailItem'
import { SearchField } from '~/ui/SearchField'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Skeleton } from '~/ui/Skeleton'
import {
	InlineStatus,
	LoadingIndicator,
	PanelLoadingStatus,
	PanelStatus,
	SurfaceBodyLoadingStatus,
	SurfaceBodyStatus
} from '~/ui/Status'
import { StatusDot } from '~/ui/StatusBadge'
import { InlineStatStrip, StatItem, StatTile, SummaryChange } from '~/ui/SummaryStats'
import { Switch } from '~/ui/Switch'
import { Tabs } from '~/ui/Tabs'
import { Tag, TagButton } from '~/ui/Tag'
import { Tooltip } from '~/ui/Tooltip'
import { ImageReplaceTile, UploadTile } from '~/ui/UploadTile'
import { Cell, Example, type ForcedState, Group, NotApplicable, Row, StateGrid } from './shared'

/* ------------------------------- Actions -------------------------------- */

const BUTTON_STATES = ['Rest', 'Hover', 'Focus', 'Pressed', 'Selected', 'Disabled', 'Pending'] as const
const BUTTON_VARIANTS = [
	'secondary',
	'primary',
	'outline',
	'destructive',
	'ghost',
	'ghostDestructive',
	'filter',
	'toggle',
	'metricBrowse',
	'floating',
	'overlay',
	'onMedia',
	'onBrand'
] as const
const SELECTABLE = new Set(['ghost', 'filter', 'toggle'])

function buttonRow(variant: (typeof BUTTON_VARIANTS)[number], size: 'sm' | 'md' | 'lg', square: boolean): ReactNode {
	const label = square ? <Icon name="settings" className="size-4" aria-hidden /> : 'Action'
	const common = { variant, size, square, 'aria-label': square ? 'Settings' : undefined }
	// The overlay arrow stays hidden until its rail is hovered, so its cells sit in a rail that is forced hovered.
	// onMedia and onBrand only read on what they are built for: a picture and the blue header.
	const cell = (force: ForcedState | undefined, node: ReactNode) =>
		variant === 'overlay' ? (
			<Cell force="hover">
				<div className="group/rail">
					<Cell force={force}>{node}</Cell>
				</div>
			</Cell>
		) : variant === 'onMedia' ? (
			<div className="rounded-md bg-cover bg-center p-1.5" style={{ backgroundImage: 'url(/reports/rwafi.png)' }}>
				<Cell force={force}>{node}</Cell>
			</div>
		) : variant === 'onBrand' ? (
			<div className="rounded-md bg-brand p-1.5">
				<Cell force={force}>{node}</Cell>
			</div>
		) : (
			<Cell force={force}>{node}</Cell>
		)
	return (
		<>
			{cell(undefined, <Button {...common}>{label}</Button>)}
			{cell('hover', <Button {...common}>{label}</Button>)}
			{cell('focus-visible', <Button {...common}>{label}</Button>)}
			{cell('active', <Button {...common}>{label}</Button>)}
			{SELECTABLE.has(variant) ? (
				cell(
					undefined,
					<Button {...common} data-active>
						{label}
					</Button>
				)
			) : (
				<NotApplicable />
			)}
			{cell(
				undefined,
				<Button {...common} disabled>
					{label}
				</Button>
			)}
			{cell(
				undefined,
				<Button {...common} pendingLabel="Saving…" pending>
					{label}
				</Button>
			)}
		</>
	)
}

const FORMATS = ['CSV', 'JSON'] as const

function SplitButtonDemo() {
	const menu = Ariakit.useMenuStore<{ format: (typeof FORMATS)[number] }>({ defaultValues: { format: 'CSV' } })
	const { format } = Ariakit.useStoreState(menu, 'values')
	return (
		<ButtonGroup label="Download">
			<Button variant="primary" size="md">
				<Icon name="download-cloud" className="size-3.5" aria-hidden />
				Download {format}
			</Button>
			<Ariakit.MenuProvider store={menu}>
				<Ariakit.MenuButton aria-label="Choose download format" render={<Button variant="primary" size="md" square />}>
					<Icon name="chevron-down" className="size-3.5" aria-hidden />
				</Ariakit.MenuButton>
				<MenuSurface variant="actions" className="min-w-32">
					{FORMATS.map((option) => (
						<Ariakit.MenuItemRadio
							key={option}
							name="format"
							value={option}
							hideOnClick
							className={popoverMenuItemStyles}
						>
							<span className="mr-auto">{option}</span>
							<Icon name="check" className={`size-3.5 ${format === option ? 'text-link' : 'invisible'}`} />
						</Ariakit.MenuItemRadio>
					))}
				</MenuSurface>
			</Ariakit.MenuProvider>
		</ButtonGroup>
	)
}

export function ActionsGroup() {
	return (
		<Group id="actions" title="Actions">
			<Example
				wide
				name="Button"
				prop='size="md"'
				note="Every variant in every state. Selected (data-active) applies to ghost, filter and toggle. The overlay arrow sits in a forced-hover rail here; on a page it waits for the rail's hover."
			>
				<StateGrid
					columns={BUTTON_STATES}
					rows={BUTTON_VARIANTS.map((variant) => [variant, buttonRow(variant, 'md', false)])}
				/>
			</Example>
			<Example
				wide
				name="Button"
				prop='size="sm"'
				note="Dense card headers and rows of sm controls; never beside md ones."
			>
				<StateGrid
					columns={BUTTON_STATES}
					rows={BUTTON_VARIANTS.map((variant) => [variant, buttonRow(variant, 'sm', false)])}
				/>
			</Example>
			<Example
				wide
				name="Button"
				prop="square"
				note="Icon-only, 16px icon, with a Tooltip as the button (render) on a page. onMedia turns round when square; onBrand squares on the mobile header are lg."
			>
				<StateGrid
					columns={BUTTON_STATES}
					rows={[
						...(['secondary', 'ghost', 'ghostDestructive', 'primary'] as const).flatMap((variant) => [
							[`${variant} md`, buttonRow(variant, 'md', true)] as [string, ReactNode],
							[`${variant} sm`, buttonRow(variant, 'sm', true)] as [string, ReactNode]
						]),
						['onMedia md', buttonRow('onMedia', 'md', true)],
						['onBrand lg', buttonRow('onBrand', 'lg', true)]
					]}
				/>
			</Example>
			<Example
				name="Button"
				prop="stateIcon"
				note="A toggle pill that adds or removes something shows plus when off and check when on, in one slot: picking never changes its width."
			>
				<Row>
					<Button variant="toggle" size="md" stateIcon>
						Newsletter
					</Button>
					<Button variant="toggle" size="md" stateIcon data-active>
						Research Notes
					</Button>
				</Row>
			</Example>
			<Example
				name="Button"
				prop="doneLabel"
				note="A button that confirms in its label keeps one width: the idle and done labels share a grid cell."
			>
				<Row>
					<Button size="md" doneLabel="Copied">
						<Icon name="copy" className="size-3.5" aria-hidden />
						Copy link
					</Button>
					<Button size="md" doneLabel="Copied" done>
						<Icon name="copy" className="size-3.5" aria-hidden />
						Copy link
					</Button>
				</Row>
			</Example>
			<Example
				name="Button"
				prop='size="lg"'
				note="One standalone, full-width conversion CTA (pricing, checkout). Beside an input it stays md."
			>
				<Button variant="primary" size="lg">
					Start free trial
				</Button>
			</Example>
			<Example
				name="Button"
				prop='variant="link"'
				note="A text action inside a sentence or on a text edge; it takes the sentence's type."
			>
				<p className="body-sm text-secondary">
					Already have an account?{' '}
					<Button variant="link" type="button">
						Sign in
					</Button>
				</p>
			</Example>
			<Example
				name="ButtonGroup"
				note="A command plus the menu that changes it: the arrow opens the format menu, and the pick becomes the command (Downloads' FormatSplitButton)."
			>
				<SplitButtonDemo />
			</Example>
			<Example name="Button" prop="with icon" note="A 14px icon (size-3.5) before the label.">
				<Row>
					<Button size="md">
						<Icon name="download" className="size-3.5" aria-hidden />
						Download
					</Button>
					<Button size="sm">
						<Icon name="download" className="size-3.5" aria-hidden />
						Download
					</Button>
				</Row>
			</Example>
			<Example
				name="FileButton"
				note="Pick files from the device: a Button over a hidden input. The chosen name and progress show beside it."
			>
				<FileButton accept=".csv,text/csv" size="md" onFiles={() => {}}>
					<Icon name="paperclip" className="size-3.5" aria-hidden />
					Upload CSV file
				</FileButton>
			</Example>
			<Example
				wide
				name="UploadTile"
				prop='shape="wide" | "round"'
				note="The dashed target that opens a file picker. A pending upload swaps the icon for a spinner and reads the pending label."
			>
				<StateGrid
					columns={['Rest', 'Hover', 'Pressed', 'Uploading', 'Disabled']}
					rows={(['wide', 'round'] as const).map((shape) => [
						shape,
						<>
							{([undefined, 'hover', 'active'] as const).map((force) => (
								<Cell key={force ?? 'rest'} force={force}>
									<UploadTile
										shape={shape}
										icon="image-plus"
										label="Upload logo"
										className={shape === 'wide' ? 'w-48' : undefined}
									/>
								</Cell>
							))}
							<UploadTile
								shape={shape}
								icon="image-plus"
								label="Upload logo"
								pendingLabel="Uploading…"
								pending
								className={shape === 'wide' ? 'w-48' : undefined}
							/>
							<UploadTile
								shape={shape}
								icon="image-plus"
								label="Upload logo"
								disabled
								className={shape === 'wide' ? 'w-48' : undefined}
							/>
						</>
					])}
				/>
			</Example>
			<Example
				name="ImageReplaceTile"
				prop='shape="round"'
				note="The current image; hover, focus and a pending upload show the media scrim."
			>
				<Row>
					<ImageReplaceTile shape="round" src="/assets/llama.png" aria-label="Replace avatar" />
					<Cell force="hover">
						<ImageReplaceTile shape="round" src="/assets/llama.png" aria-label="Replace avatar" />
					</Cell>
					<ImageReplaceTile
						shape="round"
						src="/assets/llama.png"
						pendingLabel="Uploading…"
						pending
						aria-label="Replace avatar"
					/>
				</Row>
			</Example>
		</Group>
	)
}

/* ------------------------------ Navigation ------------------------------ */

const PERIODS = [
	{ value: '7d', label: '7d' },
	{ value: '30d', label: '30d' },
	{ value: '90d', label: '90d' },
	{ value: 'all', label: 'All', disabled: true }
] as const

export function NavigationGroup() {
	const [period, setPeriod] = useState<string>('30d')
	const [tab, setTab] = useState('overview')
	return (
		<Group id="navigation" title="Navigation and choice">
			<Example
				wide
				name="SegmentedControl"
				note="Pick a value that reconfigures one region. The last option is disabled. mode stacks unless the caller lays it out (grid-flow-col here)."
			>
				<StateGrid
					columns={['size md', 'size sm']}
					rows={(['default', 'mode', 'chips', 'field', 'solid'] as const).map((variant) => [
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
			<Example name="ViewTabs" note="Underline tabs that head a page section, inside Tabs with their panels.">
				<Tabs value={tab} onValueChange={setTab} values={['overview', 'yields', 'risk']}>
					<ViewTabs
						label="Sections"
						tabs={[
							{ id: 'overview', label: 'Overview' },
							{ id: 'yields', label: 'Yields' },
							{ id: 'risk', label: 'Risk' }
						]}
					/>
				</Tabs>
			</Example>
			<Example
				name="RailItem"
				prop="active"
				note="A side nav, table of contents or criteria rail. Third row forced hovered, fourth pressed."
			>
				<div className="flex w-48 flex-col gap-0.5">
					<RailItem as="button" type="button">
						Overview
					</RailItem>
					<RailItem as="button" type="button" active aria-current="location">
						Revenue
					</RailItem>
					<Cell force="hover">
						<RailItem as="button" type="button">
							Token unlocks
						</RailItem>
					</Cell>
					<Cell force="active">
						<RailItem as="button" type="button">
							Governance
						</RailItem>
					</Cell>
				</div>
			</Example>
			<Example
				name="ListRow"
				prop="selected"
				note="A dialog or panel list that picks one item; the check slot keeps labels in place. Second row picked, third hovered."
			>
				<div className="flex w-64 flex-col gap-0.5">
					{['Stablecoins overview', 'Ethereum fees', 'Yields watchlist'].map((label, i) => {
						const row = (
							<ListRow selected={i === 1} aria-pressed={i === 1}>
								<span className="flex-1 truncate">{label}</span>
								<Icon name="check" className={`size-4 text-link ${i === 1 ? '' : 'invisible'}`} aria-hidden />
							</ListRow>
						)
						return i === 2 ? (
							<Cell key={label} force="hover">
								{row}
							</Cell>
						) : (
							<div key={label} className="contents">
								{row}
							</div>
						)
					})}
				</div>
			</Example>
			<Example
				wide
				name="OptionTile"
				prop='layout="stack" | "row" | "center"'
				note="A selectable tile with more than one line. The caller sets aria-pressed or role=checkbox."
			>
				<StateGrid
					columns={['Rest', 'Hover', 'Pressed', 'Selected', 'Disabled']}
					rows={(['stack', 'row', 'center'] as const).map((layout) => {
						const tile = (props: { selected?: boolean; disabled?: boolean }) => (
							<OptionTile
								layout={layout}
								selected={props.selected ?? false}
								disabled={props.disabled}
								aria-pressed={props.selected ?? false}
								className="w-40"
							>
								{layout === 'row' ? <Icon name="layers" className="size-4 shrink-0 text-tertiary" aria-hidden /> : null}
								{layout === 'center' ? <Icon name="layers" className="size-5 text-tertiary" aria-hidden /> : null}
								<span className="flex flex-col gap-0.5">
									<span className="label-md">By chain</span>
									<span className="body-xs text-secondary">One row per chain</span>
								</span>
							</OptionTile>
						)
						return [
							layout,
							<>
								<Cell>{tile({})}</Cell>
								<Cell force="hover">{tile({})}</Cell>
								<Cell force="active">{tile({})}</Cell>
								<Cell>{tile({ selected: true })}</Cell>
								<Cell>{tile({ disabled: true })}</Cell>
							</>
						]
					})}
				/>
			</Example>
		</Group>
	)
}

/* -------------------------------- Fields -------------------------------- */

const FIELD_STATES = ['Rest', 'Hover', 'Focus', 'Invalid', 'Disabled', 'Locked', 'Saving'] as const

function fieldRow(make: (props: Record<string, unknown>) => ReactNode): ReactNode {
	return (
		<>
			<Cell>{make({})}</Cell>
			<Cell force="hover">{make({})}</Cell>
			<Cell force="focus">{make({})}</Cell>
			<Cell>{make({ 'aria-invalid': true })}</Cell>
			<Cell>{make({ disabled: true })}</Cell>
			<Cell>{make({ readOnly: true, 'aria-disabled': true })}</Cell>
			<Cell>{make({ readOnly: true, 'aria-busy': true })}</Cell>
		</>
	)
}

export function FieldsGroup() {
	const [search, setSearch] = useState('aave')
	return (
		<Group id="fields" title="Fields">
			<Example
				wide
				name="Input / Textarea"
				note="Locked is readOnly + aria-disabled (a limit reached); Saving is readOnly + aria-busy (its own save running). Invalid comes from Field after a submit."
			>
				<StateGrid
					columns={FIELD_STATES}
					rows={[
						[
							'placeholder',
							fieldRow((p) => <Input aria-label="Name" placeholder="Dashboard name" className="w-44" {...p} />)
						],
						['value', fieldRow((p) => <Input aria-label="Name" defaultValue="Lending" className="w-44" {...p} />)],
						[
							'variant="code"',
							fieldRow((p) => (
								<Input variant="code" aria-label="Address" defaultValue="0x5f98…a1c4" className="w-44" {...p} />
							))
						],
						[
							'prefix',
							fieldRow((p) => (
								<Input prefix="/research/" aria-label="Slug" defaultValue="aave-v4" className="w-56" {...p} />
							))
						],
						[
							'suffix',
							fieldRow((p) => <Input suffix="%" aria-label="Share" defaultValue="12.5" className="w-32" {...p} />)
						],
						[
							'Textarea',
							fieldRow((p) => <Textarea aria-label="Notes" rows={2} placeholder="Notes" className="w-44" {...p} />)
						]
					]}
				/>
			</Example>
			<Example name="Field" prop="hint / error" note="Label above, then the hint, then the error after a submit.">
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Field label="Email" hint="We send the code here.">
						{(control) => <Input {...control} type="email" defaultValue="name@example.com" />}
					</Field>
					<Field label="Email" error="Enter a valid email address.">
						{(control) => <Input {...control} type="email" defaultValue="name@example" />}
					</Field>
				</div>
			</Example>
			<Example name="Field" prop="action" note="A link on the label row's right, in the hint's size.">
				<Field
					label="Password"
					action={
						<Button variant="link" type="button">
							Forgot password?
						</Button>
					}
				>
					{(control) => <Input {...control} type="password" defaultValue="hunter22" />}
				</Field>
			</Example>
			<Example name="Input" prop='variant="oneTimeCode"' note="A verification code: centred, spaced digits.">
				<Field label="Code">{(control) => <Input {...control} variant="oneTimeCode" placeholder="000000" />}</Field>
			</Example>
			<Example name="SearchField" note="A search with its clear button; the icon and placeholder stand in for a label.">
				<SearchField label="Search protocols" placeholder="Search protocols" value={search} onChange={setSearch} />
			</Example>
			<Example name="Input" prop='type="date"'>
				<Input type="date" aria-label="Start date" defaultValue="2026-10-08" className="cursor-pointer" />
			</Example>
			<Example name="FieldGroup" prop="error" note="A set of controls answered together, with one error.">
				<FieldGroup label="Delivery" error="Choose at least one channel.">
					<div className="flex gap-3">
						<Checkbox variant="inline" checked={false} onChange={() => {}}>
							Email
						</Checkbox>
						<Checkbox variant="inline" checked={false} onChange={() => {}}>
							Telegram
						</Checkbox>
					</div>
				</FieldGroup>
			</Example>
		</Group>
	)
}

/* ------------------------------- Selection ------------------------------ */

const CHAINS = ['Ethereum', 'Arbitrum', 'Base', 'Solana']
const CHANNELS = [
	{ key: 'alerts', name: '#alerts' },
	{ key: 'research', name: '#research' },
	{ key: 'treasury', name: '#treasury', disabled: true, help: 'Private channel: invite the bot first' }
]

export function SelectionGroup() {
	const [chain, setChain] = useState('Ethereum')
	const [chains, setChains] = useState(['Ethereum', 'Base'])
	const [on, setOn] = useState(true)
	const [channel, setChannel] = useState('alerts')
	return (
		<Group id="selection" title="Selection">
			<Example wide name="Checkbox" note="Every wrapper variant in every state; Saving is isLoading.">
				<StateGrid
					columns={['Unchecked', 'Checked', 'Hover', 'Focus', 'Disabled', 'Saving']}
					rows={(['default', 'inline', 'inline-sm', 'consent', 'filter'] as const).map((variant) => [
						variant,
						<>
							<Cell>
								<Checkbox variant={variant} checked={false} onChange={() => {}}>
									Show fees
								</Checkbox>
							</Cell>
							<Cell>
								<Checkbox variant={variant} checked onChange={() => {}}>
									Show fees
								</Checkbox>
							</Cell>
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
							<Cell>
								<Checkbox variant={variant} checked disabled onChange={() => {}}>
									Show fees
								</Checkbox>
							</Cell>
							<Cell>
								<Checkbox variant={variant} checked isLoading onChange={() => {}}>
									Show fees
								</Checkbox>
							</Cell>
						</>
					])}
				/>
			</Example>
			<Example name="Switch" note="An on-off setting: on, off, disabled and saving.">
				<Row>
					<Switch label="Alerts" value="alerts" checked={on} onChange={() => setOn(!on)} />
					<Switch label="Off" value="off" checked={false} onChange={() => {}} />
					<Switch label="Disabled" value="disabled" checked disabled onChange={() => {}} />
					<Switch label="Saving" value="saving" checked isLoading onChange={() => {}} />
				</Row>
			</Example>
			<Example
				name="Select"
				prop="disabled option"
				note="Open it: #treasury stays in the list, disabled, with its reason."
			>
				<Select
					label="Channel"
					allValues={CHANNELS}
					selectedValues={channel}
					setSelectedValues={setChannel}
					variant="input"
					size="md"
				/>
			</Example>
			<Example wide name="Select" prop="variant × size" note="Single pick at md, multi pick at sm.">
				<StateGrid
					columns={['size md', 'size sm']}
					rows={(['default', 'filter', 'input'] as const).map((variant) => [
						variant,
						<>
							<Select
								label="Chain"
								allValues={CHAINS}
								selectedValues={chain}
								setSelectedValues={setChain}
								variant={variant}
								size="md"
							/>
							<Select
								label="Chains"
								allValues={CHAINS}
								selectedValues={chains}
								setSelectedValues={setChains}
								variant={variant}
								size="sm"
							/>
						</>
					])}
				/>
			</Example>
		</Group>
	)
}

/* ---------------------------- Chips and badges --------------------------- */

const CHIP_FORCES = [undefined, 'hover', 'focus-visible'] as const

export function ChipsGroup() {
	return (
		<Group id="chips" title="Chips and badges">
			<Example
				wide
				name="MetricChip / TagButton"
				note="Chart metric and series chips, and a tag that filters on click."
			>
				<StateGrid
					columns={['Rest', 'Hover', 'Focus', 'Selected']}
					rows={[
						[
							'metricChip',
							<>
								{CHIP_FORCES.map((force) => (
									<Cell key={force ?? 'rest'} force={force}>
										<MetricChip label="TVL" color={CHART_COLORS[0]} onRemove={() => {}} />
									</Cell>
								))}
								<NotApplicable />
							</>
						],
						[
							'metricOptionChip',
							<>
								{CHIP_FORCES.map((force) => (
									<Cell key={force ?? 'rest'} force={force}>
										<button type="button" className={metricOptionChipStyles}>
											Fees
										</button>
									</Cell>
								))}
								<button type="button" className={metricOptionChipStyles} data-active="true">
									Fees
								</button>
							</>
						],
						[
							'metricSeriesToggle',
							<>
								{CHIP_FORCES.map((force) => (
									<Cell key={force ?? 'rest'} force={force}>
										<button type="button" className={metricSeriesToggleStyles}>
											Volume
										</button>
									</Cell>
								))}
								<button type="button" className={metricSeriesToggleStyles} data-active="true">
									Volume
								</button>
							</>
						],
						[
							'TagButton',
							<>
								{CHIP_FORCES.map((force) => (
									<Cell key={force ?? 'rest'} force={force}>
										<TagButton>Lending</TagButton>
									</Cell>
								))}
								<NotApplicable />
							</>
						]
					]}
				/>
			</Example>
			<Example name="Tag" note="A read-only label for one value out of a known set.">
				<Row>
					<Tag>Lending</Tag>
					<Tag>Liquid staking</Tag>
				</Row>
			</Example>
			<Example name="PromoBadge" note="New, 7-day trial, Free, Pro: one brand-tint badge.">
				<Row>
					<PromoBadge>New</PromoBadge>
					<PromoBadge icon="sparkles">7-day trial</PromoBadge>
				</Row>
			</Example>
			<Example name="CountBadge" note="How many values a picker holds or a dialog has applied.">
				<span className="flex items-center gap-1 label-sm text-primary">
					Chains <CountBadge count={3} />
				</span>
			</Example>
			<Example
				name="StatusDot"
				prop="status / label / pulse"
				note="A state as a dot on a quiet line; label names it when no text beside it does."
			>
				<Row>
					<span className="flex items-center gap-1.5 body-sm text-tertiary">
						<StatusDot status="good" />
						All changes saved
					</span>
					<span className="flex items-center gap-1.5 body-sm text-tertiary">
						<StatusDot status="caution" />
						Unsaved changes
					</span>
					<span className="flex items-center gap-1.5 body-sm text-tertiary">
						<StatusDot status="bad" />
						Disconnected
					</span>
					<span className="flex items-center gap-1.5 body-sm text-tertiary">
						<StatusDot status="neutral" pulse />
						Saving
					</span>
					<StatusDot status="good" label="Published" />
				</Row>
			</Example>
			<Example name="Keycap" prop="onBrand" note="A key in a keyboard hint; onBrand inside a brand-filled button.">
				<Row>
					<span className="flex items-center gap-1 body-sm text-tertiary">
						<Keycap>⌘</Keycap>
						<Keycap>↵</Keycap>
						run
					</span>
					<Button variant="primary" size="sm">
						Run
						<span aria-hidden className="flex items-center gap-0.5">
							<Keycap onBrand>⌘</Keycap>
							<Keycap onBrand>↵</Keycap>
						</span>
					</Button>
				</Row>
			</Example>
			<Example name="QuestionHelper / Tooltip" note="A definition beside a label; short hover text.">
				<Row>
					<span className="flex items-center gap-1 label-sm text-primary">
						TVL <QuestionHelper text="Total value locked in the protocol's contracts." />
					</span>
					<Tooltip content="Tooltip text">
						<span className="body-sm text-link">Hover for a tooltip</span>
					</Tooltip>
				</Row>
			</Example>
			<Example
				name="Change"
				prop="unit / tooltip"
				note="A signed movement: up green, down red, zero in its container's colour. The tooltip holds the same movement in another unit."
			>
				<Row>
					<Change value={4.21} />
					<Change value={-3.12} />
					<Change value={0} />
					<Change value={52_100_000} unit="usd" />
					<Change value={-1234} unit="count" />
					<Change value={0.12} unit="pp" />
					<Change value={1.4} tooltip="+$2.1b" />
				</Row>
			</Example>
		</Group>
	)
}

/* ------------------------------- Feedback ------------------------------- */

export function FeedbackGroup() {
	const retry = (
		<Button size="sm" type="button">
			Try again
		</Button>
	)
	return (
		<Group id="feedback" title="Feedback">
			<Example
				wide
				name="InlineStatus"
				note="A message in a dialog or above content. The icon sits on the first line; action is the one sm button that answers it, and wraps under the text when the box is narrow."
			>
				<div className="flex max-w-[720px] flex-col gap-3">
					<InlineStatus variant="error">Couldn&rsquo;t send the report. Try again.</InlineStatus>
					<InlineStatus variant="error" action={retry}>
						Couldn&rsquo;t load your dashboards.
					</InlineStatus>
					<div className="max-w-[360px]">
						<InlineStatus variant="error" action={retry}>
							Couldn&rsquo;t refresh yield pools. Showing the last loaded data.
						</InlineStatus>
					</div>
					<InlineStatus variant="warning">
						Your subscription has ended, so this dashboard is view-only.{' '}
						<Button variant="link" type="button">
							Renew
						</Button>
					</InlineStatus>
					<InlineStatus variant="empty">No saved queries yet.</InlineStatus>
				</div>
			</Example>
			<Example
				wide
				name="PanelLoadingStatus / PanelStatus"
				note="A whole panel is the state. Loading draws the animated LoadingIndicator; the text statuses take only empty and error."
			>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
					<PanelLoadingStatus className="min-h-[140px]" />
					<PanelStatus variant="empty" className="min-h-[140px]">
						No pools match current filters
					</PanelStatus>
					<PanelStatus variant="error" className="min-h-[140px]">
						Couldn&rsquo;t load pools.
					</PanelStatus>
				</div>
			</Example>
			<Example
				name="SurfaceBodyLoadingStatus / SurfaceBodyStatus"
				note="The same states inside a rendered Panel or Card body."
			>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<Card padding="none">
						<SurfaceBodyLoadingStatus className="min-h-[120px]" />
					</Card>
					<Card padding="none">
						<SurfaceBodyStatus variant="empty" className="min-h-[120px]">
							No routes match.
						</SurfaceBodyStatus>
					</Card>
				</div>
			</Example>
			<Example
				name="LoadingIndicator / LoadingSpinner"
				note="Quiet loading copy; the spinner only inside a busy control."
			>
				<Row>
					<LoadingIndicator />
					<LoadingIndicator label="Loading chats" />
					<LoadingSpinner size={14} />
				</Row>
			</Example>
			<Example
				name="Skeleton"
				note="A placeholder shape. Radius defaults to 4px (initial:); a caller's rounded-* wins."
			>
				<Row>
					<Skeleton className="h-3 w-40" />
					<Skeleton className="size-10 rounded-lg" />
					<Skeleton className="size-10 rounded-full" />
				</Row>
			</Example>
			<Example name="NoResults" note="An empty result in a list, popover or table.">
				<div className="rounded-lg border border-subtle bg-overlay">
					<NoResults />
				</div>
			</Example>
		</Group>
	)
}

/* ------------------------------- Surfaces ------------------------------- */

export function SurfacesGroup() {
	return (
		<Group id="surfaces" title="Surfaces">
			<Example name="Panel" note="The titled chart or table shell; header controls are md.">
				<Panel>
					<PanelHeader>
						<PanelTitle>Fees by chain</PanelTitle>
						<Button size="md">.csv</Button>
					</PanelHeader>
					<p className="p-4 body-sm text-secondary">Charts and tables sit flush in the body.</p>
				</Panel>
			</Example>
			<Example name="Card" prop="padding" note="A repeated content tile; padding is required.">
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{(['none', 'sm', 'md', 'strip'] as const).map((padding) => (
						<Card key={padding} padding={padding}>
							<span className="body-sm text-primary">{padding}</span>
						</Card>
					))}
				</div>
			</Example>
			<Example wide name="StatTile" note="A grid of KPI tiles: value, change, definition, a line under it, or loading.">
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
					<StatTile label="Revenue (30d)" value="$12.4m" sub="Across 14 chains" />
					<StatTile
						label="Fees (24h)"
						value="$1.06m"
						change={{ value: 3.2, comparison: 'vs 24h ago', tooltip: '+$32.9k' }}
					/>
					<StatTile label="Active loans" value="$1.82b" tooltip="Borrowed value still outstanding." />
					<StatTile label="Holders" loading />
				</div>
			</Example>
			<Example
				name="SummaryChange"
				note="A headline's change beside its StatItem: the change, then the window it covers. Containers take the change as data."
			>
				<div className="flex flex-wrap items-end justify-between gap-2">
					<StatItem label="Total Value Locked" value="$4.82b" />
					<SummaryChange value={-2.2} comparison="over 24h" tooltip="-$108.4m" />
				</div>
			</Example>
			<Example
				wide
				name="InlineStatStrip"
				prop="change"
				note="Label and value pairs above a table; a change carries its window."
			>
				<InlineStatStrip
					items={[
						{ label: 'Market cap', value: '$2.41t', change: { value: 1.84, comparison: 'over 24h' } },
						{
							label: 'Volume (24h)',
							value: '$96.2b',
							change: { value: -4_120_000_000, unit: 'usd', comparison: 'vs 24h ago' }
						},
						{ label: 'Tokens', value: '12,418', change: { value: 0, unit: 'count', comparison: 'over 7d' } }
					]}
				/>
			</Example>
			<Example
				name="Text tiers"
				note="Text and data colours on a surface. Data colours only reach text through Change."
			>
				<div className="grid grid-cols-2 gap-x-6 gap-y-1">
					<span className="body-sm text-primary">text-primary</span>
					<span className="body-sm text-link">text-link</span>
					<span className="body-sm text-secondary">text-secondary</span>
					<span className="body-sm text-secondary">
						data-up <Change value={2.41} />
					</span>
					<span className="body-sm text-tertiary">text-tertiary</span>
					<span className="body-sm text-secondary">
						data-down <Change value={-3.12} />
					</span>
					<span className="body-sm text-disabled">text-disabled</span>
					<span className="body-sm text-warning">text-warning</span>
					<span />
					<span className="body-sm text-error">text-error</span>
				</div>
			</Example>
		</Group>
	)
}

/* ------------------------------- Overlays ------------------------------- */

export function OverlaysGroup() {
	const [dialog, setDialog] = useState(false)
	const [confirm, setConfirm] = useState(false)
	return (
		<Group id="overlays" title="Overlays">
			<Example
				name="Dialog"
				prop='size="sm"'
				note="A modal task or form. Overlays render in a portal, so they follow the page theme."
			>
				<Button size="md" onClick={() => setDialog(true)}>
					Open dialog
				</Button>
				<Dialog size="sm" open={dialog} onClose={() => setDialog(false)} unmountOnHide>
					<DialogHeader title="Rename dashboard" subtitle="Names show in the sidebar." />
					<DialogBody>
						<Field label="Name">{(control) => <Input {...control} defaultValue="Lending" />}</Field>
						<InlineStatus variant="error">Could not save changes. Your draft is still here. Try again.</InlineStatus>
					</DialogBody>
					<DialogFooter dismiss={<DialogCancelButton />}>
						<Button size="md" variant="primary">
							Save
						</Button>
					</DialogFooter>
				</Dialog>
			</Example>
			<Example name="ConfirmDialog" prop='tone="destructive"' note="Confirm a choice before an irreversible action.">
				<Button size="md" variant="destructive" onClick={() => setConfirm(true)}>
					Delete dashboard
				</Button>
				<ConfirmDialog
					open={confirm}
					onClose={() => setConfirm(false)}
					title="Delete dashboard?"
					description="This removes the dashboard for everyone on your team."
					confirmLabel="Delete"
					error={null}
					tone="destructive"
					onConfirm={() => setConfirm(false)}
				/>
			</Example>
			<Example name="MenuSurface / MenuItem" prop="destructive" note="A menu of actions; a delete row is destructive.">
				<Ariakit.MenuProvider>
					<Ariakit.MenuButton render={<Button size="md" />}>
						Actions
						<Ariakit.MenuButtonArrow />
					</Ariakit.MenuButton>
					<MenuSurface variant="actions">
						<MenuItem>Rename</MenuItem>
						<MenuItem>Duplicate</MenuItem>
						<MenuItem destructive>Delete</MenuItem>
					</MenuSurface>
				</Ariakit.MenuProvider>
			</Example>
		</Group>
	)
}
