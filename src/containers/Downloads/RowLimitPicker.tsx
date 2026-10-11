import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { Button } from '~/ui/Button'
import { selectTriggerStyles } from '~/ui/ComboboxSelectTrigger'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { formatNumber } from '~/utils/numberFormat'

const PRESETS = [50, 100, 500, 1000] as const

/** The custom input shows a limit that no preset button shows. */
function customText(value: number | null) {
	return value && !PRESETS.includes(value as (typeof PRESETS)[number]) ? String(value) : ''
}

interface RowLimitPickerProps {
	value: number | null // null = no limit / show all rows
	totalRows: number // used to show "of N" in trigger + validate custom input
	onChange: (value: number | null) => void
	disabled?: boolean
}

export function RowLimitPicker({ value, totalRows, onChange, disabled }: RowLimitPickerProps) {
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-start' })

	const [customInput, setCustomInput] = useState(() => customText(value))

	// The custom input restarts from the selected limit whenever the selection changes.
	const [syncedValue, setSyncedValue] = useState(value)
	if (value !== syncedValue) {
		setSyncedValue(value)
		setCustomInput(customText(value))
	}

	const isActive = value !== null && value > 0

	const handlePresetClick = (n: number | null) => {
		setCustomInput('')
		onChange(n)
		popover.hide()
	}

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure
				disabled={disabled}
				className={`${selectTriggerStyles('filter', 'md')} max-w-72 shrink-0`}
			>
				<span className="shrink-0">Row limit: </span>
				<span className={`truncate ${isActive ? 'text-link' : 'text-tertiary'}`}>
					{isActive && value
						? `Top ${formatNumber(value)}${totalRows > 0 ? ` of ${formatNumber(totalRows)}` : ''}`
						: 'All'}
				</span>
				<Icon name="chevron-down" className="size-3.5 shrink-0 text-tertiary" />
			</Ariakit.PopoverDisclosure>

			<PopoverSurface variant="panel" heading="Row limit" className="w-72">
				<div className="flex flex-col gap-3 p-3">
					<section className="flex flex-col gap-2">
						<h3 className="label-sm text-secondary">Top rows</h3>
						<div className="flex flex-wrap gap-1">
							{[...PRESETS, null].map((n) => {
								const isSelected = n === null ? !isActive : value === n
								return (
									<Button
										key={n ?? 'all'}
										type="button"
										variant="toggle"
										size="sm"
										data-active={isSelected}
										aria-pressed={isSelected}
										onClick={() => handlePresetClick(n)}
									>
										{n === null ? 'All' : formatNumber(n)}
									</Button>
								)
							})}
						</div>
					</section>

					{/* The surface unmounts on hide, so each opening starts with no error; the draft lives here and survives it. */}
					<CustomLimitForm
						draft={customInput}
						setDraft={setCustomInput}
						onApply={(limit) => {
							onChange(limit)
							popover.hide()
						}}
					/>

					<p className="body-sm text-tertiary">Applied after sort: the top N by the current sort order.</p>
				</div>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}

function CustomLimitForm({
	draft,
	setDraft,
	onApply
}: {
	draft: string
	setDraft: (value: string) => void
	onApply: (limit: number) => void
}) {
	const [submitted, setSubmitted] = useState(false)
	// A fraction rounds down, as the limit counts whole rows.
	const limit = Math.floor(Number(draft))
	const error = !draft ? 'Enter a row limit.' : limit < 1 ? 'Enter a row limit of 1 or more.' : null

	return (
		<form
			noValidate
			onSubmit={(e) => {
				e.preventDefault()
				if (error) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
				onApply(limit)
			}}
			className="border-t border-subtle pt-3"
		>
			<Field label="Custom" error={submitted ? error : null}>
				{(control) => (
					<div className="flex items-center gap-2">
						<Input
							{...control}
							type="number"
							aria-label="Custom row limit"
							min={1}
							inputMode="numeric"
							value={draft}
							onChange={(e) => setDraft(e.currentTarget.value)}
							placeholder="e.g. 250"
							className="min-w-0 flex-1"
						/>
						<Button type="submit" variant="primary" size="md">
							Apply
						</Button>
					</div>
				)}
			</Field>
		</form>
	)
}
