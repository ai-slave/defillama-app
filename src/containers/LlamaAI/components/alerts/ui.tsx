import { useState } from 'react'
import { BasicLink } from '~/components/Link'
import { formatPriceDisplay, normalizePriceInput } from '~/containers/LlamaAI/components/alerts/createAlertForm'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'
import type { FieldControlProps } from '~/ui/Field'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'

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

/** `control` is a Field's wiring (ui/Field.tsx); the input keeps its own "Price" name beside the comparison toggle. */
export function PriceInput({
	value,
	onValueChange,
	control
}: {
	value: string
	onValueChange: (canonical: string) => void
	control: FieldControlProps
}) {
	// What the reader types while the field has focus; null shows the formatted value.
	const [draft, setDraft] = useState<string | null>(null)

	return (
		<div className="relative w-32">
			<span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 body-md text-tertiary">$</span>
			<Input
				{...control}
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
