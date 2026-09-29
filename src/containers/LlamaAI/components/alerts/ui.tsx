import * as Ariakit from '@ariakit/react'
import { useState, type ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { formatPriceDisplay, normalizePriceInput } from '~/containers/LlamaAI/components/alerts/createAlertForm'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input, inputStyles } from '~/ui/Input'
import { TAG_GROUP_SIZES, TAG_GROUP_VARIANTS } from '~/ui/SegmentedControl'
import { Switch } from '~/ui/Switch'

const settingsIntegrationsLinkClass =
	'cursor-pointer underline decoration-dotted underline-offset-2 not-disabled:not-aria-disabled:hover:text-link'

export function SettingsIntegrationsLink() {
	const { openSettingsModal } = useTipActions()
	if (openSettingsModal) {
		return (
			<button type="button" onClick={() => openSettingsModal('integrations')} className={settingsIntegrationsLinkClass}>
				Settings → Integrations
			</button>
		)
	}
	return (
		<BasicLink
			href="/ai/chat?modal=settings&tab=integrations"
			target="_blank"
			rel="noopener noreferrer"
			className={settingsIntegrationsLinkClass}
		>
			Settings → Integrations
		</BasicLink>
	)
}

export const alertInputClass = `${inputStyles} w-full`

export const alertSelectClass = inputStyles

export const alertFieldLabelClass = 'label-sm text-secondary'

export const alertIconButtonClass = buttonStyles({ variant: 'ghost', size: 'md', square: true })

/** The 32px tile that leads every alerts dialog header. */
export function AlertsHeaderIcon() {
	return (
		<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
			<Icon name="calendar-plus" className="size-4" aria-hidden="true" />
		</span>
	)
}

export function PriceInput({
	value,
	onValueChange,
	placeholder = 'Price'
}: {
	value: string
	onValueChange: (canonical: string) => void
	placeholder?: string
}) {
	const [isFocused, setIsFocused] = useState(false)
	const [draft, setDraft] = useState(value)
	const display = isFocused ? draft : formatPriceDisplay(value)

	return (
		<div className="relative w-32">
			<span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-tertiary">$</span>
			<Input
				type="text"
				inputMode="decimal"
				value={display}
				onFocus={() => {
					setIsFocused(true)
					setDraft(value)
				}}
				onBlur={() => setIsFocused(false)}
				onChange={(e) => {
					const rawValue = e.currentTarget.value
					const canonical = normalizePriceInput(rawValue)
					setDraft(rawValue)
					onValueChange(canonical)
				}}
				placeholder={placeholder}
				aria-label={placeholder}
				className="w-full pl-6"
			/>
		</div>
	)
}

export function ToggleSwitch({
	checked,
	onClick,
	label,
	disabled,
	isLoading
}: {
	checked: boolean
	onClick: () => void
	label: string
	disabled?: boolean
	isLoading?: boolean
}) {
	return (
		<Switch
			label={label}
			hideLabel
			value={label}
			checked={checked}
			onChange={onClick}
			disabled={disabled}
			isLoading={isLoading}
		/>
	)
}

export const DELIVERY_OPTIONS = [
	{ value: 'email', label: 'Email' },
	{ value: 'telegram', label: 'Telegram' },
	{ value: 'slack', label: 'Slack' }
] as const

export const PRICE_OPERATOR_OPTIONS = [
	{ value: 'above', label: 'Above' },
	{ value: 'below', label: 'Below' }
] as const

export function SegmentedToggle<T extends string>({
	value,
	onChange,
	options,
	label,
	disabled
}: {
	value: T
	onChange: (next: T) => void
	options: ReadonlyArray<{ value: T; label: string }>
	label: string
	disabled?: boolean
}) {
	return (
		<Ariakit.RadioProvider
			value={value}
			setValue={(next) => {
				const option = options.find((option) => option.value === next)
				if (option && option.value !== value) onChange(option.value)
			}}
		>
			<Ariakit.RadioGroup
				aria-label={label}
				className={`${TAG_GROUP_VARIANTS.default.container} ${TAG_GROUP_SIZES.md}`}
			>
				{options.map((option) => (
					<label
						key={option.value}
						data-active={value === option.value}
						className={`${TAG_GROUP_VARIANTS.default.button} relative cursor-pointer capitalize has-focus-visible:focus-ring has-disabled:cursor-not-allowed has-disabled:opacity-60`}
					>
						<Ariakit.Radio value={option.value} aria-label={option.label} disabled={disabled} className="sr-only" />
						{option.label}
					</label>
				))}
			</Ariakit.RadioGroup>
		</Ariakit.RadioProvider>
	)
}

export function StatusChip({
	tone,
	children
}: {
	tone: 'success' | 'error' | 'neutral' | 'warning'
	children: ReactNode
}) {
	const toneClass =
		tone === 'success'
			? 'bg-success/10 text-success'
			: tone === 'error'
				? 'bg-error/10 text-error'
				: tone === 'warning'
					? 'bg-warning/10 text-warning'
					: 'bg-surface-elevated-2 text-tertiary'
	return (
		<span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 label-xs capitalize ${toneClass}`}>
			{children}
		</span>
	)
}
