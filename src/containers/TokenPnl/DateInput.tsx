import { useId, useState } from 'react'
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

export function DateInput({
	label,
	value,
	error,
	onChange,
	min,
	max
}: {
	label: string
	value: string
	/** Why the page rejected the last date it was given. */
	error: string
	onChange: (value: string) => void
	min?: string
	max?: string
}) {
	// What the reader is typing, only while the field has focus; on blur it shows the committed value, so a date the
	// page rejected goes away. Controlled with the browser's own value, so React never rewrites a date mid-edit.
	const [draft, setDraft] = useState<string | null>(null)
	const errorId = useId()
	// The error belongs to the rejected date, so it shows only while this field still holds one.
	const shownError = draft !== null && draft !== value && error ? error : null

	const handleChange = (next: string) => {
		setDraft(next)
		if (next !== value && isPlausibleIsoDate(next)) onChange(next)
	}

	return (
		<label className="flex flex-col gap-1.5">
			<span className="body-sm text-secondary">{label}</span>
			<Input
				type="date"
				value={draft ?? value}
				onChange={(event) => handleChange(event.target.value)}
				onBlur={() => setDraft(null)}
				aria-invalid={shownError ? true : undefined}
				aria-describedby={shownError ? errorId : undefined}
				min={min}
				max={max}
				className="cursor-pointer dark:scheme-dark"
			/>
			{shownError ? (
				<p id={errorId} role="alert" className="body-sm text-error">
					{shownError}
				</p>
			) : null}
		</label>
	)
}
