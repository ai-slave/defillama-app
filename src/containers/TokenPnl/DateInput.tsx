import { useState } from 'react'
import { Field } from '~/ui/Field'
import { Input } from '~/ui/Input'

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
// type="date" fires change with padded years (e.g. 0002) while the real year is still being typed. Keep in sync with TokenPnl min (epoch).
const MIN_PLAUSIBLE_YEAR = 1970

const isPlausibleIsoDate = (value: string): boolean => {
	if (!value) return false
	const match = ISO_DATE_PATTERN.exec(value)
	if (!match) return false
	return Number(match[1]) >= MIN_PLAUSIBLE_YEAR
}

/** A date that applies as soon as it is complete, with no submit. A complete date the page refuses stays in the field
    with the reason under it until the field loses focus, then the applied date returns. */
export function DateInput({
	label,
	value,
	errorFor,
	onChange,
	min,
	max
}: {
	label: string
	value: string
	/** Why the page refuses this date, or null when it applies. */
	errorFor: (date: string) => string | null
	onChange: (value: string) => void
	min?: string
	max?: string
}) {
	// What the reader is typing, only while the field has focus; on blur it shows the committed value, so a date the
	// page rejected goes away. Controlled with the browser's own value, so React never rewrites a date mid-edit.
	const [draft, setDraft] = useState<string | null>(null)
	const error = draft !== null && draft !== value && isPlausibleIsoDate(draft) ? errorFor(draft) : null

	const handleChange = (next: string) => {
		setDraft(next)
		if (next !== value && isPlausibleIsoDate(next) && !errorFor(next)) onChange(next)
	}

	return (
		<Field label={label} error={error} live>
			{(control) => (
				<Input
					{...control}
					type="date"
					value={draft ?? value}
					onChange={(event) => handleChange(event.target.value)}
					onBlur={() => setDraft(null)}
					min={min}
					max={max}
					className="cursor-pointer dark:scheme-dark"
				/>
			)}
		</Field>
	)
}
