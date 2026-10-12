import * as Ariakit from '@ariakit/react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'
import { DisclosureArrow } from '~/ui/ComboboxSelectTrigger'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { Select } from '~/ui/Select'
import { BusyGlyph } from '~/ui/Status'

dayjs.extend(utc)

export const CEX_RANGE_ERROR = 'End time must be more than one hour after start time'

export function getCexDateRangeState(startDate: number | null, endDate: number | null) {
	if (startDate == null && endDate == null) return 'inactive'
	if (startDate == null || endDate == null || startDate >= endDate - 3_600_000) return 'invalid'
	return 'valid'
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
	key: i.toString(),
	name: `${i.toString().padStart(2, '0')}:00`
}))

const formatDateForInput = (timestamp: number | null) => {
	if (timestamp == null) return ''
	const date = new Date(timestamp)
	return date.toISOString().split('T')[0]
}

const getHourFromTimestamp = (timestamp: number | null) => {
	if (timestamp == null) return '0'
	const date = new Date(timestamp)
	return date.getUTCHours().toString()
}

function formatCexRangePoint(timestampMs: number, includeTime: boolean) {
	return dayjs.utc(timestampMs).format(includeTime ? 'D MMM, YYYY HH:mm' : 'D MMM, YYYY')
}

const isAtMidnight = (timestamp: number | null) => {
	if (timestamp == null) return true
	const date = new Date(timestamp)
	return date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0
}

/** Why a typed custom range cannot apply, per field. Days are YYYY-MM-DD UTC strings and `today` is the UTC day. The
    inputs' max only shapes the calendar (the form is noValidate), so a typed future day is refused here. */
export function cexCustomRangeErrors(
	startDay: string,
	endDay: string,
	startTimestamp: number,
	endTimestamp: number,
	today: string
) {
	return {
		startError: !startDay
			? 'Choose a start date.'
			: startDay > today
				? 'Choose a start date no later than today.'
				: null,
		endError: !endDay ? 'Choose an end date.' : endDay > today ? 'Choose an end date no later than today.' : null,
		rangeError:
			startDay && endDay && getCexDateRangeState(startTimestamp, endTimestamp) !== 'valid'
				? 'Choose an end more than one hour after the start.'
				: null
	}
}

export function DateFilter({
	startDate,
	endDate,
	isLoading = false
}: {
	startDate: number | null
	endDate: number | null
	isLoading?: boolean
}) {
	const router = useRouter()
	const { isAuthenticated, hasActiveSubscription, loaders } = useAuthContext()
	const isSubscribed = !loaders.userLoading && isAuthenticated && hasActiveSubscription
	const subscribeModalStore = Ariakit.useDialogStore()
	const appliedRangeState = getCexDateRangeState(startDate, endDate)

	const applyRange = (query: { startDate: number; endDate: number } | null) => {
		void router.push(query ? { pathname: router.pathname, query } : { pathname: router.pathname }, undefined, {
			shallow: true
		})
	}

	return (
		<>
			<Ariakit.PopoverProvider>
				<Ariakit.PopoverDisclosure
					render={<Button size="md" className="relative" />}
					onClick={(e) => {
						if (!isSubscribed) {
							e.preventDefault()
							setSignupSource('cex-inflows')
							subscribeModalStore.show()
						}
					}}
					aria-busy={isLoading}
				>
					{isLoading ? (
						<span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full border border-medium bg-surface shadow-raised">
							<BusyGlyph decorative size={12} />
							<span className="sr-only">Loading custom range inflows</span>
						</span>
					) : null}
					{appliedRangeState === 'invalid' ? (
						<span className="text-warning" title={CEX_RANGE_ERROR}>
							<Icon name="alert-triangle" className="size-3.5" aria-hidden="true" />
							<span className="sr-only">{CEX_RANGE_ERROR}.</span>
						</span>
					) : null}
					<span>Custom Range Inflows</span>
					{startDate != null || endDate != null ? (
						<span className="text-link">
							{' '}
							{startDate != null
								? isAtMidnight(startDate)
									? formatCexRangePoint(startDate, false)
									: formatCexRangePoint(startDate, true)
								: null}{' '}
							-{' '}
							{endDate != null
								? isAtMidnight(endDate)
									? formatCexRangePoint(endDate, false)
									: formatCexRangePoint(endDate, true)
								: null}
						</span>
					) : null}
					<DisclosureArrow />
				</Ariakit.PopoverDisclosure>
				<PopoverSurface
					variant="list"
					heading="Custom range"
					overflowPadding={16} // distance from the boundary edges
				>
					{/* Mounts with each opening, so the fields start from the applied range, also after back or forward. */}
					<CustomRangeForm startDate={startDate} endDate={endDate} onApply={applyRange} />
				</PopoverSurface>
			</Ariakit.PopoverProvider>
			<LazySubscribeProModal dialogStore={subscribeModalStore} />
		</>
	)
}

function CustomRangeForm({
	startDate,
	endDate,
	onApply
}: {
	startDate: number | null
	endDate: number | null
	onApply: (range: { startDate: number; endDate: number } | null) => void
}) {
	const [localStartDate, setLocalStartDate] = useState(() => formatDateForInput(startDate))
	const [localEndDate, setLocalEndDate] = useState(() => formatDateForInput(endDate))
	const [localStartHour, setLocalStartHour] = useState(() => getHourFromTimestamp(startDate))
	const [localEndHour, setLocalEndHour] = useState(() => getHourFromTimestamp(endDate))
	// A range applied from the URL that cannot load counts as submitted, so the form opens saying what to fix.
	const [submitted, setSubmitted] = useState(() => getCexDateRangeState(startDate, endDate) === 'invalid')
	const nowSec = useNowSeconds()
	const maxDate = new Date(nowSec * 1000).toISOString().split('T')[0]

	// The hours come from a fixed 0-23 list.
	const startTimestamp = Date.parse(`${localStartDate}T${localStartHour.padStart(2, '0')}:00:00Z`)
	const endTimestamp = Date.parse(`${localEndDate}T${localEndHour.padStart(2, '0')}:00:00Z`)
	const { startError, endError, rangeError } = cexCustomRangeErrors(
		localStartDate,
		localEndDate,
		startTimestamp,
		endTimestamp,
		maxDate
	)

	const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newStartDate = e.target.value
		setLocalStartDate(newStartDate)

		// If new start date is after current end date, reset end date
		if (newStartDate && localEndDate && newStartDate > localEndDate) {
			setLocalEndDate('')
			setLocalEndHour('0')
		}
	}

	const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newEndDate = e.target.value
		setLocalEndDate(newEndDate)

		// If new end date is before current start date, reset start date
		if (newEndDate && localStartDate && newEndDate < localStartDate) {
			setLocalStartDate('')
			setLocalStartHour('0')
		}
	}

	return (
		<div className="mx-auto w-full sm:w-[260px]">
			<form
				noValidate
				onSubmit={(e) => {
					e.preventDefault()
					if (startError || endError || rangeError) {
						return showFieldErrors(e.currentTarget, () => setSubmitted(true))
					}
					onApply({ startDate: startTimestamp, endDate: endTimestamp })
				}}
				onReset={() => {
					setLocalStartDate('')
					setLocalEndDate('')
					setLocalStartHour('0')
					setLocalEndHour('0')
					setSubmitted(false)
					onApply(null)
				}}
				className="flex flex-col gap-3 p-3"
			>
				<Field label="Start Date" error={submitted ? startError : null}>
					{(control) => (
						<Input
							{...control}
							type="date"
							name="startDate"
							className="w-full cursor-pointer"
							value={localStartDate}
							max={maxDate}
							onChange={handleStartDateChange}
							required
						/>
					)}
				</Field>
				<Field label="Start Hour (optional)">
					{(control) => (
						<Select
							heading="Start hour"
							allValues={HOUR_OPTIONS}
							selectedValues={localStartHour}
							setSelectedValues={setLocalStartHour}
							label={HOUR_OPTIONS[Number(localStartHour)].name}
							labelType="none"
							variant="input"
							size="md"
							className="w-full"
							// Select names its trigger with an aria-label, which would hide the Field's label.
							triggerProps={{ ...control }}
						/>
					)}
				</Field>
				<Field label="End Date" error={submitted ? endError : null}>
					{(control) => (
						<Input
							{...control}
							type="date"
							name="endDate"
							className="w-full cursor-pointer"
							value={localEndDate}
							max={maxDate}
							onChange={handleEndDateChange}
							required
						/>
					)}
				</Field>
				<Field label="End Hour (optional)" error={submitted ? rangeError : null}>
					{(control) => (
						<Select
							heading="End hour"
							allValues={HOUR_OPTIONS}
							selectedValues={localEndHour}
							setSelectedValues={setLocalEndHour}
							label={HOUR_OPTIONS[Number(localEndHour)].name}
							labelType="none"
							variant="input"
							size="md"
							className="w-full"
							// Select names its trigger with an aria-label, which would hide the Field's label.
							triggerProps={{ ...control }}
						/>
					)}
				</Field>
				<div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
					<Button type="reset" variant="secondary" size="md" className="w-full sm:w-auto sm:flex-1">
						Clear
					</Button>
					<Button type="submit" variant="primary" size="md" className="w-full sm:w-auto sm:flex-1">
						Apply filter
					</Button>
				</div>
			</form>
		</div>
	)
}
