import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { ChartMetricsDialog, type ChartMetricGroup, type ChartMetricOption } from '~/components/ChartMetricsDialog'
import {
	ActiveFilterCard,
	FilterBrowser,
	FilterBuilderContent,
	FilterBuilderDialog,
	FilterNumberInput,
	NoActiveFilters
} from '~/components/FilterBuilderDialog'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import {
	Dialog,
	DialogBackButton,
	DialogBody,
	DialogCancelButton,
	DialogCloseButton,
	DialogDiscardGuard,
	DialogFooter,
	DialogHeader,
	DialogSearchHeader,
	DialogToolbar,
	SideSheet
} from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { ListRow } from '~/ui/ListRow'
import { SearchField } from '~/ui/SearchField'
import { InlineStatus } from '~/ui/Status'
import { Example, type Family, type KnobValues } from '../shared'

const DIALOG_SIZES = ['sm', 'md', 'lg', 'xl'] as const
const DASHBOARDS = ['Stablecoins overview', 'Ethereum fees', 'Yields watchlist']
const PROTOCOLS = ['Aave', 'Lido', 'Uniswap']

type MetricGroup = {
	label: string
	options: Array<Pick<ChartMetricOption, 'key' | 'label' | 'description' | 'locked'>>
}

const METRIC_GROUPS: Array<MetricGroup> = [
	{
		label: 'Value',
		options: [
			{ key: 'tvl', label: 'TVL', description: 'Total value locked in the protocol' },
			{ key: 'mcap', label: 'Market cap' },
			{ key: 'fdv', label: 'FDV' }
		]
	},
	{
		label: 'Activity',
		options: [
			{ key: 'fees', label: 'Fees' },
			{ key: 'revenue', label: 'Revenue' },
			{ key: 'volume', label: 'Volume' },
			{ key: 'users', label: 'Active users' }
		]
	},
	{ label: 'Pro', options: [{ key: 'holders', label: 'Holders', locked: true }] }
]
const TOKEN_METRICS: MetricGroup = {
	label: 'Token',
	options: [
		{ key: 'price', label: 'Price' },
		{ key: 'supply', label: 'Supply' },
		{ key: 'unlocks', label: 'Unlocks' },
		{ key: 'emissions', label: 'Emissions' },
		{ key: 'buybacks', label: 'Buybacks' },
		{ key: 'inflows', label: 'Inflows' }
	]
}

const FILTERS = [
	{ id: 'tvl', label: 'TVL', category: 'Size' },
	{ id: 'mcap', label: 'Market cap', category: 'Size' },
	{ id: 'fees', label: 'Fees 24h', category: 'Activity' },
	{ id: 'volume', label: 'Volume 24h', category: 'Activity' }
]

// The caller owns the draft: each opening remounts this, so it starts from what the table shows.
function FilterSession({ applied, onApply }: { applied: Array<string>; onApply: (ids: Array<string>) => void }) {
	const [draft, setDraft] = useState(applied)
	const [values, setValues] = useState<Record<string, string>>({})
	return (
		<FilterBuilderContent
			draftCount={draft.length}
			browse={
				<FilterBrowser
					groups={['Size', 'Activity'].map((category) => ({
						label: category,
						filters: FILTERS.filter((filter) => filter.category === category && !draft.includes(filter.id))
					}))}
					onAdd={(id) => setDraft([...draft, id])}
				/>
			}
			active={
				draft.length === 0 ? (
					<NoActiveFilters />
				) : (
					FILTERS.filter((filter) => draft.includes(filter.id)).map((filter) => (
						<ActiveFilterCard
							key={filter.id}
							label={filter.label}
							category={filter.category}
							onRemove={() => setDraft(draft.filter((id) => id !== filter.id))}
						>
							<FilterNumberInput
								label={`${filter.label} minimum`}
								placeholder="Min"
								prefix="$"
								value={values[filter.id] ?? ''}
								onChange={(value) => setValues({ ...values, [filter.id]: value })}
							/>
						</ActiveFilterCard>
					))
				)
			}
			onClearAll={() => setDraft([])}
			onApply={() => onApply(draft)}
		/>
	)
}

const withState = (groups: Array<MetricGroup>, active: Array<string>): Array<ChartMetricGroup<ChartMetricOption>> =>
	groups.map((group) => ({
		label: group.label,
		options: group.options.map((option) => ({
			...option,
			color: 'var(--text-link)',
			active: active.includes(option.key)
		}))
	}))

function DialogDemo({ values }: { values: KnobValues }) {
	const [open, setOpen] = useState(false)
	const close = () => setOpen(false)
	const layout = values.layout as 'plain' | 'fullSheet' | 'canvas' | 'workspace'
	return (
		<>
			<Button size="md" onClick={() => setOpen(true)}>
				Open dialog
			</Button>
			<Dialog
				size={values.size as (typeof DIALOG_SIZES)[number]}
				fullSheet={layout === 'fullSheet'}
				canvas={layout === 'canvas'}
				workspace={layout === 'workspace'}
				open={open}
				onClose={close}
				unmountOnHide
			>
				{layout === 'workspace' ? (
					<>
						<DialogHeader
							title="Query editor"
							actions={
								<Button size="md">
									<Icon name="copy" className="size-3.5" aria-hidden />
									Copy
								</Button>
							}
						/>
						<DialogBody kind="flush">
							<div className="grid min-h-full grid-cols-1 md:grid-cols-2">
								<div className="border-b border-subtle p-4 body-sm text-secondary md:border-r md:border-b-0">
									Editor pane
								</div>
								<div className="p-4 body-sm text-secondary">Results pane</div>
							</div>
						</DialogBody>
					</>
				) : (
					<>
						<DialogHeader title="Rename dashboard" subtitle="Names show in the sidebar." />
						<DialogBody>
							{layout === 'canvas' ? (
								<>
									<Card padding="base">
										<span className="body-sm text-primary">TVL</span>
									</Card>
									<Card padding="base">
										<span className="body-sm text-primary">Fees</span>
									</Card>
								</>
							) : (
								<>
									<Field label="Name">{(control) => <Input {...control} defaultValue="Lending" />}</Field>
									{values.state === 'save failed' ? (
										<InlineStatus variant="error">
											Couldn't save changes. Your draft is still here. Try again.
										</InlineStatus>
									) : null}
								</>
							)}
						</DialogBody>
						<DialogFooter dismiss={<DialogCancelButton />}>
							<Button size="md" variant="primary" onClick={close}>
								Save
							</Button>
						</DialogFooter>
					</>
				)}
			</Dialog>
		</>
	)
}

function DialogPartsDemo() {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const close = () => setOpen(false)
	return (
		<Example
			name="Header, toolbar, list body and footer"
			prop='DialogHeader leading, actions | DialogBody kind="list" | DialogFooter leading'
			note="A back button and actions slot in the header, a search in the toolbar, a footer with a leading action, Cancel and the primary action."
		>
			<Button size="md" onClick={() => setOpen(true)}>
				Open dialog
			</Button>
			<Dialog size="md" open={open} onClose={close} unmountOnHide>
				<DialogHeader
					leading={<DialogBackButton label="Back to choices" onClick={close} />}
					title="Add to dashboard"
					subtitle="Pick the dashboard that gets this chart."
					actions={<Button size="md">New</Button>}
				/>
				<DialogToolbar>
					<SearchField label="Search dashboards" placeholder="Search dashboards" value={query} onChange={setQuery} />
				</DialogToolbar>
				<DialogBody kind="list">
					{DASHBOARDS.map((name, index) => (
						<ListRow key={name} selected={index === 1} aria-pressed={index === 1}>
							<span className="flex-1 truncate">{name}</span>
							<Icon name="check" className={`size-4 text-link ${index === 1 ? '' : 'invisible'}`} aria-hidden />
						</ListRow>
					))}
				</DialogBody>
				<DialogFooter
					leading={
						<Button size="md" variant="ghost">
							Clear all
						</Button>
					}
					dismiss={<DialogCancelButton />}
				>
					<Button size="md" variant="primary" onClick={close}>
						Add
					</Button>
				</DialogFooter>
			</Dialog>
		</Example>
	)
}

function DialogPendingDemo() {
	const [open, setOpen] = useState(false)
	const [saving, setSaving] = useState(false)
	const close = () => setOpen(false)
	return (
		<Example
			name="Saving"
			prop="pending"
			note="Save locks the surface for 2.5 seconds: the ×, Cancel, Escape and an outside tap stop closing it."
		>
			<Button size="md" onClick={() => setOpen(true)}>
				Open dialog
			</Button>
			<Dialog size="sm" pending={saving} open={open} onClose={close} unmountOnHide>
				<DialogHeader title="Rename dashboard" />
				<DialogBody>
					<Field label="Name">{(control) => <Input {...control} defaultValue="Lending" />}</Field>
				</DialogBody>
				<DialogFooter dismiss={<DialogCancelButton />}>
					<Button
						size="md"
						variant="primary"
						pendingLabel="Saving…"
						pending={saving}
						onClick={() => {
							setSaving(true)
							setTimeout(() => {
								setSaving(false)
								close()
							}, 2500)
						}}
					>
						Save
					</Button>
				</DialogFooter>
			</Dialog>
		</Example>
	)
}

function SideSheetDemo({ values }: { values: KnobValues }) {
	const [open, setOpen] = useState(false)
	const close = () => setOpen(false)
	const canvas = values.canvas === true
	return (
		<>
			<Button size="md" onClick={() => setOpen(true)}>
				Open side sheet
			</Button>
			<SideSheet size={values.size as 'sm' | 'md' | 'lg'} canvas={canvas} open={open} onClose={close} unmountOnHide>
				<DialogHeader title={canvas ? 'Saved views' : 'Aave'} subtitle={canvas ? undefined : 'Protocol details'} />
				<DialogBody>
					{canvas ? (
						<Card padding="base">
							<span className="body-sm text-primary">Weekly fees</span>
						</Card>
					) : (
						<p className="body-sm text-secondary">Detail content scrolls inside the sheet.</p>
					)}
				</DialogBody>
				<DialogFooter dismiss={<DialogCancelButton>Close</DialogCancelButton>} />
			</SideSheet>
		</>
	)
}

function ConfirmDemo({ values }: { values: KnobValues }) {
	const [open, setOpen] = useState(false)
	const [flow, setFlow] = useState<'idle' | 'pending' | 'error' | 'waiting'>('idle')
	const tone = values.tone as 'destructive' | 'primary'
	const outcome = values.outcome as 'closes' | 'pending' | 'error' | 'waiting'
	const destructive = tone === 'destructive'
	const close = () => setOpen(false)
	return (
		<>
			<Button
				size="md"
				variant={destructive ? 'destructive' : 'secondary'}
				onClick={() => {
					setFlow(outcome === 'waiting' ? 'waiting' : 'idle')
					if (outcome === 'waiting') setTimeout(() => setFlow('idle'), 2500)
					setOpen(true)
				}}
			>
				{destructive ? 'Delete dashboard' : 'Publish report'}
			</Button>
			<ConfirmDialog
				open={open}
				onClose={close}
				unmountOnHide
				title={destructive ? 'Delete dashboard?' : 'Publish report?'}
				description={
					destructive
						? 'This removes the dashboard for everyone on your team.'
						: 'Readers can open it from the research page.'
				}
				confirmLabel={destructive ? 'Delete' : 'Publish'}
				// The waiting outcome names the safe choice, as a check the choice waits on makes "Cancel" ambiguous.
				cancelLabel={outcome === 'waiting' ? 'Keep it' : undefined}
				pendingLabel={destructive ? 'Deleting…' : 'Publishing…'}
				pending={flow === 'pending'}
				waitingLabel={flow === 'waiting' ? 'Checking…' : null}
				error={flow === 'error' ? "Couldn't finish. Try again." : null}
				tone={tone}
				onConfirm={() => {
					if (outcome === 'pending') {
						setFlow('pending')
						setTimeout(close, 2500)
					} else if (outcome === 'error') {
						setFlow('pending')
						setTimeout(() => setFlow('error'), 2000)
					} else close()
				}}
			/>
		</>
	)
}

function ConfirmActionDemo({ values }: { values: KnobValues }) {
	const [open, setOpen] = useState(false)
	const failing = values.outcome === 'fails'
	const destructive = values.tone === 'destructive'
	// A static mutation that settles after 1.5 seconds: a failure leaves the dialog open, a success closes it.
	const mutation = useMutation({
		mutationFn: () =>
			new Promise<void>((resolve, reject) =>
				setTimeout(() => (failing ? reject(new Error('Request failed')) : resolve()), 1500)
			)
	})
	return (
		<>
			<Button size="md" variant={destructive ? 'destructive' : 'secondary'} onClick={() => setOpen(true)}>
				{destructive ? 'Delete dashboard' : 'Archive dashboard'}
			</Button>
			{open ? (
				<ConfirmActionDialog
					title={destructive ? 'Delete dashboard?' : 'Archive dashboard?'}
					description={
						destructive
							? 'This removes the dashboard for everyone on your team.'
							: 'Archived dashboards leave the sidebar.'
					}
					confirmLabel={destructive ? 'Delete' : 'Archive'}
					pendingLabel={destructive ? 'Deleting…' : 'Archiving…'}
					tone={values.tone as 'destructive' | 'primary'}
					errorMessage={destructive ? "Couldn't delete the dashboard." : "Couldn't archive the dashboard."}
					mutation={mutation}
					variables={undefined}
					onClose={() => setOpen(false)}
				/>
			) : null}
		</>
	)
}

function DiscardGuardDemo({ values }: { values: KnobValues }) {
	const [open, setOpen] = useState(false)
	const [draft, setDraft] = useState('Lending')
	const close = () => setOpen(false)
	return (
		<>
			<Button
				size="md"
				onClick={() => {
					setDraft('Lending')
					setOpen(true)
				}}
			>
				Open dialog
			</Button>
			<Dialog size="sm" open={open} onClose={close} unmountOnHide>
				<DialogDiscardGuard
					when={values.when === true}
					title="Discard changes?"
					description="Your edits to the dashboard name are lost."
				/>
				<DialogHeader
					leading={<DialogBackButton label="Back to dashboards" onClick={close} />}
					title="Rename dashboard"
				/>
				<DialogBody>
					<Field label="Name">
						{(control) => (
							<Input {...control} value={draft} onChange={(event) => setDraft(event.currentTarget.value)} />
						)}
					</Field>
				</DialogBody>
				<DialogFooter dismiss={<DialogCancelButton>Keep editing</DialogCancelButton>}>
					<Button size="md" variant="primary" onClick={close}>
						Save
					</Button>
				</DialogFooter>
			</Dialog>
		</>
	)
}

function SearchHeaderDemo() {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	return (
		<>
			<Button size="md" onClick={() => setOpen(true)}>
				Open palette
			</Button>
			<Dialog size="md" open={open} onClose={() => setOpen(false)} unmountOnHide>
				<DialogSearchHeader title="Search">
					<SearchField
						label="Search"
						placeholder="Search protocols, chains…"
						value={query}
						onChange={setQuery}
						autoFocus
					/>
				</DialogSearchHeader>
				<DialogBody kind="list">
					{PROTOCOLS.map((name) => (
						<ListRow key={name}>
							<span className="flex-1 truncate">{name}</span>
						</ListRow>
					))}
				</DialogBody>
			</Dialog>
		</>
	)
}

function CloseButtonDemo() {
	const [open, setOpen] = useState(false)
	return (
		<>
			<Button size="md" onClick={() => setOpen(true)}>
				Open menu
			</Button>
			<Dialog size="sm" aria-label="Navigation menu" open={open} onClose={() => setOpen(false)} unmountOnHide>
				<div className="flex shrink-0 px-4 py-2.5">
					<DialogCloseButton className="ml-auto" ariaLabel="Close navigation menu" />
				</div>
				<DialogBody kind="list">
					{['Home', 'Yields', 'Stablecoins'].map((name) => (
						<ListRow key={name}>{name}</ListRow>
					))}
				</DialogBody>
			</Dialog>
		</>
	)
}

function ChartMetricsDemo({ values }: { values: KnobValues }) {
	const [metrics, setMetrics] = useState(['tvl', 'fees'])
	const toggleMetric = (option: ChartMetricOption) =>
		setMetrics(metrics.includes(option.key) ? metrics.filter((key) => key !== option.key) : [...metrics, option.key])
	return values.metrics === 'seven' ? (
		<ChartMetricsDialog
			groups={withState(METRIC_GROUPS, metrics)}
			onToggle={toggleMetric}
			clear={{ kind: 'reset', atDefault: metrics.length === 2, onReset: () => setMetrics(['tvl', 'fees']) }}
			onUnlock={() => {}}
		/>
	) : (
		<ChartMetricsDialog
			groups={withState([...METRIC_GROUPS, TOKEN_METRICS], metrics)}
			onToggle={toggleMetric}
			clear={{ kind: 'clear', onClear: () => setMetrics([]) }}
		/>
	)
}

function FilterBuilderDemo() {
	const [appliedFilters, setAppliedFilters] = useState<Array<string>>([])
	return (
		<FilterBuilderDialog appliedCount={appliedFilters.length}>
			<FilterSession applied={appliedFilters} onApply={setAppliedFilters} />
		</FilterBuilderDialog>
	)
}

const TONE_KNOB = { name: 'tone', values: ['destructive', 'primary'] as const, default: 'destructive' }

export const dialogs: Family = {
	id: 'dialogs',
	title: 'Dialogs',
	parts: [
		{
			name: 'Dialog',
			source: 'src/ui/Dialog.tsx',
			knobs: [
				{ name: 'size', values: DIALOG_SIZES },
				{ name: 'layout', values: ['plain', 'fullSheet', 'canvas'], default: 'plain', prop: false },
				{ name: 'state', values: ['rest', 'save failed'], default: 'rest', prop: false }
			],
			note: 'Sizes are 448, 600, 880 and 1280px wide. Below sm every dialog is a bottom sheet, and fullSheet differs from plain only there. A failed save shows its error under the form.',
			render: (values) => <DialogDemo values={values} />,
			states: () => (
				<>
					{/* A workspace is defined only at xl, so it is an example rather than a layout the size knob could break. */}
					<Example
						name="Workspace"
						prop='size="xl" workspace'
						note="A fixed height for panes that change; on a phone, the full sheet."
					>
						<DialogDemo values={{ size: 'xl', layout: 'workspace' }} />
					</Example>
					<DialogPartsDemo />
					<DialogPendingDemo />
				</>
			)
		},
		{
			name: 'SideSheet',
			source: 'src/ui/Dialog.tsx',
			knobs: [
				{ name: 'size', values: ['sm', 'md', 'lg'] },
				{ name: 'canvas', boolean: true }
			],
			note: 'Sizes are 448, 672 and 1152px, pinned to the right edge. Below sm each is the full-height bottom sheet.',
			render: (values) => <SideSheetDemo values={values} />
		},
		{
			name: 'ConfirmDialog',
			source: 'src/ui/ConfirmDialog.tsx',
			knobs: [
				TONE_KNOB,
				{ name: 'outcome', values: ['closes', 'pending', 'error', 'waiting'], default: 'closes', prop: false }
			],
			note: 'Confirm runs the outcome: pending locks the dialog for 2.5 seconds, error locks it for 2 seconds and then fails, waiting shows a check the choice waits on for 2.5 seconds after opening.',
			render: (values) => <ConfirmDemo values={values} />
		},
		{
			name: 'ConfirmActionDialog',
			source: 'src/ui/ConfirmActionDialog.tsx',
			knobs: [TONE_KNOB, { name: 'outcome', values: ['succeeds', 'fails'], default: 'succeeds', prop: false }],
			note: 'The mutation settles after 1.5 seconds: a success closes the dialog, a failure shows the error and keeps it open.',
			render: (values) => <ConfirmActionDemo values={values} />
		},
		{
			name: 'DialogDiscardGuard',
			source: 'src/ui/Dialog.tsx',
			knobs: [{ name: 'when', boolean: true, required: true }],
			note: 'With when on, leave with Escape, the ×, Cancel or Back: each asks first. An outside tap does nothing while the guard is armed.',
			render: (values) => <DiscardGuardDemo values={values} />
		},
		{
			name: 'DialogSearchHeader',
			source: 'src/ui/Dialog.tsx',
			note: "The search field takes the title's place, which stays for screen readers.",
			render: () => <SearchHeaderDemo />
		},
		{
			name: 'DialogCloseButton',
			source: 'src/ui/Dialog.tsx',
			note: 'For a dialog that draws its own header row (the phone navigation menu).',
			render: () => <CloseButtonDemo />
		},
		{
			name: 'ChartMetricsDialog',
			source: 'src/components/ChartMetricsDialog.tsx',
			knobs: [{ name: 'metrics', values: ['seven', 'thirteen'], prop: false }],
			note: 'Seven metrics: a Pro-locked one, a tooltip on TVL and a Reset footer. Thirteen: the search appears, with Clear all.',
			render: (values) => <ChartMetricsDemo values={values} />
		},
		{
			name: 'FilterBuilderDialog',
			source: 'src/components/FilterBuilderDialog.tsx',
			note: 'Add filters from the chips, edit them, Apply: the trigger shows the applied count. Cancel drops the draft.',
			render: () => <FilterBuilderDemo />
		}
	]
}
