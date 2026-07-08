import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { lazy, Suspense, useState } from 'react'
import { Icon } from '~/components/Icon'
import { LoadingSpinner } from '~/components/Loaders'
import { useAuthContext } from '~/containers/Subscription/auth'
import { setSignupSource } from '~/containers/Subscription/signupSource'
import { Button } from '~/ui/Button'
import { Input, inputStyles } from '~/ui/Input'
import { popoverMobileDismissStyles, popoverMobileWrapperClassName, popoverSurfaceStyles } from '~/ui/Popover'
import { toNiceDayMonthAndYear, toNiceDayMonthAndYearAndTime } from '~/utils'

const SubscribeProModal = lazy(() =>
	import('~/components/SubscribeCards/SubscribeProCard').then((m) => ({ default: m.SubscribeProModal }))
)

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

const getTodayString = () => {
	const today = new Date()
	return today.toISOString().split('T')[0]
}

const isAtMidnight = (timestamp: number | null) => {
	if (timestamp == null) return true
	const date = new Date(timestamp)
	return date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0
}

export const DateFilter = ({
	startDate,
	endDate,
	isLoading = false
}: {
	startDate: number | null
	endDate: number | null
	isLoading?: boolean
}) => {
	const router = useRouter()
	const { isAuthenticated, hasActiveSubscription, loaders } = useAuthContext()
	const isSubscribed = !loaders.userLoading && isAuthenticated && hasActiveSubscription
	const [shouldRenderModal, setShouldRenderModal] = useState(false)
	const subscribeModalStore = Ariakit.useDialogStore({
		open: shouldRenderModal,
		setOpen: setShouldRenderModal
	})
	const [localStartDate, setLocalStartDate] = useState(() => formatDateForInput(startDate))
	const [localEndDate, setLocalEndDate] = useState(() => formatDateForInput(endDate))
	const [localStartHour, setLocalStartHour] = useState(() => getHourFromTimestamp(startDate))
	const [localEndHour, setLocalEndHour] = useState(() => getHourFromTimestamp(endDate))
	const maxDate = getTodayString()

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

	const handleStartHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setLocalStartHour(e.target.value)
	}

	const handleEndHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setLocalEndHour(e.target.value)
	}

	const handleReset = () => {
		setLocalStartDate('')
		setLocalEndDate('')
		setLocalStartHour('0')
		setLocalEndHour('0')
		void router.push(
			{
				pathname: '/cexs'
			},
			undefined,
			{
				shallow: true
			}
		)
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
							setShouldRenderModal(true)
						}
					}}
					aria-busy={isLoading}
				>
					{isLoading ? (
						<span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full border border-medium bg-surface shadow-xs">
							<LoadingSpinner size={12} />
							<span className="sr-only">Loading custom range inflows</span>
						</span>
					) : null}
					<span>Custom Range Inflows</span>
					{startDate != null || endDate != null ? (
						<span className="text-link">
							{' '}
							{startDate != null
								? isAtMidnight(startDate)
									? toNiceDayMonthAndYear(startDate / 1000)
									: toNiceDayMonthAndYearAndTime(startDate / 1000)
								: null}{' '}
							-{' '}
							{endDate != null
								? isAtMidnight(endDate)
									? toNiceDayMonthAndYear(endDate / 1000)
									: toNiceDayMonthAndYearAndTime(endDate / 1000)
								: null}
						</span>
					) : null}
					<Ariakit.PopoverDisclosureArrow className="size-3 shrink-0" />
				</Ariakit.PopoverDisclosure>
				<Ariakit.Popover
					unmountOnHide
					hideOnInteractOutside
					gutter={6}
					overflowPadding={16} // distance from the boundary edges
					wrapperProps={{ className: popoverMobileWrapperClassName }}
					className={popoverSurfaceStyles}
					portal
				>
					<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
						<Icon name="x" className="size-5" />
					</Ariakit.PopoverDismiss>

					<div className="mx-auto w-full sm:w-[260px]">
						<form
							onSubmit={(e) => {
								e.preventDefault()
								const form = e.target as HTMLFormElement
								const startDateInput = form.startDate?.value
								const endDateInput = form.endDate?.value
								const startHour = parseInt(form.startHour?.value ?? '0', 10)
								const endHour = parseInt(form.endHour?.value ?? '0', 10)

								// Create timestamps in milliseconds
								const startTimestamp = new Date(
									`${startDateInput}T${startHour.toString().padStart(2, '0')}:00:00Z`
								).getTime()
								const endTimestamp = new Date(`${endDateInput}T${endHour.toString().padStart(2, '0')}:00:00Z`).getTime()

								void router.push(
									{
										pathname: '/cexs',
										query: { startDate: startTimestamp, endDate: endTimestamp }
									},
									undefined,
									{
										shallow: true
									}
								)
							}}
							onReset={handleReset}
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
				</Ariakit.Popover>
			</Ariakit.PopoverProvider>
			{shouldRenderModal ? (
				<Suspense fallback={<></>}>
					<SubscribeProModal dialogStore={subscribeModalStore} />
				</Suspense>
			) : null}
		</>
	)
}
