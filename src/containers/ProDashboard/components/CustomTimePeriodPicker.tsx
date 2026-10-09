import * as Ariakit from '@ariakit/react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useState } from 'react'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { SegmentedControl } from '~/ui/SegmentedControl'
import type { CustomTimePeriod } from '../dashboardTypes'
import { absoluteTimePeriod } from '../timePeriod'

// Picked days are UTC calendar days, like the daily points they filter.
dayjs.extend(utc)

const CUSTOM_PERIOD_MODE_OPTIONS = [
	{ value: 'relative' as const, label: 'Relative' },
	{ value: 'absolute' as const, label: 'Absolute' }
]

interface CustomTimePeriodPickerProps {
	isActive: boolean
	customPeriod: CustomTimePeriod | null
	onApply: (period: CustomTimePeriod) => void
	onClear: () => void
	disabled?: boolean
}

function formatCompactLabel(customPeriod: CustomTimePeriod | null): string {
	if (!customPeriod) return 'Custom'

	if (customPeriod.type === 'relative' && customPeriod.relativeDays) {
		return `${customPeriod.relativeDays}d`
	}

	if (customPeriod.type === 'absolute' && customPeriod.startDate && customPeriod.endDate) {
		const start = dayjs.unix(customPeriod.startDate).utc()
		const end = dayjs.unix(customPeriod.endDate).utc()
		const startYear = start.year()
		const endYear = end.year()
		const currentYear = dayjs.utc().year()

		if (startYear === endYear) {
			if (startYear === currentYear) {
				return `${start.format('MMM')}-${end.format('MMM')}`
			}
			return `${start.format('MMM')}-${end.format('MMM')}'${String(startYear).slice(-2)}`
		}
		return `${start.format('MMM')}'${String(startYear).slice(-2)}-${end.format('MMM')}'${String(endYear).slice(-2)}`
	}

	return 'Custom'
}

export function CustomTimePeriodPicker({
	isActive,
	customPeriod,
	onApply,
	onClear,
	disabled
}: CustomTimePeriodPickerProps) {
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-end' })

	const handleClear = () => {
		onClear()
		popover.hide()
	}

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure
				render={<Button size="md" type="button" variant="toggle" data-active={isActive} />}
				disabled={disabled}
			>
				<span className="flex items-center gap-1">
					{isActive ? formatCompactLabel(customPeriod) : 'Custom'}
					<Icon name="chevron-down" height={14} width={14} />
				</span>
			</Ariakit.PopoverDisclosure>

			<PopoverSurface variant="list" heading="Custom time period" gutter={8} style={{ minWidth: '300px' }}>
				{/* The surface unmounts on hide, so each opening starts its draft from the applied period. */}
				<CustomPeriodForm
					customPeriod={customPeriod}
					onApply={(period) => {
						onApply(period)
						popover.hide()
					}}
					onClear={handleClear}
				/>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}

function CustomPeriodForm({
	customPeriod,
	onApply,
	onClear
}: {
	customPeriod: CustomTimePeriod | null
	onApply: (period: CustomTimePeriod) => void
	onClear: () => void
}) {
	const today = dayjs.utc().format('YYYY-MM-DD')
	const [mode, setMode] = useState<'relative' | 'absolute'>(customPeriod?.type || 'relative')
	const [relativeDays, setRelativeDays] = useState(
		customPeriod?.type === 'relative' && customPeriod.relativeDays ? String(customPeriod.relativeDays) : '45'
	)
	const [startDate, setStartDate] = useState(
		customPeriod?.type === 'absolute' && customPeriod.startDate
			? dayjs.unix(customPeriod.startDate).utc().format('YYYY-MM-DD')
			: dayjs.utc().subtract(90, 'day').format('YYYY-MM-DD')
	)
	const [endDate, setEndDate] = useState(
		customPeriod?.type === 'absolute' && customPeriod.endDate
			? dayjs.unix(customPeriod.endDate).utc().format('YYYY-MM-DD')
			: today
	)
	const [submitted, setSubmitted] = useState(false)

	const days = parseInt(relativeDays, 10)
	const daysError = !relativeDays.trim()
		? 'Enter a number of days.'
		: !(days > 0)
			? 'Enter a number of days greater than 0.'
			: null
	const startError = startDate ? null : 'Enter a start date.'
	// YYYY-MM-DD strings compare in date order.
	const endError = !endDate
		? 'Enter an end date.'
		: endDate > today
			? 'Enter an end date no later than today.'
			: startDate && startDate >= endDate
				? 'Enter an end date after the start date.'
				: null

	const handleApply = (e: FormSubmitEvent) => {
		e.preventDefault()
		if (mode === 'relative') {
			if (daysError) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
			onApply({ type: 'relative', relativeDays: days })
		} else {
			if (startError || endError) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
			onApply(absoluteTimePeriod(startDate, endDate))
		}
	}

	return (
		<form noValidate onSubmit={handleApply} className="flex flex-col gap-4 p-4">
			<SegmentedControl<'relative' | 'absolute'>
				variant="field"
				value={mode}
				onValueChange={setMode}
				options={CUSTOM_PERIOD_MODE_OPTIONS}
				label="Custom period mode"
				size="md"
			/>

			{mode === 'relative' ? (
				<Field label="Days ago" error={submitted ? daysError : null}>
					{(control) => (
						<div className="flex items-center gap-2">
							<Input
								{...control}
								type="text"
								inputMode="numeric"
								required
								value={relativeDays}
								onChange={(e) => setRelativeDays(e.target.value)}
								className="flex-1"
								placeholder="Enter days"
							/>
							<span className="body-sm text-secondary">days ago → Now</span>
						</div>
					)}
				</Field>
			) : (
				<div className="flex flex-col gap-3">
					<Field label="From" error={submitted ? startError : null}>
						{(control) => (
							<Input
								{...control}
								type="date"
								required
								value={startDate}
								max={today}
								onChange={(e) => setStartDate(e.target.value)}
								className="cursor-pointer"
							/>
						)}
					</Field>
					<Field label="To" error={submitted ? endError : null}>
						{(control) => (
							<Input
								{...control}
								type="date"
								required
								value={endDate}
								max={today}
								onChange={(e) => setEndDate(e.target.value)}
								className="cursor-pointer"
							/>
						)}
					</Field>
				</div>
			)}

			<div className="flex gap-2 border-t border-subtle pt-2">
				<Button size="md" type="button" onClick={onClear} variant="secondary" className="flex-1">
					Clear
				</Button>
				<Button size="md" type="submit" variant="primary" className="flex-1">
					Apply
				</Button>
			</div>
		</form>
	)
}
