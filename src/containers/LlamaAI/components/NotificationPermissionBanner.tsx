import { useCallback, useState } from 'react'
import {
	notifyNotificationPermissionChanged,
	useNotificationPermission
} from '~/containers/LlamaAI/hooks/useNotificationPermission'
import { useLlamaAINotifyBannerDismissed } from '~/contexts/LocalStorage'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'

export function NotificationPermissionBanner() {
	const permission = useNotificationPermission()
	const [dismissed, markDismissed] = useLlamaAINotifyBannerDismissed()
	const [isRequesting, setIsRequesting] = useState(false)

	const handleEnable = useCallback(() => {
		if (typeof Notification === 'undefined' || isRequesting) return
		trackUmamiEvent('llamaai-notify-banner-enable')
		setIsRequesting(true)
		// Some browsers throttle repeated requests and resolve to 'default' without showing a prompt
		// (Chrome quiet UI, users who previously dismissed the system prompt). Persist dismissal on any
		// non-granted result so we stop nagging a user the browser won't let us prompt again anyway.
		Notification.requestPermission()
			.then((next) => {
				notifyNotificationPermissionChanged()
				if (next !== 'granted') markDismissed()
			})
			.catch(() => {
				markDismissed()
			})
			.finally(() => {
				setIsRequesting(false)
			})
	}, [isRequesting, markDismissed])

	const handleDismiss = useCallback(() => {
		trackUmamiEvent('llamaai-notify-banner-dismiss')
		markDismissed()
	}, [markDismissed])

	if (permission !== 'default') return null
	if (dismissed) return null

	return (
		<div className="flex items-center gap-3 rounded-lg border border-ai-line bg-surface px-3.5 py-2.5">
			<p className="m-0 flex-1 truncate text-[13px] text-ai-secondary">Want to be notified when LlamaAI responds?</p>
			<button
				type="button"
				onClick={handleEnable}
				disabled={isRequesting}
				className="shrink-0 rounded-md bg-ai-inverse px-3 py-1 text-xs font-medium text-ai-on-inverse transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
			>
				Notify
			</button>
			<button
				type="button"
				onClick={handleDismiss}
				aria-label="Dismiss notification prompt"
				className="flex size-6 shrink-0 items-center justify-center rounded-full text-ai-muted transition-colors hover:bg-ai-hover hover:text-ai-primary"
			>
				<Icon name="x" height={14} width={14} />
			</button>
		</div>
	)
}
