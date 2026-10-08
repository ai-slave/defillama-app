import { useCallback, useState } from 'react'

interface DateRangeValidationOptions {
	/** Shown until the reader picks a date. It may move with the clock, and untouched inputs follow it. */
	defaultStartDate?: string
	defaultEndDate?: string
}

type DateSelection = { startDate: string; endDate: string }

/** Why a picked range cannot load, per field. A missing or future date sits under its own field; a range that ends
    before it starts sits under the end date. Date-only values are UTC calendar days (docs/date-formatting.md), so
    `today` is the UTC day of `useNowSeconds`, and YYYY-MM-DD strings compare in date order. */
export function dateRangeErrors(startDate: string, endDate: string, today: string) {
	return {
		startDate: !startDate
			? 'Choose a start date.'
			: startDate > today
				? 'Choose a start date no later than today.'
				: null,
		endDate: !endDate
			? 'Choose an end date.'
			: endDate > today
				? 'Choose an end date no later than today.'
				: endDate < startDate
					? 'Choose an end date on or after the start date.'
					: null
	}
}

export const useDateRangeValidation = (options?: DateRangeValidationOptions) => {
	// Null until the reader picks a date: a default seeded from the page clock keeps applying after
	// hydration moves that clock to the browser, so cached HTML never pins yesterday's date.
	const [selection, setSelection] = useState<DateSelection | null>(null)
	const defaultStartDate = options?.defaultStartDate ?? ''
	const defaultEndDate = options?.defaultEndDate ?? ''
	const startDate = selection ? selection.startDate : defaultStartDate
	const endDate = selection ? selection.endDate : defaultEndDate

	// Functional updates: both handlers may run in one batch (URL dates apply start and end together),
	// so each reads the other endpoint from the pending selection, never from a stale render.
	const handleStartDateChange = useCallback(
		(value: string) => {
			setSelection((current) => {
				const currentEnd = current ? current.endDate : defaultEndDate
				// The picker cannot show an inverted range, so an end before the new start clears.
				const keepEnd = !(currentEnd && value && currentEnd < value)
				return { startDate: value, endDate: keepEnd ? currentEnd : '' }
			})
		},
		[defaultEndDate]
	)

	const handleEndDateChange = useCallback(
		(value: string) => {
			setSelection((current) => ({ startDate: current ? current.startDate : defaultStartDate, endDate: value }))
		},
		[defaultStartDate]
	)

	return { startDate, endDate, handleStartDateChange, handleEndDateChange }
}
