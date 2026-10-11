import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { Field } from '~/ui/Field'
import { Input } from '~/ui/Input'
import { NoResults } from '~/ui/NoResults'
import { PopoverHeader } from '~/ui/PopoverHeader'
import {
	ComboboxSurface,
	MenuItem,
	MenuSeparator,
	MenuSurface,
	PopoverFooterAction,
	PopoverList,
	PopoverRow,
	PopoverSurface,
	type SurfaceWidth
} from '~/ui/PopoverSurface'
import { SearchField } from '~/ui/SearchField'
import { Example, type Family, type KnobValues } from '../shared'

const CHAINS = ['Ethereum', 'Arbitrum', 'Base', 'Solana']
const PROTOCOLS = [
	'Aave',
	'Lido',
	'Uniswap',
	'Maker',
	'Curve',
	'Pendle',
	'Morpho',
	'Ethena',
	'Compound',
	'Balancer',
	'Convex',
	'Rocket Pool'
]

// Static options in the markup the app's lists render (an Ariakit option is a div, so each row spans the list).
const CHAIN_ROWS = (
	<PopoverList render={<div role="listbox" aria-label="Chains" aria-multiselectable />}>
		{CHAINS.map((chain, index) => {
			const selected = index < 2
			return (
				<PopoverRow
					key={chain}
					render={<div role="option" aria-selected={selected} />}
					check="box"
					checked={selected}
					data-active-item={index === 1 ? '' : undefined}
					aria-disabled={index === 3 || undefined}
				>
					{chain}
				</PopoverRow>
			)
		})}
	</PopoverList>
)

function MenuTrigger({ label }: { label: string }) {
	return (
		<Ariakit.MenuButton render={<Button size="md" />}>
			{label}
			<Ariakit.MenuButtonArrow />
		</Ariakit.MenuButton>
	)
}

function ActionsMenu({ width, flyout }: { width: SurfaceWidth; flyout: boolean }) {
	return (
		<Ariakit.MenuProvider>
			<MenuTrigger label="Actions" />
			<MenuSurface variant="actions" width={width}>
				<MenuItem>Rename</MenuItem>
				<MenuItem>Duplicate</MenuItem>
				<MenuItem disabled>Move to folder</MenuItem>
				{flyout ? (
					<Ariakit.MenuProvider>
						<MenuItem kind="submenu">Export</MenuItem>
						<MenuSurface variant="nested" gutter={4}>
							<MenuItem>.csv</MenuItem>
							<MenuItem>.png</MenuItem>
						</MenuSurface>
					</Ariakit.MenuProvider>
				) : null}
				<MenuSeparator />
				<MenuItem destructive>Delete</MenuItem>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}

// The menu store holds the radio and checkbox values, so each mark follows the store as a click changes it.
function KindsMenu() {
	return (
		<Ariakit.MenuProvider defaultValues={{ sort: 'tvl', fees: true }}>
			<MenuTrigger label="View" />
			<MenuSurface variant="actions">
				<MenuItem>Refresh</MenuItem>
				<MenuItem>Copy link</MenuItem>
				<MenuSeparator />
				<Ariakit.MenuGroup aria-label="Sort by">
					<MenuItem kind="radio" name="sort" value="tvl">
						Sort by TVL
					</MenuItem>
					<MenuItem kind="radio" name="sort" value="fees">
						Sort by fees
					</MenuItem>
				</Ariakit.MenuGroup>
				<MenuItem kind="checkbox" name="fees">
					Show fees
				</MenuItem>
				<MenuSeparator />
				<Ariakit.MenuProvider>
					<MenuItem kind="submenu">Export</MenuItem>
					<MenuSurface variant="nested" gutter={4}>
						<MenuItem>.csv</MenuItem>
						<MenuItem>.png</MenuItem>
					</MenuSurface>
				</Ariakit.MenuProvider>
				<MenuSeparator />
				<MenuItem destructive>Delete view</MenuItem>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}

// The protocol switcher: the parent, then a child that is the current page (data-active).
function TreeMenu() {
	return (
		<Ariakit.MenuProvider>
			<MenuTrigger label="Aave" />
			<MenuSurface variant="actions">
				<MenuItem row="tree">Aave (Combined)</MenuItem>
				<MenuItem row="tree-child" data-active>
					Aave V3
				</MenuItem>
				<MenuItem row="tree-child">Aave V2</MenuItem>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}

function SurfaceDemo({ values }: { values: KnobValues }) {
	const width = values.width as SurfaceWidth
	if (values.variant === 'panel')
		return (
			<Ariakit.PopoverProvider>
				<Ariakit.PopoverDisclosure render={<Button size="md" />}>
					Save view
					<Ariakit.PopoverDisclosureArrow />
				</Ariakit.PopoverDisclosure>
				<PopoverSurface variant="panel" heading="Save view" width={width}>
					<div className="flex flex-col gap-3 p-3">
						<Field label="Name">{(control) => <Input {...control} defaultValue="My view" />}</Field>
						<Button size="md" variant="primary">
							Save
						</Button>
					</div>
				</PopoverSurface>
			</Ariakit.PopoverProvider>
		)
	return (
		<Ariakit.PopoverProvider>
			<Ariakit.PopoverDisclosure render={<Button size="md" />}>
				Chains
				<Ariakit.PopoverDisclosureArrow />
			</Ariakit.PopoverDisclosure>
			<PopoverSurface variant="list" heading="Chains" width={width}>
				{CHAIN_ROWS}
				<PopoverFooterAction inset="popover">Add chain</PopoverFooterAction>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}

/** Also the combobox example of SearchField (./fields.tsx). */
export function ProtocolResults({ maxHeight }: { maxHeight: 'sm' | 'md' | 'lg' | 'screen' | undefined }) {
	const [query, setQuery] = useState('')
	const matches = PROTOCOLS.filter((name) => name.toLowerCase().includes(query.trim().toLowerCase()))
	return (
		<Ariakit.ComboboxProvider value={query} setValue={setQuery}>
			<SearchField combobox label="Search protocols" placeholder="Search protocols" className="w-72" />
			<ComboboxSurface variant="search-results" sameWidth maxHeight={maxHeight}>
				{matches.length > 0 ? (
					matches.map((name) => (
						<PopoverRow key={name} render={<Ariakit.ComboboxItem value={name} />}>
							{name}
						</PopoverRow>
					))
				) : (
					<NoResults />
				)}
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}

function PopoverHeaderDemo({ values }: { values: KnobValues }) {
	const [chainQuery, setChainQuery] = useState('')
	const [testnets, setTestnets] = useState(false)
	return (
		<Ariakit.PopoverProvider>
			<Ariakit.PopoverDisclosure render={<Button size="md" />}>
				Chains
				<Ariakit.PopoverDisclosureArrow />
			</Ariakit.PopoverDisclosure>
			<PopoverSurface variant="list" heading="Chains" width="md">
				<PopoverHeader
					inset={values.inset as 'popover' | 'nested'}
					search={
						values.search === 'field' ? (
							<SearchField
								label="Search chains"
								placeholder="Search chains"
								value={chainQuery}
								onChange={setChainQuery}
							/>
						) : null
					}
				>
					<Checkbox variant="default" checked={testnets} onChange={(event) => setTestnets(event.currentTarget.checked)}>
						Include testnets
					</Checkbox>
				</PopoverHeader>
				{CHAIN_ROWS}
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}

/* A list of button rows in a popover, picked with a click or Enter: Tab moves between them, as in any list that is not
   a menu or a combobox. The action row and the footer act on the list. Clear all stays focusable while disabled
   (accessibleWhenDisabled), so pressing it never drops focus. */
function ChainRowsPopover({
	check,
	divided = false,
	inset = 'popover'
}: {
	check: 'box' | 'tick' | undefined
	divided?: boolean
	inset?: 'popover' | 'nested'
}) {
	const [picked, setPicked] = useState<ReadonlyArray<string>>(['Ethereum'])
	const toggle = (chain: string) => {
		if (check === 'tick') setPicked([chain])
		else setPicked(picked.includes(chain) ? picked.filter((item) => item !== chain) : [...picked, chain])
	}
	return (
		<Ariakit.PopoverProvider>
			<Ariakit.PopoverDisclosure render={<Button size="md" />}>
				Chains
				<Ariakit.PopoverDisclosureArrow />
			</Ariakit.PopoverDisclosure>
			<PopoverSurface variant="list" heading="Chains" width="sm">
				<PopoverList divided={divided}>
					{CHAINS.map((chain) => (
						<PopoverRow
							key={chain}
							check={check}
							checked={picked.includes(chain)}
							aria-pressed={check ? picked.includes(chain) : undefined}
							onClick={() => toggle(chain)}
						>
							{chain}
						</PopoverRow>
					))}
					<PopoverRow variant="action" onClick={() => setPicked(['Ethereum'])}>
						Reset to Ethereum
					</PopoverRow>
				</PopoverList>
				<PopoverFooterAction
					inset={inset}
					disabled={picked.length === 0}
					accessibleWhenDisabled
					onClick={() => setPicked([])}
				>
					Clear all
				</PopoverFooterAction>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}

const SURFACE_WIDTHS: ReadonlyArray<SurfaceWidth> = ['fit', 'sm', 'md', 'lg', 'xl', 'trigger']

export const menus: Family = {
	id: 'menus',
	title: 'Menus and popovers',
	parts: [
		{
			name: 'MenuSurface',
			source: 'src/ui/PopoverSurface.tsx',
			knobs: [
				{ name: 'width', values: ['fit', 'sm', 'md', 'lg', 'xl'], default: 'fit' },
				{ name: 'flyout', boolean: true, prop: false }
			],
			note: 'Open it with a click, or Tab to it and press Enter or ArrowDown: focus lands on the first row and the arrows move. With flyout, ArrowRight on Export opens the nested surface and Escape closes it alone. An actions menu caps at 448px, so xl reads as that cap. On a phone it is a bottom drawer.',
			render: (values) => <ActionsMenu width={values.width as SurfaceWidth} flyout={values.flyout === true} />
		},
		{
			name: 'MenuItem',
			source: 'src/ui/PopoverSurface.tsx',
			note: 'Every kind in one menu. Open it and move with the arrows: Enter runs an action, the radio rows pick a sort (the tick follows), Show fees toggles its box, ArrowRight opens Export, and Delete view is the destructive row.',
			render: () => <KindsMenu />,
			states: () => (
				<Example
					name="Tree rows"
					prop='row="tree", row="tree-child"'
					note="The protocol switcher: the parent row, then its children on the connector line. Aave V3 is the current page (data-active)."
				>
					<TreeMenu />
				</Example>
			)
		},
		{
			name: 'MenuSeparator',
			source: 'src/ui/PopoverSurface.tsx',
			note: 'Open it: the rule splits the destructive row from the rest. The arrows step over it.',
			render: () => <ActionsMenu width="fit" flyout={false} />
		},
		{
			name: 'PopoverSurface',
			source: 'src/ui/PopoverSurface.tsx',
			knobs: [
				{ name: 'variant', values: ['panel', 'list'] },
				{ name: 'width', values: SURFACE_WIDTHS, default: 'fit' }
			],
			note: 'Open it: focus moves to its first control, and Escape closes it and returns focus to the button. List rows are static: Ethereum and Arbitrum are picked, Arbitrum shows the keyboard highlight, Solana is disabled. xl takes effect on a list only; trigger matches the button with a 256px floor. On a phone it is a drawer with its heading and a close button.',
			render: (values) => <SurfaceDemo values={values} />
		},
		{
			name: 'ComboboxSurface',
			source: 'src/ui/PopoverSurface.tsx',
			knobs: [{ name: 'maxHeight', values: ['none', 'sm', 'md', 'lg', 'screen'], default: 'none' }],
			note: 'Focus the field and type: the results match its width, with no drawer or second search input, at every width. maxHeight caps the twelve results, which then scroll.',
			render: (values) => (
				<ProtocolResults
					maxHeight={values.maxHeight === 'none' ? undefined : (values.maxHeight as 'sm' | 'md' | 'lg' | 'screen')}
				/>
			)
		},
		{
			name: 'PopoverHeader',
			source: 'src/ui/PopoverHeader.tsx',
			knobs: [
				{ name: 'search', values: ['field', 'null'], default: 'field', prop: false },
				{ name: 'inset', values: ['popover', 'nested'], default: 'popover' }
			],
			note: 'Open it: a search field, then a full-bleed toggle row, one divider under both.',
			render: (values) => <PopoverHeaderDemo values={values} />
		},
		{
			name: 'PopoverRow',
			source: 'src/ui/PopoverSurface.tsx',
			knobs: [{ name: 'check', values: ['none', 'box', 'tick'], default: 'none' }],
			note: 'Open it, Tab to a row and press Enter, or click it: box picks several, tick picks one, and the mark follows the pick. Reset to Ethereum is variant="action", link-colored because it acts on the list. A combobox option renders the row through Ariakit.ComboboxItem (ComboboxSurface above).',
			render: (values) => (
				<ChainRowsPopover check={values.check === 'none' ? undefined : (values.check as 'box' | 'tick')} />
			)
		},
		{
			name: 'PopoverList',
			source: 'src/ui/PopoverSurface.tsx',
			knobs: [{ name: 'divided', boolean: true }],
			note: 'The scrolling slot under the title row: divided rules a hairline between the rows.',
			render: (values) => <ChainRowsPopover check="box" divided={values.divided === true} />
		},
		{
			name: 'PopoverFooterAction',
			source: 'src/ui/PopoverSurface.tsx',
			knobs: [{ name: 'inset', values: ['popover', 'nested'] }],
			note: 'Open it and press Clear all: the picks clear and the action turns disabled but keeps focus (accessibleWhenDisabled). nested matches nested-menu rows, which render only in phone sheets; it is drawn here in a desktop popover.',
			render: (values) => <ChainRowsPopover check="box" inset={values.inset as 'popover' | 'nested'} />
		}
	]
}
