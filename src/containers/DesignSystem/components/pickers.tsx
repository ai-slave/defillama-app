import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { PopoverSelectTrigger } from '~/ui/ComboboxSelectTrigger'
import { MultiSelectCombobox } from '~/ui/MultiSelectCombobox'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { Select } from '~/ui/Select'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { VirtualizedMultiSelect, VirtualizedSelect } from '~/ui/VirtualizedSelect'
import { DEMO_LOGO, DEMO_LOGO_ALT } from '../demoAssets'
import { Example, type Family, type KnobValues, Row, StateGrid } from '../shared'

const CHAINS = ['Ethereum', 'Arbitrum', 'Base', 'Solana']
const MANY_CHAINS = [
	'Ethereum',
	'Arbitrum',
	'Base',
	'Solana',
	'Optimism',
	'Polygon',
	'Avalanche',
	'BNB Chain',
	'Fantom',
	'Linea',
	'Scroll',
	'Blast',
	'Mantle'
]
const CHANNELS = [
	{ key: 'alerts', name: '#alerts' },
	{ key: 'research', name: '#research' },
	{ key: 'treasury', name: '#treasury', disabled: true, help: 'Private channel: invite the bot first' }
]
const PROTOCOLS = [
	{ value: 'aave', label: 'Aave', group: 'Lending', logo: DEMO_LOGO },
	{ value: 'aave-v3', label: 'Aave V3', group: 'Lending', isChild: true },
	{ value: 'compound', label: 'Compound', group: 'Lending', description: 'Money market' },
	{ value: 'lido', label: 'Lido', group: 'Liquid staking', logo: DEMO_LOGO_ALT },
	{ value: 'rocket-pool', label: 'Rocket Pool', group: 'Liquid staking' },
	{ value: 'uniswap', label: 'Uniswap', group: 'DEX' },
	{ value: 'curve', label: 'Curve', group: 'DEX', disabled: true }
]
const TRIGGER_VARIANTS = ['default', 'filter', 'input'] as const
type TriggerVariant = (typeof TRIGGER_VARIANTS)[number]

const STATE_VALUES = ['rest', 'loading', 'error']

function SelectDemo({ values }: { values: KnobValues }) {
	const [chain, setChain] = useState('Ethereum')
	const [chains, setChains] = useState(['Ethereum', 'Base'])
	const props = {
		allValues: CHAINS,
		variant: values.variant as TriggerVariant,
		size: values.size as 'md' | 'sm',
		triggerProps: { disabled: values.state === 'disabled', 'aria-invalid': values.state === 'invalid' || undefined }
	}
	return values.multi ? (
		<Select label="Chains" selectedValues={chains} setSelectedValues={setChains} {...props} />
	) : (
		<Select label="Chain" selectedValues={chain} setSelectedValues={setChain} {...props} />
	)
}

function SelectVariantsDemo() {
	const [chain, setChain] = useState('Ethereum')
	const [chains, setChains] = useState(['Ethereum', 'Base'])
	return (
		<Example wide name="Variant × size" prop="variant, size" note="Single pick at md, multi pick at sm.">
			<StateGrid
				columns={['size md', 'size sm']}
				rows={TRIGGER_VARIANTS.map((variant) => [
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
	)
}

function DisabledOptionDemo() {
	const [channel, setChannel] = useState('alerts')
	return (
		<Example
			name="Disabled option"
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
	)
}

function SelectWithComboboxDemo({ values }: { values: KnobValues }) {
	const [picked, setPicked] = useState(['Ethereum', 'Base'])
	const single = values.singleSelect === true
	const long = values.list === 'long'
	return (
		<SelectWithCombobox
			label={single ? 'Chain' : 'Chains'}
			singleSelect={single}
			allValues={long ? MANY_CHAINS : CHAINS}
			selectedValues={single ? picked.slice(0, 1) : picked}
			setSelectedValues={setPicked}
			quickActions={
				single ? undefined : [{ label: 'Only L2s', onSelect: () => setPicked(['Arbitrum', 'Base', 'Optimism']) }]
			}
			variant="filter"
			size="md"
		/>
	)
}

function MultiSelectComboboxDemo() {
	const [protocols, setProtocols] = useState(['aave'])
	return (
		<MultiSelectCombobox
			heading="Protocols"
			placeholder="Search protocols…"
			data={PROTOCOLS}
			selectedValues={protocols}
			setSelectedValues={setProtocols}
		/>
	)
}

function VirtualizedSelectDemo({ values }: { values: KnobValues }) {
	// Starts with no pick, so the placeholder shows until the reader picks.
	const [protocol, setProtocol] = useState<string | null>(null)
	const field = values.variant === 'field'
	return (
		<VirtualizedSelect
			variant={field ? 'field' : 'chip'}
			label="Protocol"
			placeholder={field ? 'Choose a protocol' : 'Any'}
			options={PROTOCOLS}
			selectedValue={protocol}
			onChange={(option) => setProtocol(option.value)}
			isLoading={values.state === 'loading'}
			error={values.state === 'error' ? 'Choose a protocol.' : null}
			className={field ? 'w-56' : undefined}
		/>
	)
}

function VirtualizedMultiSelectDemo({ values }: { values: KnobValues }) {
	const [protocols, setProtocols] = useState(['aave', 'lido'])
	const field = values.variant === 'field'
	return (
		<VirtualizedMultiSelect
			variant={field ? 'field' : 'chip'}
			label="Protocols"
			placeholder={field ? 'Choose protocols' : 'Any'}
			options={PROTOCOLS}
			selectedValues={protocols}
			onChange={setProtocols}
			maxSelections={values.cap ? 3 : undefined}
			isLoading={values.state === 'loading'}
			error={values.state === 'error' ? 'Choose at least one protocol.' : null}
			className={field ? 'w-56' : undefined}
		/>
	)
}

/** Beside a Select of the same variant and size, so the two triggers read as one row of filters. */
function PopoverSelectTriggerDemo({ values }: { values: KnobValues }) {
	const [chain, setChain] = useState('Ethereum')
	const variant = values.variant as TriggerVariant
	const size = values.size as 'md' | 'sm'
	return (
		<Row>
			<Select
				label="Chain"
				allValues={CHAINS}
				selectedValues={chain}
				setSelectedValues={setChain}
				variant={variant}
				size={size}
			/>
			<Ariakit.PopoverProvider>
				<PopoverSelectTrigger variant={variant} size={size}>
					TVL range
				</PopoverSelectTrigger>
				<PopoverSurface variant="panel" heading="TVL range" width="sm">
					<p className="p-3 body-sm text-secondary">A picker-like panel: a range form, presets, a date range.</p>
				</PopoverSurface>
			</Ariakit.PopoverProvider>
		</Row>
	)
}

export const pickers: Family = {
	id: 'pickers',
	title: 'Pickers',
	parts: [
		{
			name: 'Select',
			source: 'src/ui/Select.tsx',
			knobs: [
				{ name: 'variant', values: TRIGGER_VARIANTS },
				{ name: 'size', values: ['md', 'sm'] },
				{ name: 'state', values: ['rest', 'disabled', 'invalid'], default: 'rest', prop: false },
				{ name: 'multi', boolean: true, prop: false }
			],
			render: (values) => <SelectDemo values={values} />,
			states: () => (
				<>
					<SelectVariantsDemo />
					<Example name="Disabled and invalid" prop="disabled | aria-invalid">
						<Row>
							<Select
								label="Chain"
								allValues={CHAINS}
								selectedValues="Ethereum"
								setSelectedValues={() => {}}
								variant="input"
								size="md"
								triggerProps={{ disabled: true }}
							/>
							<Select
								label="Chain"
								allValues={CHAINS}
								selectedValues="Ethereum"
								setSelectedValues={() => {}}
								variant="input"
								size="md"
								triggerProps={{ 'aria-invalid': true }}
							/>
						</Row>
					</Example>
					<DisabledOptionDemo />
				</>
			)
		},
		{
			name: 'SelectWithCombobox',
			source: 'src/ui/SelectWithCombobox.tsx',
			knobs: [
				{ name: 'singleSelect', boolean: true },
				{ name: 'list', values: ['short', 'long'], default: 'short', prop: false }
			],
			note: 'Open it: the long list of 13 adds the search; a multi pick adds Select all and a quick action.',
			render: (values) => <SelectWithComboboxDemo values={values} />
		},
		{
			name: 'VirtualizedSelect',
			source: 'src/ui/VirtualizedSelect.tsx',
			knobs: [
				{ name: 'variant', values: ['field', 'chip'] },
				{ name: 'state', values: STATE_VALUES, default: 'rest', prop: false }
			],
			note: 'Open it: the list shows groups, a logo, a second line, a child row and a disabled row.',
			render: (values) => <VirtualizedSelectDemo values={values} />
		},
		{
			name: 'VirtualizedMultiSelect',
			source: 'src/ui/VirtualizedSelect.tsx',
			knobs: [
				{ name: 'variant', values: ['field', 'chip'], default: 'field' },
				{ name: 'state', values: STATE_VALUES, default: 'rest', prop: false },
				{ name: 'cap', boolean: true, prop: false }
			],
			note: 'Select all leads the list while every option fits under the cap; with cap on, the rest disable at three picks.',
			render: (values) => <VirtualizedMultiSelectDemo values={values} />
		},
		{
			name: 'PopoverSelectTrigger',
			source: 'src/ui/ComboboxSelectTrigger.tsx',
			knobs: [
				{ name: 'variant', values: TRIGGER_VARIANTS },
				{ name: 'size', values: ['md', 'sm'] }
			],
			note: 'A popover that is not a list wears the picker trigger and its arrow, so it matches the Select beside it.',
			render: (values) => <PopoverSelectTriggerDemo values={values} />
		},
		{
			name: 'MultiSelectCombobox',
			source: 'src/ui/MultiSelectCombobox.tsx',
			note: 'Type to search; each pick becomes a chip before the input, and removing one moves focus to its neighbor.',
			render: () => <MultiSelectComboboxDemo />
		}
	]
}
