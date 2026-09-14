import * as Ariakit from '@ariakit/react'
import dayjs from 'dayjs'
import { useState } from 'react'
import type { FormSubmitEvent } from '~/types/forms'
import { Icon } from '~/ui/Icon'
import { popoverMobileWrapperClassName, popoverSurfaceStyles } from '~/ui/Popover'
import type { CustomTimePeriod } from '../dashboardTypes'
import { ProButton, ProSegmented } from '../ui'

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
		const start = dayjs.unix(customPeriod.startDate)
		const end = dayjs.unix(customPeriod.endDate)
		const startYear = start.year()
		const endYear = end.year()
		const currentYear = dayjs().year()

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

	const today = dayjs().format('YYYY-MM-DD')

	const defaultRelativeDays =
		customPeriod?.type === 'relative' && customPeriod.relativeDays ? String(customPeriod.relativeDays) : '45'
	const defaultStartDate =
		customPeriod?.type === 'absolute' && customPeriod.startDate
			? dayjs.unix(customPeriod.startDate).format('YYYY-MM-DD')
			: dayjs().subtract(90, 'day').format('YYYY-MM-DD')
	const defaultEndDate =
		customPeriod?.type === 'absolute' && customPeriod.endDate
			? dayjs.unix(customPeriod.endDate).format('YYYY-MM-DD')
			: dayjs().format('YYYY-MM-DD')

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
			const start = dayjs(startInput.value)
			const end = dayjs(endInput.value)
			if (!start.isValid() || !end.isValid() || !start.isBefore(end)) {
				endInput.setCustomValidity('End date must be after start date')
				endInput.reportValidity()
				return
			}
			onApply({
				type: 'absolute',
				startDate: start.unix(),
				endDate: end.endOf('day').unix()
			})
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
				render={<ProButton type="button" variant={isActive ? 'primary' : 'secondary'} />}
				disabled={disabled}
			>
				<span className="flex items-center gap-1">
					{isActive ? formatCompactLabel(customPeriod) : 'Custom'}
					<Icon name="chevron-down" height={14} width={14} />
				</span>
			</Ariakit.PopoverDisclosure>

			<Ariakit.Popover
				gutter={8}
				portal
				unmountOnHide
				className={popoverSurfaceStyles}
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				style={{ minWidth: '300px' }}
			>
				<form onSubmit={handleApply} className="flex flex-col gap-4 p-4">
					<ProSegmented<'relative' | 'absolute'>
						value={mode}
						onValueChange={setMode}
						options={CUSTOM_PERIOD_MODE_OPTIONS}
						label="Custom period mode"
						size="sm"
					/>

					{mode === 'relative' ? (
						<div className="flex flex-col gap-2">
							<label htmlFor="custom-period-relative-days" className="text-sm font-medium text-pro-text-label">
								Days ago
							</label>
							<div className="flex items-center gap-2">
								<input
									id="custom-period-relative-days"
									name="relativeDays"
									type="text"
									inputMode="numeric"
									defaultValue={defaultRelativeDays}
									onInput={(e) => e.currentTarget.setCustomValidity('')}
									className="flex-1 rounded-md border border-pro-cards-border bg-surface-elevated-1 px-3 py-2 text-sm focus:ring-1 focus:ring-brand focus:outline-hidden"
									placeholder="Enter days"
								/>
								<span className="text-sm text-pro-text-secondary">days ago → Now</span>
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-3">
							<div className="flex flex-col gap-2">
								<label htmlFor="custom-period-start-date" className="text-sm font-medium text-pro-text-label">
									From
								</label>
								<input
									id="custom-period-start-date"
									name="startDate"
									type="date"
									defaultValue={defaultStartDate}
									max={today}
									onInput={(e) => e.currentTarget.setCustomValidity('')}
									className="rounded-md border border-pro-cards-border bg-surface-elevated-1 px-3 py-2 text-sm focus:ring-1 focus:ring-brand focus:outline-hidden"
								/>
							</div>
							<div className="flex flex-col gap-2">
								<label htmlFor="custom-period-end-date" className="text-sm font-medium text-pro-text-label">
									To
								</label>
								<input
									id="custom-period-end-date"
									name="endDate"
									type="date"
									defaultValue={defaultEndDate}
									max={today}
									onInput={(e) => e.currentTarget.setCustomValidity('')}
									className="rounded-md border border-pro-cards-border bg-surface-elevated-1 px-3 py-2 text-sm focus:ring-1 focus:ring-brand focus:outline-hidden"
								/>
							</div>
						</div>
					)}

					<div className="flex gap-2 border-t border-pro-cards-border pt-2">
						<ProButton type="button" onClick={handleClear} variant="secondary" className="flex-1">
							Clear
						</ProButton>
						<ProButton type="submit" variant="primary" className="flex-1">
							Apply
						</ProButton>
					</div>
				</form>
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}
