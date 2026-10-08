import * as Ariakit from '@ariakit/react'
import { useState, type ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { formatPriceDisplay, normalizePriceInput } from '~/containers/LlamaAI/components/alerts/createAlertForm'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { TAG_GROUP_BUTTON_SIZES, TAG_GROUP_SIZES, TAG_GROUP_VARIANTS } from '~/ui/SegmentedControl'

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

export const alertFieldLabelClass = 'label-sm text-secondary'

/** The 32px tile that leads every alerts dialog header. */
export function AlertsHeaderIcon() {
	return (
		<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-tint text-warning">
			<Icon name="calendar-plus" className="size-4" aria-hidden="true" />
		</span>
	)
}

export function PriceInput({ value, onValueChange }: { value: string; onValueChange: (canonical: string) => void }) {
	// What the reader types while the field has focus; null shows the formatted value.
	const [draft, setDraft] = useState<string | null>(null)

	return (
		<div className="relative w-32">
			<span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 body-md text-tertiary">$</span>
			<Input
				type="text"
				inputMode="decimal"
				value={draft ?? formatPriceDisplay(value)}
				onFocus={() => setDraft(value)}
				onBlur={() => setDraft(null)}
				onChange={(e) => {
					const rawValue = e.currentTarget.value
					const canonical = normalizePriceInput(rawValue)
					setDraft(rawValue)
					onValueChange(canonical)
				}}
				placeholder="Price"
				aria-label="Price"
				className="w-full pl-6"
			/>
		</div>
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
	label
}: {
	value: T
	onChange: (next: T) => void
	options: ReadonlyArray<{ value: T; label: string }>
	label: string
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
						className={`${TAG_GROUP_VARIANTS.default.button} ${TAG_GROUP_BUTTON_SIZES.default.md} relative cursor-pointer capitalize has-focus-visible:focus-ring`}
					>
						<Ariakit.Radio value={option.value} aria-label={option.label} className="sr-only" />
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
			? 'bg-success-tint text-success'
			: tone === 'error'
				? 'bg-error-tint text-error'
				: tone === 'warning'
					? 'bg-warning-tint text-warning'
					: 'bg-surface-elevated-2 text-tertiary'
	return (
		<span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 label-xs capitalize ${toneClass}`}>
			{children}
		</span>
	)
}
