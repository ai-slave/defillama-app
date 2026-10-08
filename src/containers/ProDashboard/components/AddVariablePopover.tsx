import * as Ariakit from '@ariakit/react'
import { type FormEvent, useId, useMemo, useState } from 'react'
import { VirtualizedSelect, type VirtualizedSelectOption } from '~/components/Select/VirtualizedSelect'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { tw } from '~/ui/tw'
import { DASHBOARD_VARIABLE_LABEL_MAX_LENGTH, type DashboardVariableKind } from '../dashboardTypes'
import {
	ALL_CHAINS_VARIABLE_VALUE,
	listCompatibleBindings,
	slugifyVariableId,
	suggestVariableBindings
} from '../dashboardVariables/resolve'
import { useProDashboardCatalog, useProDashboardItemsState, useProDashboardVariables } from '../ProDashboardAPIContext'
import { getItemIconUrl } from '../utils'

export const VARIABLE_KIND_LABELS: Record<DashboardVariableKind, string> = {
	chain: 'Chain',
	protocol: 'Protocol'
}

const VARIABLE_KIND_OPTIONS: Array<SegmentedControlOption<DashboardVariableKind>> = [
	{
		value: 'chain',
		label: (
			<>
				<Icon name="chain" height={14} width={14} />
				{VARIABLE_KIND_LABELS.chain}
			</>
		)
	},
	{
		value: 'protocol',
		label: (
			<>
				<Icon name="protocol" height={14} width={14} />
				{VARIABLE_KIND_LABELS.protocol}
			</>
		)
	}
]

type BindMode = 'matching' | 'all' | 'none'

const BIND_OPTION_STYLES = tw`flex cursor-pointer items-center gap-2 text-sm text-pro-text-primary has-disabled:cursor-not-allowed has-disabled:opacity-50`

function cardsLabel(count: number) {
	return `${count} ${count === 1 ? 'card' : 'cards'}`
}

export function useVariableOptions(kind: DashboardVariableKind): {
	options: Array<VirtualizedSelectOption>
	isLoading: boolean
} {
	const { chains, protocols, protocolsLoading } = useProDashboardCatalog()
	const options = useMemo<Array<VirtualizedSelectOption>>(() => {
		if (kind === 'chain') {
			return [
				{ value: ALL_CHAINS_VARIABLE_VALUE, label: ALL_CHAINS_VARIABLE_VALUE },
				...chains.map((chain) => ({
					value: chain.name,
					label: chain.name,
					logo: getItemIconUrl('chain', chain, chain.name)
				}))
			]
		}
		return protocols
			.toSorted((a, b) => (b.tvl || 0) - (a.tvl || 0))
			.map((protocol) => ({
				value: protocol.slug,
				label: protocol.name,
				logo: getItemIconUrl('protocol', protocol, protocol.slug)
			}))
	}, [kind, chains, protocols])
	return { options, isLoading: protocolsLoading }
}

export function AddVariablePopover() {
	const { variables, addVariable } = useProDashboardVariables()
	const { items } = useProDashboardItemsState()
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-start' })
	const [kind, setKind] = useState<DashboardVariableKind>('chain')
	const labelInputId = useId()
	const [label, setLabel] = useState<string>(VARIABLE_KIND_LABELS.chain)
	const [value, setValue] = useState('')
	const [bindMode, setBindMode] = useState<BindMode | null>(null)
	const { options, isLoading } = useVariableOptions(kind)

	const matchingTargets = useMemo(
		() => (value.length > 0 ? suggestVariableBindings(items, kind, value) : []),
		[items, kind, value]
	)
	const compatibleTargets = useMemo(
		() => (value.length > 0 ? listCompatibleBindings(items, kind, value) : []),
		[items, kind, value]
	)
	const effectiveBindMode: BindMode = bindMode ?? (matchingTargets.length > 0 ? 'matching' : 'none')
	const trimmedLabel = label.trim()
	const canSubmit = trimmedLabel.length > 0 && value.length > 0
	const valueLabel = options.find((option) => option.value === value)?.label ?? value
	const bindGroupId = useId()
	const kindGroupId = useId()

	const selectKind = (nextKind: DashboardVariableKind) => {
		setKind(nextKind)
		setLabel(VARIABLE_KIND_LABELS[nextKind])
		setValue('')
	}

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!canSubmit) return
		const id = slugifyVariableId(trimmedLabel, new Set(variables.map((variable) => variable.id)))
		const targets =
			effectiveBindMode === 'all' ? compatibleTargets : effectiveBindMode === 'matching' ? matchingTargets : []
		addVariable({ id, kind, label: trimmedLabel, value }, targets)
		popover.setOpen(false)
		setValue('')
		setBindMode(null)
	}

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure render={<Button size="md" type="button" variant="ghost" />}>
				<Icon name="plus" height={14} width={14} />
				<span>Parameter</span>
			</Ariakit.PopoverDisclosure>
			<PopoverSurface variant="panel" gutter={8} heading="Add a dashboard parameter">
				<form onSubmit={handleSubmit} className="flex w-[320px] max-w-full flex-col gap-3 p-3">
					<p className="text-xs text-pro-text-tertiary">
						A parameter lets viewers switch every bound card to another chain or protocol. Bind cards below or later
						from each card’s editor.
					</p>
					<div className="flex flex-col gap-1">
						<span id={kindGroupId} className="label-sm text-pro-text-primary">
							Parameter type
						</span>
						<SegmentedControl
							aria-labelledby={kindGroupId}
							label="Parameter type"
							variant="field"
							size="md"
							value={kind}
							onValueChange={selectKind}
							options={VARIABLE_KIND_OPTIONS}
						/>
					</div>
					<label htmlFor={labelInputId} className="flex flex-col gap-1">
						<span className="label-sm text-pro-text-primary">Label</span>
						<Input
							id={labelInputId}
							value={label}
							maxLength={DASHBOARD_VARIABLE_LABEL_MAX_LENGTH}
							onChange={(event) => setLabel(event.target.value)}
							placeholder={VARIABLE_KIND_LABELS[kind]}
						/>
					</label>
					<VirtualizedSelect
						variant="field"
						label="Initial value"
						options={options}
						selectedValue={value.length > 0 ? value : null}
						onChange={(option) => setValue(option.value)}
						placeholder={kind === 'chain' ? 'Select chain…' : 'Select protocol…'}
						isLoading={isLoading}
					/>
					{compatibleTargets.length > 0 ? (
						<Ariakit.RadioProvider value={effectiveBindMode} setValue={(mode) => setBindMode(mode as BindMode)}>
							<p id={bindGroupId} className="text-xs font-medium text-pro-text-secondary">
								Bind cards
							</p>
							<Ariakit.RadioGroup aria-labelledby={bindGroupId} className="flex flex-col gap-1.5">
								{matchingTargets.length > 0 ? (
									<label htmlFor={`${bindGroupId}-matching`} className={BIND_OPTION_STYLES}>
										<Ariakit.Radio id={`${bindGroupId}-matching`} value="matching" className="accent-brand" />
										{`${cardsLabel(matchingTargets.length)} that use ${valueLabel}`}
									</label>
								) : null}
								<label htmlFor={`${bindGroupId}-all`} className={BIND_OPTION_STYLES}>
									<Ariakit.Radio id={`${bindGroupId}-all`} value="all" className="accent-brand" />
									{`All ${cardsLabel(compatibleTargets.length)} with a ${VARIABLE_KIND_LABELS[kind].toLowerCase()}`}
								</label>
								<label htmlFor={`${bindGroupId}-none`} className={BIND_OPTION_STYLES}>
									<Ariakit.Radio id={`${bindGroupId}-none`} value="none" className="accent-brand" />
									Don’t bind yet
								</label>
							</Ariakit.RadioGroup>
						</Ariakit.RadioProvider>
					) : null}
					<Button
						type="submit"
						size="sm"
						variant="primary"
						disabled={!canSubmit}
						data-umami-event="dashboard-variable-add"
					>
						<span>Add parameter</span>
					</Button>
				</form>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}
