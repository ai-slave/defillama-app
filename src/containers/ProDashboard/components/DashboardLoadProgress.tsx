import { useEffect, useState } from 'react'
import { useDashboardStreamProgress } from '../ProDashboardAPIContext'
import { ProCardNotice } from './ProCardStatus'

const SHOW_DELAY_MS = 400
const HIDE_DELAY_MS = 300
const STREAM_ERROR_VISIBLE_MS = 8000

function isExpectedStreamFailure(error: string) {
	const status = Number(/(\d{3})\s*$/.exec(error)?.[1])
	return status === 401 || status === 403 || status === 404
}

export function DashboardLoadProgress() {
	const { readyCount, totalCount, isStreaming, isDone, error } = useDashboardStreamProgress()
	const [isVisible, setIsVisible] = useState(false)
	const [dismissedError, setDismissedError] = useState<string | null>(null)
	const isActive = isStreaming && !isDone && totalCount > 0
	const hasSettledAllCards = totalCount > 0 && readyCount >= totalCount
	const showStreamError =
		!!error && error !== dismissedError && totalCount > 0 && !hasSettledAllCards && !isExpectedStreamFailure(error)

	useEffect(() => {
		if (isActive) {
			const showTimer = setTimeout(() => setIsVisible(true), SHOW_DELAY_MS)
			return () => clearTimeout(showTimer)
		}
		if (!isVisible) return
		const hideTimer = setTimeout(() => setIsVisible(false), HIDE_DELAY_MS)
		return () => clearTimeout(hideTimer)
	}, [isActive, isVisible])

	useEffect(() => {
		if (!error) return
		const expiryTimer = setTimeout(() => setDismissedError(error), STREAM_ERROR_VISIBLE_MS)
		return () => clearTimeout(expiryTimer)
	}, [error])

	if (showStreamError) {
		return <ProCardNotice tone="warning">Live data stream failed, cards are loading one by one.</ProCardNotice>
	}

	if (!isVisible) return null

	const readyWithinTotal = Math.min(readyCount, totalCount)

	return (
		<div className="flex flex-col gap-1">
			<div
				role="progressbar"
				aria-label="Loading cards"
				aria-valuemin={0}
				aria-valuemax={totalCount}
				aria-valuenow={readyWithinTotal}
				className="h-[2px] w-full overflow-hidden rounded-full bg-surface-elevated-2"
			>
				<div
					className="h-full rounded-full bg-pro-accent transition-[width] duration-500 ease-out"
					style={{ width: `${totalCount > 0 ? (readyWithinTotal / totalCount) * 100 : 0}%` }}
				/>
			</div>
			<p role="status" className="body-sm text-pro-text-tertiary md:sr-only">
				Loading cards… {readyWithinTotal} of {totalCount}
			</p>
		</div>
	)
}
