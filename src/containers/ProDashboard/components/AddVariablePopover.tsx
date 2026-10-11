import * as Ariakit from '@ariakit/react'
import { type FormEvent, useId, useMemo, useState } from 'react'
import { VirtualizedSelect, type VirtualizedSelectOption } from '~/components/Select/VirtualizedSelect'
import { Button } from '~/ui/Button'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
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
				<Icon name="chain" className="size-3.5" />
				{VARIABLE_KIND_LABELS.chain}
			</>
		)
	},
	{
		value: 'protocol',
		label: (
			<>
				<Icon name="protocol" className="size-3.5" />
				{VARIABLE_KIND_LABELS.protocol}
			</>
		)
	}
]

type BindMode = 'matching' | 'all' | 'none'

const BIND_OPTION_STYLES = tw`flex cursor-pointer items-center gap-2 label-md text-primary has-disabled:cursor-not-allowed has-disabled:text-disabled`

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

type VariableDraft = { kind: DashboardVariableKind; label: string; value: string; bindMode: BindMode | null }

export function AddVariablePopover() {
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-start' })
	// The draft outlives a close, so a half-set parameter is still there on the next opening.
	const [draft, setDraft] = useState<VariableDraft>({
		kind: 'chain',
		label: VARIABLE_KIND_LABELS.chain,
		value: '',
		bindMode: null
	})

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure render={<Button size="md" type="button" variant="ghost" />}>
				<Icon name="plus" className="size-3.5" />
				<span>Parameter</span>
			</Ariakit.PopoverDisclosure>
			<PopoverSurface variant="panel" gutter={8} heading="Add a dashboard parameter">
				{/* The surface unmounts on hide, so each opening starts with its errors quiet. */}
				<VariableForm
					draft={draft}
					onDraftChange={setDraft}
					onAdded={() => {
						popover.setOpen(false)
						setDraft({ ...draft, value: '', bindMode: null })
					}}
				/>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}

function VariableForm({
	draft,
	onDraftChange,
	onAdded
}: {
	draft: VariableDraft
	onDraftChange: (draft: VariableDraft) => void
	onAdded: () => void
}) {
	const { kind, label, value, bindMode } = draft
	const { variables, addVariable } = useProDashboardVariables()
	const { items } = useProDashboardItemsState()
	const [submitted, setSubmitted] = useState(false)
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
	const labelError = trimmedLabel ? null : 'Enter a label.'
	const valueError = value ? null : kind === 'chain' ? 'Choose a chain.' : 'Choose a protocol.'
	const valueLabel = options.find((option) => option.value === value)?.label ?? value
	const bindGroupId = useId()
	const kindGroupId = useId()

	const selectKind = (nextKind: DashboardVariableKind) =>
		onDraftChange({ ...draft, kind: nextKind, label: VARIABLE_KIND_LABELS[nextKind], value: '' })

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (labelError || valueError) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		const id = slugifyVariableId(trimmedLabel, new Set(variables.map((variable) => variable.id)))
		const targets =
			effectiveBindMode === 'all' ? compatibleTargets : effectiveBindMode === 'matching' ? matchingTargets : []
		addVariable({ id, kind, label: trimmedLabel, value }, targets)
		onAdded()
	}

	return (
		<form noValidate onSubmit={handleSubmit} className="flex w-[320px] max-w-full flex-col gap-3 p-3">
			<p className="body-sm text-tertiary">
				A parameter lets viewers switch every bound card to another chain or protocol. Bind cards below or later from
				each card’s editor.
			</p>
			<div className="flex flex-col gap-1">
				<span id={kindGroupId} className="label-sm text-secondary">
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
			<Field label="Label" error={submitted ? labelError : null}>
				{(control) => (
					<Input
						{...control}
						required
						value={label}
						maxLength={DASHBOARD_VARIABLE_LABEL_MAX_LENGTH}
						onChange={(event) => onDraftChange({ ...draft, label: event.target.value })}
						placeholder={VARIABLE_KIND_LABELS[kind]}
					/>
				)}
			</Field>
			<VirtualizedSelect
				variant="field"
				label="Initial value"
				options={options}
				selectedValue={value || null}
				onChange={(option) => onDraftChange({ ...draft, value: option.value })}
				placeholder={kind === 'chain' ? 'Select chain…' : 'Select protocol…'}
				isLoading={isLoading}
				error={submitted ? valueError : null}
			/>
			{compatibleTargets.length > 0 ? (
				<Ariakit.RadioProvider
					value={effectiveBindMode}
					setValue={(mode) => onDraftChange({ ...draft, bindMode: mode as BindMode })}
				>
					<p id={bindGroupId} className="label-sm text-secondary">
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
			<Button type="submit" size="sm" variant="primary" data-umami-event="dashboard-variable-add">
				<span>Add parameter</span>
			</Button>
		</form>
	)
}
