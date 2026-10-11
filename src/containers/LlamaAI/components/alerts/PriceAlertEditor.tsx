import { useState, type ReactNode } from 'react'
import { formatTokenLabel } from '~/containers/LlamaAI/components/alerts/alertsListHelpers'
import { roundPriceValue, validatePrice } from '~/containers/LlamaAI/components/alerts/createAlertForm'
import type { PriceTrigger } from '~/containers/LlamaAI/components/alerts/types'
import { alertFieldLabelClass, PriceInput, PRICE_OPERATOR_OPTIONS } from '~/containers/LlamaAI/components/alerts/ui'
import { Button } from '~/ui/Button'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus } from '~/ui/Status'

interface PriceAlertEditorProps {
	trigger: PriceTrigger
	isSaving: boolean
	/** Whether a field passed in `children` has an error; Save then shows it instead of saving. */
	fieldsInvalid: boolean
	errorMessage: string | null
	onCancel: () => void
	onSave: (trigger: PriceTrigger) => void
	/** Fields that save with the trigger, such as the name and delivery, placed above it inside the form. They show
	    their errors once `submitted`, the form's one submit state. */
	children: (submitted: boolean) => ReactNode
}

export function PriceAlertEditor({
	trigger,
	isSaving,
	fieldsInvalid,
	errorMessage,
	onCancel,
	onSave,
	children
}: PriceAlertEditorProps) {
	const [op, setOp] = useState<'above' | 'below'>(trigger.op)
	const [value, setValue] = useState(() => roundPriceValue(trigger.value))
	const [submitted, setSubmitted] = useState(false)
	const priceError = validatePrice(value)

	return (
		<form
			noValidate
			onSubmit={(e) => {
				e.preventDefault()
				if (isSaving) return
				if (priceError || fieldsInvalid) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
				onSave({ type: 'price', token_nk: trigger.token_nk, op, value: Number(value), recurring: trigger.recurring })
			}}
			className="flex flex-col gap-3"
		>
			{children(submitted)}
			<div className="flex flex-col gap-1">
				<span className={alertFieldLabelClass}>Token</span>
				<span className="mono-md text-primary">{formatTokenLabel(trigger.token_nk)}</span>
			</div>
			<Field label="Fires when the price goes" error={submitted ? priceError : null}>
				{(control) => (
					<div className="flex flex-wrap items-center gap-2">
						<SegmentedControl<'above' | 'below'>
							label="Price comparison"
							value={op}
							onValueChange={setOp}
							options={PRICE_OPERATOR_OPTIONS}
							variant="default"
							size="md"
						/>
						<PriceInput value={value} onValueChange={setValue} control={control} />
					</div>
				)}
			</Field>
			{errorMessage ? <InlineStatus variant="error">{errorMessage}</InlineStatus> : null}
			<div className="flex flex-wrap items-center justify-end gap-2">
				<Button type="button" size="md" disabled={isSaving} onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" variant="primary" size="md" pendingLabel="Saving…" pending={isSaving}>
					Save
				</Button>
			</div>
		</form>
	)
}
