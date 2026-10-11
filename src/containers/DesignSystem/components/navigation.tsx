import { useState } from 'react'
import { LinksWithDropdown } from '~/components/RowLinksWithDropdown/LinksWithDropdown'
import { CountBadge } from '~/ui/CountBadge'
import { Icon } from '~/ui/Icon'
import { ListRow } from '~/ui/ListRow'
import { RailItem } from '~/ui/RailItem'
import { BusyGlyph } from '~/ui/Status'
import { Tab, TabLink, TabNav, TabPanel, Tabs, UnderlineTabList } from '~/ui/Tabs'
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

function UnderlineTabListDemo() {
	const [tab, setTab] = useState<(typeof VIEWS)[number]>('overview')
	return (
		<div className="w-80">
			<Tabs<(typeof VIEWS)[number]> value={tab} onValueChange={setTab} values={VIEWS}>
				<UnderlineTabList
					label="Sections"
					tabs={[
						{ id: 'overview', label: 'Overview' },
						{ id: 'yields', label: 'Yields' },
						{ id: 'risk', label: 'Risk' }
					]}
				/>
				{PANELS}
			</Tabs>
		</div>
	)
}

function TabDemo() {
	const [tab, setTab] = useState<(typeof VIEWS)[number]>('overview')
	return (
		<div className="w-80">
			<Tabs<(typeof VIEWS)[number]> value={tab} onValueChange={setTab} values={VIEWS}>
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
				{PANELS}
			</Tabs>
		</div>
	)
}

function ListRowDemo({ values }: { values: KnobValues }) {
	const busy = values.state === 'busy'
	const selected = values.selected === true
	return (
		<div className="w-64">
			<ListRow
				nested={values.nested === true}
				selected={selected}
				aria-pressed={selected}
				aria-busy={busy || undefined}
				aria-disabled={busy || values.state === 'disabled' || undefined}
			>
				<span className="flex-1 truncate">Ethereum fees</span>
				{busy ? <BusyGlyph decorative size={14} /> : null}
			</ListRow>
		</div>
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

export const navigation: Family = {
	id: 'navigation',
	title: 'Navigation',
	parts: [
		{
			name: 'UnderlineTabList',
			source: 'src/ui/Tabs.tsx',
			note: 'Arrow keys move focus; Enter or Space selects.',
			render: () => <UnderlineTabListDemo />
		},
		{
			name: 'Tab',
			source: 'src/ui/Tabs.tsx',
			note: 'An icon or a count badge sits inside the tab.',
			render: () => <TabDemo />
		},
		{
			name: 'TabLink',
			source: 'src/ui/Tabs.tsx',
			render: () => (
				<TabNav label="Protocol pages">
					<TabLink href="/yields" aria-current="page">
						Overview
					</TabLink>
					<TabLink href="/yields">Fees</TabLink>
					<TabLink href="/yields">Governance</TabLink>
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
				{ name: 'selected', boolean: true },
				{ name: 'nested', boolean: true },
				{ name: 'state', values: ['rest', 'busy', 'disabled'], default: 'rest', prop: false }
			],
			note: 'Busy and disabled are aria-busy and aria-disabled.',
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
					<Example name="Picker" prop="selected" note="The check slot keeps labels in place. The second row is picked.">
						<div className="flex w-64 flex-col gap-0.5">
							{['Stablecoins overview', 'Ethereum fees', 'Yields watchlist'].map((label, i) => (
								<ListRow key={label} selected={i === 1} aria-pressed={i === 1}>
									<span className="flex-1 truncate">{label}</span>
									<Icon name="check" className={`size-4 text-link ${i === 1 ? '' : 'invisible'}`} aria-hidden />
								</ListRow>
							))}
						</div>
					</Example>
				</>
			)
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
