import { useState } from 'react'
import { formatTokenLabel } from '~/containers/LlamaAI/components/alerts/alertsListHelpers'
import { roundPriceValue } from '~/containers/LlamaAI/components/alerts/createAlertForm'
import type { PriceTrigger } from '~/containers/LlamaAI/components/alerts/types'
import {
	alertFieldLabelClass,
	PriceInput,
	PRICE_OPERATOR_OPTIONS,
	SegmentedToggle
} from '~/containers/LlamaAI/components/alerts/ui'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'

interface PriceAlertEditorProps {
	trigger: PriceTrigger
	isSaving: boolean
	canSave?: boolean
	errorMessage?: string | null
	onCancel: () => void
	onSave: (trigger: PriceTrigger) => void
}

export function PriceAlertEditor({
	trigger,
	isSaving,
	canSave = true,
	errorMessage,
	onCancel,
	onSave
}: PriceAlertEditorProps) {
	const [op, setOp] = useState<'above' | 'below'>(trigger.op)
	const [value, setValue] = useState(() => roundPriceValue(trigger.value))

	const numericValue = Number(value)
	const isValueValid = value.trim() !== '' && Number.isFinite(numericValue) && numericValue > 0

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				if (!isValueValid || !canSave || isSaving) return
				onSave({ type: 'price', token_nk: trigger.token_nk, op, value: numericValue, recurring: trigger.recurring })
			}}
			className="flex flex-col gap-3"
		>
			<div className="flex flex-col gap-1">
				<span className={alertFieldLabelClass}>Token</span>
				<span className="font-mono text-sm text-primary">{formatTokenLabel(trigger.token_nk)}</span>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<SegmentedToggle<'above' | 'below'>
					label="Price comparison"
					value={op}
					onChange={setOp}
					options={PRICE_OPERATOR_OPTIONS}
				/>
				<PriceInput value={value} onValueChange={setValue} />
			</div>
			<div className="flex justify-end gap-2">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg px-3 py-1.5 text-xs text-tertiary not-disabled:not-aria-disabled:hover:bg-hover-row"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={isSaving || !isValueValid || !canSave}
					className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-ai-white not-disabled:not-aria-disabled:hover:brightness-110 disabled:opacity-50"
				>
					{isSaving ? <LoadingSpinner size={12} /> : <Icon name="check" className="size-3.5" />}
					Save
				</button>
			</div>
			{errorMessage ? <p className="text-center text-xs text-error">{errorMessage}</p> : null}
		</form>
	)
}
