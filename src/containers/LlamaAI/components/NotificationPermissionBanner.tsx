import { useCallback, useState } from 'react'
import {
	requestNotificationPermission,
	useNotificationPermission
} from '~/containers/LlamaAI/hooks/useNotificationPermission'
import { useLlamaAINotifyBannerDismissed } from '~/contexts/LocalStorage'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { ComposerTip } from './ComposerTip'

export function NotificationPermissionBanner() {
	const permission = useNotificationPermission()
	const [dismissed, markDismissed] = useLlamaAINotifyBannerDismissed()
	const [isRequesting, setIsRequesting] = useState(false)

	const handleEnable = useCallback(() => {
		if (typeof Notification === 'undefined') return
		trackUmamiEvent('llamaai-notify-banner-enable')
		setIsRequesting(true)
		void requestNotificationPermission(markDismissed).finally(() => setIsRequesting(false))
	}, [markDismissed])

	const handleDismiss = useCallback(() => {
		trackUmamiEvent('llamaai-notify-banner-dismiss')
		markDismissed()
	}, [markDismissed])

	if (permission !== 'default') return null
	if (dismissed) return null

	return (
		<ComposerTip
			message="Want to be notified when LlamaAI responds?"
			// Disabled while the browser asks.
			action={{ label: 'Notify', onClick: handleEnable, disabled: isRequesting }}
			dismissLabel="Dismiss notification prompt"
			onDismiss={handleDismiss}
		/>
	)
}
