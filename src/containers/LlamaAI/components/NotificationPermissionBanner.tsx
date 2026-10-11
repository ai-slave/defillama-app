import { useCallback, useState } from 'react'
import {
	requestNotificationPermission,
	useNotificationPermission
} from '~/containers/LlamaAI/hooks/useNotificationPermission'
import { useLlamaAINotifyBannerDismissed } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { focusComposerOnLeave } from './ComposerTray'

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
		<div
			ref={focusComposerOnLeave}
			className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-subtle bg-surface px-3.5 py-2.5"
		>
			{/* Below 16rem the sentence takes the whole first line and the buttons wrap under it. */}
			<p className="m-0 grow basis-64 body-sm text-secondary">Want to be notified when LlamaAI responds?</p>
			{/* Disabled while the browser asks; accessibleWhenDisabled keeps focus on Notify and swallows a second press. */}
			<Button variant="primary" size="md" onClick={handleEnable} disabled={isRequesting} accessibleWhenDisabled>
				Notify
			</Button>
			<Tooltip
				content="Dismiss"
				render={
					<Button
						type="button"
						variant="ghost"
						size="md"
						square
						onClick={handleDismiss}
						aria-label="Dismiss notification prompt"
					/>
				}
			>
				<Icon name="x" className="size-4" />
			</Tooltip>
		</div>
	)
}
