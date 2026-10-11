import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { Field } from '~/ui/Field'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import {
	popoverMenuItemStyles,
	popoverMultiSelectCheckStyles,
	popoverRowStyles,
	popoverScrollAreaStyles
} from '~/ui/Popover'
import { PopoverHeader } from '~/ui/PopoverHeader'
import { ComboboxSurface, MenuItem, MenuSeparator, MenuSurface, PopoverSurface } from '~/ui/PopoverSurface'
import { SearchField } from '~/ui/SearchField'
import type { Family, KnobValues } from '../shared'

const CHAINS = ['Ethereum', 'Arbitrum', 'Base', 'Solana']
const PROTOCOLS = ['Aave', 'Lido', 'Uniswap']

// Static options in the markup the app's lists render (an Ariakit option is a div, so each row spans the list).
const CHAIN_ROWS = (
	<div role="listbox" aria-label="Chains" aria-multiselectable className={popoverScrollAreaStyles}>
		{CHAINS.map((chain, index) => {
			const selected = index < 2
			return (
				<div
					key={chain}
					role="option"
					aria-selected={selected}
					className={popoverRowStyles}
					data-active-item={index === 1 ? '' : undefined}
					aria-disabled={index === 3 || undefined}
				>
					<span>{chain}</span>
					<span className={popoverMultiSelectCheckStyles(selected)} aria-hidden>
						{selected ? <Icon name="check" className="size-2.5" /> : null}
					</span>
				</div>
			)
		})}
	</div>
)

function ActionsMenu({ nested }: { nested: boolean }) {
	const [showFees, setShowFees] = useState(true)
	return (
		<Ariakit.MenuProvider>
			<Ariakit.MenuButton render={<Button size="md" />}>
				Actions
				<Ariakit.MenuButtonArrow />
			</Ariakit.MenuButton>
			<MenuSurface variant="actions">
				<MenuItem>Rename</MenuItem>
				<MenuItem>Duplicate</MenuItem>
				<MenuItem disabled>Move to folder</MenuItem>
				<Ariakit.MenuItemCheckbox
					name="fees"
					checked={showFees}
					onChange={(event) => setShowFees(event.currentTarget.checked)}
					hideOnClick={false}
					className={popoverMenuItemStyles}
				>
					<span className="mr-auto">Show fees</span>
					<span className={popoverMultiSelectCheckStyles(showFees)} aria-hidden>
						{showFees ? <Icon name="check" className="size-2.5" /> : null}
					</span>
				</Ariakit.MenuItemCheckbox>
				{nested ? (
					<Ariakit.MenuProvider>
						<MenuItem render={<Ariakit.MenuButton />}>
							<span className="mr-auto">Export</span>
							<Ariakit.MenuButtonArrow />
						</MenuItem>
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

// The protocol switcher: the parent, then a child that is the current page (data-active).
function TreeMenu() {
	return (
		<Ariakit.MenuProvider>
			<Ariakit.MenuButton render={<Button size="md" />}>
				Aave
				<Ariakit.MenuButtonArrow />
			</Ariakit.MenuButton>
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

function PopoverHeaderDemo({ values }: { values: KnobValues }) {
	const [chainQuery, setChainQuery] = useState('')
	const [testnets, setTestnets] = useState(false)
	return (
		<Ariakit.PopoverProvider>
			<Ariakit.PopoverDisclosure render={<Button size="md" />}>
				Chains
				<Ariakit.PopoverDisclosureArrow />
			</Ariakit.PopoverDisclosure>
			<PopoverSurface variant="list" heading="Chains" className="w-64">
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

export const menus: Family = {
	id: 'menus',
	title: 'Menus and popovers',
	parts: [
		{
			name: 'MenuSurface',
			source: 'src/ui/PopoverSurface.tsx',
			// A nested surface is a flyout inside an actions menu, never a menu of its own, so the knob picks the menu.
			knobs: [{ name: 'menu', values: ['actions', 'with flyout', 'tree'], prop: false }],
			note: 'Open it. With flyout, Export opens the nested surface. On a phone the actions surface is a bottom drawer.',
			render: (values) =>
				values.menu === 'tree' ? <TreeMenu /> : <ActionsMenu nested={values.menu === 'with flyout'} />
		},
		{
			name: 'PopoverSurface',
			source: 'src/ui/PopoverSurface.tsx',
			knobs: [{ name: 'variant', values: ['panel', 'list'] }],
			note: 'Open it. List rows are static: Ethereum and Arbitrum are picked, Arbitrum shows the keyboard highlight, Solana is disabled. On a phone it is a drawer with its heading and a close button.',
			render: (values) =>
				values.variant === 'panel' ? (
					<Ariakit.PopoverProvider>
						<Ariakit.PopoverDisclosure render={<Button size="md" />}>
							Save view
							<Ariakit.PopoverDisclosureArrow />
						</Ariakit.PopoverDisclosure>
						<PopoverSurface variant="panel" heading="Save view" className="w-72">
							<div className="flex flex-col gap-3 p-3">
								<Field label="Name">{(control) => <Input {...control} defaultValue="My view" />}</Field>
								<Button size="md" variant="primary">
									Save
								</Button>
							</div>
						</PopoverSurface>
					</Ariakit.PopoverProvider>
				) : (
					<Ariakit.PopoverProvider>
						<Ariakit.PopoverDisclosure render={<Button size="md" />}>
							Chains
							<Ariakit.PopoverDisclosureArrow />
						</Ariakit.PopoverDisclosure>
						<PopoverSurface variant="list" heading="Chains" className="w-64">
							{CHAIN_ROWS}
						</PopoverSurface>
					</Ariakit.PopoverProvider>
				)
		},
		{
			name: 'ComboboxSurface',
			source: 'src/ui/PopoverSurface.tsx',
			note: 'Focus the field: the results match its width, with no drawer or second search input, at every width.',
			render: () => (
				<Ariakit.ComboboxProvider>
					<Ariakit.Combobox
						render={<Input aria-label="Search protocols" placeholder="Search protocols" className="w-72" />}
					/>
					<ComboboxSurface variant="search-results" sameWidth>
						{PROTOCOLS.map((name) => (
							<Ariakit.ComboboxItem key={name} value={name} className={popoverRowStyles} />
						))}
					</ComboboxSurface>
				</Ariakit.ComboboxProvider>
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
		}
	]
}
