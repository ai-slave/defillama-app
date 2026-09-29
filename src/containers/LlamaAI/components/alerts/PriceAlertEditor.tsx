import { useState, type ReactNode } from 'react'
import { formatTokenLabel } from '~/containers/LlamaAI/components/alerts/alertsListHelpers'
import { roundPriceValue, validatePriceTrigger } from '~/containers/LlamaAI/components/alerts/createAlertForm'
import type { PriceTrigger } from '~/containers/LlamaAI/components/alerts/types'
import {
	alertFieldLabelClass,
	PriceInput,
	PRICE_OPERATOR_OPTIONS,
	SegmentedToggle
} from '~/containers/LlamaAI/components/alerts/ui'
import { Button } from '~/ui/Button'
import { InlineStatus } from '~/ui/Status'

interface PriceAlertEditorProps {
	trigger: PriceTrigger
	isSaving: boolean
	/** Why saving is unavailable, shown beside Save; null when the alert can be saved. */
	blockReason?: string | null
	errorMessage?: string | null
	onCancel: () => void
	onSave: (trigger: PriceTrigger) => void
	/** Fields that save with the trigger, such as the name and delivery, placed above it inside the form. */
	children?: ReactNode
}

export function PriceAlertEditor({
	trigger,
	isSaving,
	blockReason = null,
	errorMessage,
	onCancel,
	onSave,
	children
}: PriceAlertEditorProps) {
	const [op, setOp] = useState<'above' | 'below'>(trigger.op)
	const [value, setValue] = useState(() => roundPriceValue(trigger.value))

	const priceError = validatePriceTrigger({ tokenNk: trigger.token_nk, value })
	const saveBlockReason = priceError ?? blockReason

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				if (saveBlockReason || isSaving) return
				onSave({ type: 'price', token_nk: trigger.token_nk, op, value: Number(value), recurring: trigger.recurring })
			}}
			className="flex flex-col gap-3"
		>
			{children}
			<div className="flex flex-col gap-1">
				<span className={alertFieldLabelClass}>Token</span>
				<span className="font-mono text-sm text-primary">{formatTokenLabel(trigger.token_nk)}</span>
			</div>
			<div className="flex flex-col gap-1.5">
				<span className={alertFieldLabelClass}>Fires when the price goes</span>
				<div className="flex flex-wrap items-center gap-2">
					<SegmentedToggle<'above' | 'below'>
						label="Price comparison"
						value={op}
						onChange={setOp}
						options={PRICE_OPERATOR_OPTIONS}
					/>
					<PriceInput value={value} onValueChange={setValue} />
				</div>
			</div>
			{errorMessage ? <InlineStatus variant="error">{errorMessage}</InlineStatus> : null}
			<div className="flex flex-wrap items-center justify-end gap-2">
				{saveBlockReason ? <p className="mr-auto body-sm text-secondary">{saveBlockReason}</p> : null}
				<Button type="button" size="md" disabled={isSaving} onClick={onCancel}>
					Cancel
				</Button>
				<Button
					type="submit"
					variant="primary"
					size="md"
					disabled={!!saveBlockReason}
					pendingLabel={isSaving ? 'Saving…' : null}
				>
					Save
				</Button>
			</div>
		</form>
	)
}
