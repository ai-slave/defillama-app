import { useState } from 'react'
import { Icon } from '~/components/Icon'
import { formatTokenLabel } from '~/containers/LlamaAI/components/alerts/alertsListHelpers'
import { roundPriceValue } from '~/containers/LlamaAI/components/alerts/createAlertForm'
import type { PriceTrigger } from '~/containers/LlamaAI/components/alerts/types'
import { alertFieldLabelClass, PriceInput, SegmentedToggle } from '~/containers/LlamaAI/components/alerts/ui'
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
				if (!isValueValid || !canSave) return
				onSave({ type: 'price', token_nk: trigger.token_nk, op, value: numericValue, recurring: trigger.recurring })
			}}
			className="flex flex-col gap-3"
		>
			<div className="flex flex-col gap-1">
				<span className={alertFieldLabelClass}>Token</span>
				<span className="font-mono text-sm text-(--text-primary)">{formatTokenLabel(trigger.token_nk)}</span>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<SegmentedToggle<'above' | 'below'>
					value={op}
					onChange={setOp}
					options={[
						{ value: 'above', label: 'Above' },
						{ value: 'below', label: 'Below' }
					]}
				/>
				<PriceInput value={value} onValueChange={setValue} />
			</div>
			<div className="flex justify-end gap-2">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg px-3 py-1.5 text-xs text-[#666] transition-colors hover:bg-black/[0.05] dark:text-[#919296] dark:hover:bg-white/[0.06]"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={isSaving || !isValueValid || !canSave}
					className="flex items-center gap-1.5 rounded-lg bg-(--old-blue) px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a58b4] disabled:opacity-50"
				>
					{isSaving ? <LoadingSpinner size={12} /> : <Icon name="check" className="size-3.5" />}
					Save
				</button>
			</div>
			{errorMessage ? <p className="text-center text-xs text-red-500">{errorMessage}</p> : null}
		</form>
	)
}
