import * as Ariakit from '@ariakit/react'
import { useRef, useState } from 'react'
import { LinksWithDropdown } from '~/components/RowLinksWithDropdown/LinksWithDropdown'
import { Button } from '~/ui/Button'
import { CountBadge } from '~/ui/CountBadge'
import { DisclosureChevron, RowExpandButton } from '~/ui/DisclosureChevron'
import { Icon } from '~/ui/Icon'
import { ListRow } from '~/ui/ListRow'
import { RailItem } from '~/ui/RailItem'
import { BusyGlyph } from '~/ui/Status'
import { Tab, TabLink, TabNav, TabPanel, Tabs, UnderlineTabList } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
import { Cell, Example, type Family, type KnobValues, StateGrid } from '../shared'

const VIEWS = ['overview', 'yields', 'risk'] as const
const CHAIN_LINKS = [
	{ label: 'Ethereum', to: '/yields' },
	{ label: 'Arbitrum', to: '/yields' },
	{ label: 'Base', to: '/yields' },
	{ label: 'Solana', to: '/yields' },
	{ label: 'Optimism', to: '/yields' },
	{ label: 'Polygon', to: '/yields' },
	{ label: 'Avalanche', to: '/yields' },
	{ label: 'BNB Chain', to: '/yields' }
]
const LIST_STATES = ['Rest', 'Hover', 'Focus', 'Pressed', 'Keyboard', 'Selected', 'Busy', 'Disabled'] as const

function listRowCells(nested: boolean) {
	const label = <span className="flex-1 truncate">Ethereum fees</span>
	return (
		<>
			<ListRow nested={nested} className="w-44">
				{label}
			</ListRow>
			<Cell force="hover">
				<ListRow nested={nested} className="w-44">
					{label}
				</ListRow>
			</Cell>
			<Cell force="focus-visible">
				<ListRow nested={nested} className="w-44">
					{label}
				</ListRow>
			</Cell>
			<Cell force="active">
				<ListRow nested={nested} className="w-44">
					{label}
				</ListRow>
			</Cell>
			<ListRow nested={nested} data-active-item="" className="w-44">
				{label}
			</ListRow>
			<ListRow nested={nested} selected aria-pressed className="w-44">
				{label}
			</ListRow>
			<ListRow nested={nested} aria-busy aria-disabled className="w-44">
				{label}
				<BusyGlyph decorative size={14} />
			</ListRow>
			<ListRow nested={nested} aria-disabled className="w-44">
				{label}
			</ListRow>
		</>
	)
}

const PANELS = (
	<>
		<TabPanel value="overview" className="pt-3 body-sm text-secondary">
			Overview panel
		</TabPanel>
		<TabPanel value="yields" className="pt-3 body-sm text-secondary">
			Yields panel
		</TabPanel>
		<TabPanel value="risk" className="pt-3 body-sm text-secondary">
			Risk panel
		</TabPanel>
	</>
)

const SECTION_TABS = [
	{ id: 'overview', label: 'Overview' },
	{ id: 'yields', label: 'Yields' },
	{ id: 'risk', label: 'Risk' }
] as const

function UnderlineTabListDemo({ values }: { values: KnobValues }) {
	const [tab, setTab] = useState<(typeof VIEWS)[number]>('overview')
	return (
		<div className="w-80">
			<Tabs<(typeof VIEWS)[number]> value={tab} onValueChange={setTab} values={VIEWS}>
				{values.items === 'Tab children' ? (
					<UnderlineTabList label="Protocol views">
						<Tab value="overview" render={<TabLink as="button" type="button" />}>
							<span className="inline-flex items-center gap-1.5">
								<Icon name="layout-grid" className="size-3.5" aria-hidden />
								Overview
							</span>
						</Tab>
						<Tab value="yields" render={<TabLink as="button" type="button" />}>
							<span className="inline-flex items-center gap-1.5">
								Yields
								<CountBadge count={12} />
							</span>
						</Tab>
						<Tab value="risk" render={<TabLink as="button" type="button" />}>
							<span className="inline-flex items-center gap-1.5">
								<Icon name="shield-check" className="size-3.5" aria-hidden />
								Risk
							</span>
						</Tab>
					</UnderlineTabList>
				) : (
					<UnderlineTabList label="Sections" tabs={SECTION_TABS} />
				)}
				{PANELS}
			</Tabs>
		</div>
	)
}

const MANY_SECTIONS = ['overview', 'fees', 'revenue', 'holders', 'treasury', 'governance', 'unlocks', 'raises'] as const

// The ref reaches the track, so the caller scrolls it from its own buttons, as a Pro dashboard's section arrows do.
function OverflowTabsDemo() {
	const [tab, setTab] = useState<(typeof MANY_SECTIONS)[number]>('overview')
	const track = useRef<HTMLDivElement>(null)
	const scroll = (by: number) => track.current.scrollBy({ left: by, behavior: 'smooth' })
	return (
		<div className="flex w-80 items-center gap-1">
			<Tooltip
				content="Scroll left"
				render={<Button variant="ghost" size="sm" square aria-label="Scroll left" onClick={() => scroll(-160)} />}
			>
				<Icon name="chevron-left" className="size-4" aria-hidden />
			</Tooltip>
			<div className="min-w-0 flex-1">
				<Tabs<(typeof MANY_SECTIONS)[number]> value={tab} onValueChange={setTab} values={MANY_SECTIONS}>
					<UnderlineTabList
						ref={track}
						label="Dashboard sections"
						tabs={MANY_SECTIONS.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) }))}
					/>
				</Tabs>
			</div>
			<Tooltip
				content="Scroll right"
				render={<Button variant="ghost" size="sm" square aria-label="Scroll right" onClick={() => scroll(160)} />}
			>
				<Icon name="chevron-right" className="size-4" aria-hidden />
			</Tooltip>
		</div>
	)
}

const PAGE_TABS = ['Overview', 'Fees', 'Governance'] as const
const MORE_PAGE_TABS = ['Overview', 'Fees', 'Revenue', 'Holders', 'Treasury', 'Governance', 'Unlocks'] as const

// The current page is the demo's own state: a click moves aria-current, as following the link would.
function TabNavDemo({ values }: { values: KnobValues }) {
	const [current, setCurrent] = useState('Overview')
	const overflow = values.overflow === true
	return (
		<div className={overflow ? 'w-72' : 'w-96'}>
			<TabNav label="Protocol pages">
				{(overflow ? MORE_PAGE_TABS : PAGE_TABS).map((page) => (
					<TabLink
						key={page}
						href="/yields"
						aria-current={page === current ? 'page' : undefined}
						onClick={() => setCurrent(page)}
					>
						{page}
					</TabLink>
				))}
			</TabNav>
		</div>
	)
}

function ListRowDemo({ values }: { values: KnobValues }) {
	const [selected, setSelected] = useState(false)
	const busy = values.state === 'busy'
	return (
		<div className="w-64">
			<ListRow
				nested={values.nested === true}
				check={values.check === 'none' ? undefined : (values.check as 'box' | 'tick')}
				selected={selected}
				aria-pressed={selected}
				aria-busy={busy || undefined}
				aria-disabled={busy || values.state === 'disabled' || undefined}
				onClick={() => setSelected(!selected)}
			>
				<span className="flex-1 truncate">Ethereum fees</span>
				{busy ? <BusyGlyph decorative size={14} /> : null}
			</ListRow>
		</div>
	)
}

const PICKER_ROWS = ['Stablecoins overview', 'Ethereum fees', 'Yields watchlist'] as const

function SinglePickRows() {
	const [picked, setPicked] = useState<string>('Ethereum fees')
	return (
		<div className="flex w-64 flex-col gap-0.5">
			{PICKER_ROWS.map((label) => (
				<ListRow
					key={label}
					check="tick"
					selected={label === picked}
					aria-pressed={label === picked}
					onClick={() => setPicked(label)}
				>
					<span className="flex-1 truncate">{label}</span>
				</ListRow>
			))}
		</div>
	)
}

/** `fill` off passes `checked`: the box follows the pick and the row takes no fill. */
function MultiPickRows({ fill }: { fill: boolean }) {
	const [picked, setPicked] = useState<ReadonlyArray<string>>(['Ethereum fees'])
	return (
		<div className="flex w-64 flex-col gap-0.5">
			{PICKER_ROWS.map((label) => {
				const on = picked.includes(label)
				return (
					<ListRow
						key={label}
						check="box"
						selected={fill && on}
						checked={on}
						aria-pressed={on}
						onClick={() => setPicked(on ? picked.filter((item) => item !== label) : [...picked, label])}
					>
						<span className="flex-1 truncate">{label}</span>
					</ListRow>
				)
			})}
		</div>
	)
}

const RAIL_SECTIONS = ['general', 'memory', 'billing'] as const

function RailTabsDemo() {
	const [section, setSection] = useState<(typeof RAIL_SECTIONS)[number]>('general')
	return (
		<Tabs<(typeof RAIL_SECTIONS)[number]>
			value={section}
			onValueChange={setSection}
			values={RAIL_SECTIONS}
			orientation="vertical"
		>
			<div className="flex w-96 gap-4">
				<Ariakit.TabList aria-label="Settings sections" className="flex w-40 shrink-0 flex-col gap-0.5">
					<Tab value="general" render={<RailItem as="button" type="button" />}>
						<Icon name="settings" className="size-3.5 shrink-0" aria-hidden />
						General
					</Tab>
					<Tab value="memory" render={<RailItem as="button" type="button" />}>
						<Icon name="layers" className="size-3.5 shrink-0" aria-hidden />
						Memory
					</Tab>
					<Tab value="billing" render={<RailItem as="button" type="button" />}>
						<Icon name="file-text" className="size-3.5 shrink-0" aria-hidden />
						Billing
					</Tab>
				</Ariakit.TabList>
				{RAIL_SECTIONS.map((value) => (
					<TabPanel key={value} value={value} className="body-sm text-secondary">
						{value[0].toUpperCase() + value.slice(1)} settings
					</TabPanel>
				))}
			</div>
		</Tabs>
	)
}

function LinksWithDropdownDemo({ values }: { values: KnobValues }) {
	const narrow = values.width === 'narrow'
	return (
		<div className={`flex w-full items-center ${narrow ? 'max-w-sm' : 'max-w-3xl'}`}>
			<LinksWithDropdown
				links={CHAIN_LINKS}
				heading="Chains"
				name={narrow ? 'narrow' : 'wide'}
				activeLink={narrow ? 'BNB Chain' : 'Ethereum'}
			/>
		</div>
	)
}

/** A <details> section that turns its chevron on its own, and a button that passes `open`, both of the knob's kind. */
function DisclosureChevronDemo({ values }: { values: KnobValues }) {
	const kind = values.kind as 'section' | 'tree'
	const size = values.size as 'sm' | 'md'
	const [open, setOpen] = useState(false)
	return (
		<div className="flex flex-col gap-3">
			<details className="w-72">
				<summary className="flex cursor-pointer items-center gap-2 label-md text-primary">
					{kind === 'tree' ? <DisclosureChevron kind={kind} size={size} /> : null}
					Fees by chain
					{kind === 'section' ? <DisclosureChevron kind={kind} size={size} className="ml-auto" /> : null}
				</summary>
				<p className="pt-2 body-sm text-secondary">Ethereum, Arbitrum and Base.</p>
			</details>
			<Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)} className="w-fit">
				{open ? 'Show less' : 'Show more'}
				<DisclosureChevron kind={kind} size={size} open={open} />
			</Button>
		</div>
	)
}

function RowExpandButtonDemo() {
	const [expanded, setExpanded] = useState(false)
	return (
		<div className="flex items-center gap-2 label-md text-primary">
			<RowExpandButton
				expanded={expanded}
				onClick={() => setExpanded(!expanded)}
				label={expanded ? 'Hide child protocols' : 'View child protocols'}
			/>
			Aave
		</div>
	)
}

export const navigation: Family = {
	id: 'navigation',
	title: 'Navigation',
	parts: [
		{
			name: 'UnderlineTabList',
			source: 'src/ui/Tabs.tsx',
			knobs: [{ name: 'items', values: ['tabs', 'Tab children'], default: 'tabs', prop: false }],
			note: 'Tab into the list: arrow keys move focus between tabs, Enter or Space selects one. Tab children carry an icon or a count.',
			render: (values) => <UnderlineTabListDemo values={values} />,
			states: () => (
				<Example
					name="Overflow and ref"
					prop="ref"
					note="Eight tabs in a narrow track: it scrolls sideways with no scrollbar, and focus moving to a tab scrolls it into view. The ref reaches the track, so the arrows beside it scroll it."
				>
					<OverflowTabsDemo />
				</Example>
			)
		},
		{
			name: 'Tab',
			source: 'src/ui/Tabs.tsx',
			note: 'A section tab drawn as a RailItem, in a vertical list: Tab into it, ArrowUp and ArrowDown move, Enter or Space selects. The underline look with Tab children is UnderlineTabList above.',
			render: () => <RailTabsDemo />
		},
		{
			name: 'TabNav',
			source: 'src/ui/Tabs.tsx',
			knobs: [{ name: 'overflow', boolean: true, prop: false }],
			note: 'Route tabs are links, so Tab moves through them one by one. Click one: it takes aria-current="page", which draws it current. With overflow the track scrolls sideways.',
			render: (values) => <TabNavDemo values={values} />
		},
		{
			name: 'TabLink',
			source: 'src/ui/Tabs.tsx',
			note: 'One item of TabNav, or of UnderlineTabList when a Tab renders it as a button.',
			render: () => (
				<TabNav label="Protocol pages">
					<TabLink href="/yields" aria-current="page">
						Overview
					</TabLink>
					<TabLink href="/yields">Fees</TabLink>
				</TabNav>
			),
			states: () => (
				<Example name="Interaction">
					<StateGrid
						columns={['Rest', 'Hover', 'Focus', 'Current']}
						rows={[
							[
								'item',
								<>
									<TabLink href="/yields">Overview</TabLink>
									<Cell force="hover">
										<TabLink href="/yields">Overview</TabLink>
									</Cell>
									<Cell force="focus-visible">
										<TabLink href="/yields">Overview</TabLink>
									</Cell>
									<TabLink href="/yields" aria-current="page">
										Overview
									</TabLink>
								</>
							]
						]}
					/>
				</Example>
			)
		},
		{
			name: 'RailItem',
			source: 'src/ui/RailItem.tsx',
			knobs: [{ name: 'active', boolean: true }],
			render: (values) => (
				<div className="w-48">
					<RailItem
						as="button"
						type="button"
						active={values.active === true}
						aria-current={values.active ? 'location' : undefined}
					>
						Revenue
					</RailItem>
				</div>
			),
			states: () => (
				<Example wide name="Interaction">
					<StateGrid
						columns={['Rest', 'Hover', 'Focus', 'Pressed', 'Selected']}
						rows={[
							[
								'item',
								<>
									<div className="w-48">
										<RailItem as="button" type="button">
											Token unlocks
										</RailItem>
									</div>
									<div className="w-48">
										<Cell force="hover">
											<RailItem as="button" type="button">
												Token unlocks
											</RailItem>
										</Cell>
									</div>
									<div className="w-48">
										<Cell force="focus-visible">
											<RailItem as="button" type="button">
												Token unlocks
											</RailItem>
										</Cell>
									</div>
									<div className="w-48">
										<Cell force="active">
											<RailItem as="button" type="button">
												Token unlocks
											</RailItem>
										</Cell>
									</div>
									<div className="w-48">
										<RailItem as="button" type="button" active aria-current="location">
											Token unlocks
										</RailItem>
									</div>
								</>
							]
						]}
					/>
				</Example>
			)
		},
		{
			name: 'ListRow',
			source: 'src/ui/ListRow.tsx',
			knobs: [
				{ name: 'check', values: ['none', 'box', 'tick'], default: 'none' },
				{ name: 'nested', boolean: true },
				{ name: 'state', values: ['rest', 'busy', 'disabled'], default: 'rest', prop: false }
			],
			note: 'Click the row or press Enter on it to pick it: selected is the demo’s own state, and a check mark follows it. Busy and disabled are aria-busy and aria-disabled.',
			render: (values) => <ListRowDemo values={values} />,
			states: () => (
				<>
					<Example wide name="Row and nested × state" note="Keyboard is Ariakit's data-active-item highlight.">
						<StateGrid
							columns={LIST_STATES}
							rows={[
								['row', listRowCells(false)],
								['nested', listRowCells(true)]
							]}
						/>
					</Example>
					<Example
						name="Single pick"
						prop='check="tick"'
						note="Click a row: the tick and the fill move to it. The tick slot stays in place when empty, so labels never shift."
					>
						<SinglePickRows />
					</Example>
					<Example name="Multi pick" prop='check="box"' note="Click rows to pick several; the box leads each row.">
						<MultiPickRows fill />
					</Example>
					<Example
						name="Mark without the fill"
						prop="checked"
						note="For a list whose keyboard highlight would look like the fill: the box follows checked and the row stays unfilled."
					>
						<MultiPickRows fill={false} />
					</Example>
				</>
			)
		},
		{
			name: 'DisclosureChevron',
			source: 'src/ui/DisclosureChevron.tsx',
			knobs: [
				{ name: 'kind', values: ['section', 'tree'] },
				{ name: 'size', values: ['sm', 'md'] }
			],
			note: 'Open the section or press the button: section points down and turns up, tree points right and turns down. Inside a summary it follows its details; on a button it follows open.',
			render: (values) => <DisclosureChevronDemo values={values} />
		},
		{
			name: 'RowExpandButton',
			source: 'src/ui/DisclosureChevron.tsx',
			note: 'Press it: the tree chevron turns down, aria-expanded flips, and its screen-reader name follows the label the caller passes.',
			render: () => <RowExpandButtonDemo />
		},
		{
			name: 'LinksWithDropdown',
			source: 'src/components/RowLinksWithDropdown/LinksWithDropdown.tsx',
			knobs: [{ name: 'width', values: ['wide', 'narrow'], prop: false }],
			note: 'In the narrow row the rest move into Others and the active link (BNB Chain) takes the trigger. At 640px or less it is the Others menu alone (phone only).',
			render: (values) => <LinksWithDropdownDemo values={values} />
		}
	]
}
