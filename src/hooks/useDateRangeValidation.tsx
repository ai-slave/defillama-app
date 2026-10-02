import { useCallback, useState } from 'react'

interface DateRangeValidationOptions {
	/** Shown until the reader picks a date. It may move with the clock, and untouched inputs follow it. */
	defaultStartDate?: string
	defaultEndDate?: string
	allowFutureDates?: boolean
}

type DateSelection = { startDate: string; endDate: string }

export const useDateRangeValidation = (options?: DateRangeValidationOptions) => {
	// Null until the reader picks a date: a default seeded from the page clock keeps applying after
	// hydration moves that clock to the browser, so cached HTML never pins yesterday's date.
	const [selection, setSelection] = useState<DateSelection | null>(null)
	const [dateError, setDateError] = useState('')
	const defaultStartDate = options?.defaultStartDate ?? ''
	const defaultEndDate = options?.defaultEndDate ?? ''
	const startDate = selection ? selection.startDate : defaultStartDate
	const endDate = selection ? selection.endDate : defaultEndDate

	// Functional updates: both handlers may run in one batch (URL dates apply start and end together),
	// so each reads the other endpoint from the pending selection, never from a stale render.
	const handleStartDateChange = useCallback(
		(value: string) => {
			setDateError('')
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
			setDateError('')
			setSelection((current) => ({ startDate: current ? current.startDate : defaultStartDate, endDate: value }))
		},
		[defaultStartDate]
	)

	const validateDateRange = (startDateValue: string, endDateValue: string): boolean => {
		if (!startDateValue || !endDateValue) {
			const errorMsg = 'Both start and end dates are required'
			setDateError(errorMsg)
			return false
		}

		// Date-only values are UTC calendar days (docs/date-formatting.md), like the pages' defaults and the inputs' max,
		// so today is the UTC day too; YYYY-MM-DD strings compare in date order.
		const today = new Date().toISOString().slice(0, 10)

		if (endDateValue < startDateValue) {
			const errorMsg = 'End date cannot be before start date'
			setDateError(errorMsg)
			return false
		}

		if (!options?.allowFutureDates) {
			if (startDateValue > today) {
				const errorMsg = 'Start date cannot be in the future'
				setDateError(errorMsg)
				return false
			}

			if (endDateValue > today) {
				const errorMsg = 'End date cannot be in the future'
				setDateError(errorMsg)
				return false
			}
		}

		setDateError('')
		return true
	}

	const reset = () => {
		setSelection({ startDate: '', endDate: '' })
		setDateError('')
	}

	return {
		startDate,
		endDate,
		dateError,
		handleStartDateChange,
		handleEndDateChange,
		validateDateRange,
		reset
	}
}
