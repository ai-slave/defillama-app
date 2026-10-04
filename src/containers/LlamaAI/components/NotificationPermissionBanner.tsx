import { useCallback, useState } from 'react'
import {
	requestNotificationPermission,
	useNotificationPermission
} from '~/containers/LlamaAI/hooks/useNotificationPermission'
import { useLlamaAINotifyBannerDismissed } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { focusComposerOnLeave } from './ComposerTray'

export function NotificationPermissionBanner() {
	const permission = useNotificationPermission()
	const [dismissed, markDismissed] = useLlamaAINotifyBannerDismissed()
	const [isRequesting, setIsRequesting] = useState(false)

	const handleEnable = useCallback(() => {
		if (typeof Notification === 'undefined' || isRequesting) return
		trackUmamiEvent('llamaai-notify-banner-enable')
		setIsRequesting(true)
		void requestNotificationPermission(markDismissed).finally(() => setIsRequesting(false))
	}, [isRequesting, markDismissed])

	const handleDismiss = useCallback(() => {
		trackUmamiEvent('llamaai-notify-banner-dismiss')
		markDismissed()
	}, [markDismissed])

	if (permission !== 'default') return null
	if (dismissed) return null

	return (
		<div
			ref={focusComposerOnLeave}
			className="flex items-center gap-3 rounded-lg border border-subtle bg-surface px-3.5 py-2.5"
		>
			<p className="m-0 min-w-0 flex-1 body-sm text-secondary">Want to be notified when LlamaAI responds?</p>
			<button
				type="button"
				onClick={handleEnable}
				// Focusable while the browser asks, so focus stays on Notify instead of falling to the page.
				aria-disabled={isRequesting || undefined}
				className="shrink-0 rounded-md bg-brand px-3 py-1 text-xs font-medium text-on-brand not-disabled:not-aria-disabled:hover:opacity-90 aria-disabled:cursor-wait aria-disabled:opacity-60"
			>
				Notify
			</button>
			<Button
				type="button"
				variant="ghost"
				size="md"
				square
				onClick={handleDismiss}
				aria-label="Dismiss notification prompt"
			>
				<Icon name="x" height={16} width={16} />
			</Button>
		</div>
	)
}
