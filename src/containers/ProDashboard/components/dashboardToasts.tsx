import type { ReactNode } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'

export const TOAST_DURATION_SHORT = 4000
export const TOAST_DURATION_UNDO = 6000
export const TOAST_DURATION_NOTICE = 8000

export function statusToastOptions(id: string, duration: number) {
	return { id, duration, ariaProps: { role: 'status' as const, 'aria-live': 'polite' as const } }
}

interface ActionToastOptions {
	message: ReactNode
	icon?: ReactNode
	action: { label: string; onClick: () => void; umamiEvent?: string }
	id: string
	duration?: number
}

export function actionToast({ message, icon, action, id, duration = TOAST_DURATION_UNDO }: ActionToastOptions) {
	toast(
		(instance) => (
			<span className="flex items-center gap-3">
				{icon}
				{message}
				<Button
					variant="link"
					{...(action.umamiEvent ? { 'data-umami-event': action.umamiEvent } : {})}
					onClick={() => {
						action.onClick()
						toast.dismiss(instance.id)
					}}
				>
					{action.label}
				</Button>
			</span>
		),
		statusToastOptions(id, duration)
	)
}
