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
import { Icon } from '~/ui/Icon'
import { Input, inputStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { PopoverSurface } from '~/ui/PopoverSurface'

dayjs.extend(utc)

export const CEX_RANGE_ERROR = 'End time must be more than one hour after start time'

export function getCexDateRangeState(startDate: number | null, endDate: number | null) {
	if (startDate == null && endDate == null) return 'inactive'
	if (startDate == null || endDate == null || startDate >= endDate - 3_600_000) return 'invalid'
	return 'valid'
}

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
							<LoadingSpinner size={12} />
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
					<Ariakit.PopoverDisclosureArrow className="size-3 shrink-0" />
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
	const [rangeError, setRangeError] = useState<string | null>(() =>
		getCexDateRangeState(startDate, endDate) === 'invalid' ? CEX_RANGE_ERROR : null
	)
	const nowSec = useNowSeconds()
	const maxDate = new Date(nowSec * 1000).toISOString().split('T')[0]

	const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newStartDate = e.target.value
		setLocalStartDate(newStartDate)
		setRangeError(null)

		// If new start date is after current end date, reset end date
		if (newStartDate && localEndDate && newStartDate > localEndDate) {
			setLocalEndDate('')
			setLocalEndHour('0')
		}
	}

	const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newEndDate = e.target.value
		setLocalEndDate(newEndDate)
		setRangeError(null)

		// If new end date is before current start date, reset start date
		if (newEndDate && localStartDate && newEndDate < localStartDate) {
			setLocalStartDate('')
			setLocalStartHour('0')
		}
	}

	const handleStartHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setLocalStartHour(e.target.value)
		setRangeError(null)
	}

	const handleEndHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setLocalEndHour(e.target.value)
		setRangeError(null)
	}

	return (
		<div className="mx-auto w-full sm:w-[260px]">
			<form
				onSubmit={(e) => {
					e.preventDefault()
					// Apply is disabled until both dates are set, and the hours come from a fixed 0-23 list.
					const startTimestamp = Date.parse(`${localStartDate}T${localStartHour.padStart(2, '0')}:00:00Z`)
					const endTimestamp = Date.parse(`${localEndDate}T${localEndHour.padStart(2, '0')}:00:00Z`)
					if (getCexDateRangeState(startTimestamp, endTimestamp) !== 'valid') {
						setRangeError(CEX_RANGE_ERROR)
						return
					}
					setRangeError(null)
					onApply({ startDate: startTimestamp, endDate: endTimestamp })
				}}
				onReset={() => {
					setLocalStartDate('')
					setLocalEndDate('')
					setLocalStartHour('0')
					setLocalEndHour('0')
					setRangeError(null)
					onApply(null)
				}}
				className="flex flex-col gap-3 p-3"
			>
				<label className="flex flex-col gap-1">
					<span className="label-sm text-secondary">Start Date</span>
					<Input
						type="date"
						name="startDate"
						className="w-full cursor-pointer dark:scheme-dark"
						value={localStartDate}
						max={maxDate}
						onChange={handleStartDateChange}
						required
					/>
				</label>
				<label className="flex flex-col gap-1">
					<span className="label-sm text-secondary">Start Hour (optional)</span>
					<select
						name="startHour"
						className={`${inputStyles} w-full`}
						value={localStartHour}
						onChange={handleStartHourChange}
					>
						{Array.from({ length: 24 }, (_, i) => (
							<option key={`start-${i}`} value={i}>
								{i.toString().padStart(2, '0')}:00
							</option>
						))}
					</select>
				</label>
				<label className="flex flex-col gap-1">
					<span className="label-sm text-secondary">End Date</span>
					<Input
						type="date"
						name="endDate"
						className="w-full cursor-pointer dark:scheme-dark"
						value={localEndDate}
						max={maxDate}
						onChange={handleEndDateChange}
						required
					/>
				</label>
				<label className="flex flex-col gap-1">
					<span className="label-sm text-secondary">End Hour (optional)</span>
					<select
						name="endHour"
						className={`${inputStyles} w-full`}
						value={localEndHour}
						onChange={handleEndHourChange}
					>
						{Array.from({ length: 24 }, (_, i) => (
							<option key={`end-${i}`} value={i}>
								{i.toString().padStart(2, '0')}:00
							</option>
						))}
					</select>
				</label>
				{rangeError ? (
					<p role="alert" className="flex items-center gap-1.5 body-sm text-error">
						<Icon name="alert-triangle" className="size-3.5 shrink-0" />
						{rangeError}
					</p>
				) : null}
				<div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
					<Button type="reset" variant="secondary" size="md" className="w-full sm:w-auto sm:flex-1">
						Clear
					</Button>
					<Button
						type="submit"
						disabled={!localStartDate || !localEndDate}
						variant="primary"
						size="md"
						className="w-full sm:w-auto sm:flex-1"
					>
						Apply Filter
					</Button>
				</div>
			</form>
		</div>
	)
}
