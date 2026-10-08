import * as Ariakit from '@ariakit/react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useState } from 'react'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
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
	const [mode, setMode] = useState<'relative' | 'absolute'>(customPeriod?.type || 'relative')

	const today = dayjs.utc().format('YYYY-MM-DD')

	const defaultRelativeDays =
		customPeriod?.type === 'relative' && customPeriod.relativeDays ? String(customPeriod.relativeDays) : '45'
	const defaultStartDate =
		customPeriod?.type === 'absolute' && customPeriod.startDate
			? dayjs.unix(customPeriod.startDate).utc().format('YYYY-MM-DD')
			: dayjs.utc().subtract(90, 'day').format('YYYY-MM-DD')
	const defaultEndDate =
		customPeriod?.type === 'absolute' && customPeriod.endDate
			? dayjs.unix(customPeriod.endDate).utc().format('YYYY-MM-DD')
			: today

	const handleApply = (e: FormSubmitEvent) => {
		e.preventDefault()
		const form = e.currentTarget

		if (mode === 'relative') {
			const input = form.elements.namedItem('relativeDays') as HTMLInputElement | null
			if (!input) return
			input.setCustomValidity('')
			const days = parseInt(input.value, 10)
			if (!days || days <= 0) {
				input.setCustomValidity('Please enter a valid number greater than 0')
				input.reportValidity()
				return
			}
			onApply({ type: 'relative', relativeDays: days })
			popover.hide()
		} else {
			const startInput = form.elements.namedItem('startDate') as HTMLInputElement | null
			const endInput = form.elements.namedItem('endDate') as HTMLInputElement | null
			if (!startInput || !endInput) return
			startInput.setCustomValidity('')
			endInput.setCustomValidity('')
			// YYYY-MM-DD strings compare in date order.
			if (!startInput.value || !endInput.value || startInput.value >= endInput.value) {
				endInput.setCustomValidity('End date must be after start date')
				endInput.reportValidity()
				return
			}
			onApply(absoluteTimePeriod(startInput.value, endInput.value))
			popover.hide()
		}
	}

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
				<form onSubmit={handleApply} className="flex flex-col gap-4 p-4">
					<SegmentedControl<'relative' | 'absolute'>
						variant="field"
						value={mode}
						onValueChange={setMode}
						options={CUSTOM_PERIOD_MODE_OPTIONS}
						label="Custom period mode"
						size="md"
					/>

					{mode === 'relative' ? (
						<div className="flex flex-col gap-2">
							<label htmlFor="custom-period-relative-days" className="label-sm text-secondary">
								Days ago
							</label>
							<div className="flex items-center gap-2">
								<Input
									id="custom-period-relative-days"
									name="relativeDays"
									type="text"
									inputMode="numeric"
									defaultValue={defaultRelativeDays}
									onInput={(e) => e.currentTarget.setCustomValidity('')}
									className="flex-1"
									placeholder="Enter days"
								/>
								<span className="body-sm text-secondary">days ago → Now</span>
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-3">
							<div className="flex flex-col gap-2">
								<label htmlFor="custom-period-start-date" className="label-sm text-secondary">
									From
								</label>
								<Input
									id="custom-period-start-date"
									name="startDate"
									type="date"
									defaultValue={defaultStartDate}
									max={today}
									onInput={(e) => e.currentTarget.setCustomValidity('')}
									className="cursor-pointer dark:scheme-dark"
								/>
							</div>
							<div className="flex flex-col gap-2">
								<label htmlFor="custom-period-end-date" className="label-sm text-secondary">
									To
								</label>
								<Input
									id="custom-period-end-date"
									name="endDate"
									type="date"
									defaultValue={defaultEndDate}
									max={today}
									onInput={(e) => e.currentTarget.setCustomValidity('')}
									className="cursor-pointer dark:scheme-dark"
								/>
							</div>
						</div>
					)}

					<div className="flex gap-2 border-t border-subtle pt-2">
						<Button size="md" type="button" onClick={handleClear} variant="secondary" className="flex-1">
							Clear
						</Button>
						<Button size="md" type="submit" variant="primary" className="flex-1">
							Apply
						</Button>
					</div>
				</form>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}
