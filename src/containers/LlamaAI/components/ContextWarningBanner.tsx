import type { ContextWarningPayload } from '~/containers/LlamaAI/fetchAgenticResponse'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { ComposerTray } from './ComposerTray'

interface ContextWarningBannerProps {
	warning: ContextWarningPayload
	onStartNewChat: () => void
	onDismiss: () => void
}

export function ContextWarningBanner({ warning, onStartNewChat, onDismiss }: ContextWarningBannerProps) {
	const handleStartNewChat = () => {
		trackUmamiEvent('llamaai-context-warning-action', {
			action: 'start-new-chat',
			reason: warning.reason,
			kind: warning.kind
		})
		onStartNewChat()
	}

	const handleDismiss = () => {
		trackUmamiEvent('llamaai-context-warning-action', {
			action: 'dismiss',
			reason: warning.reason,
			kind: warning.kind
		})
		onDismiss()
	}

	return (
		<ComposerTray
			tone="warning"
			actions={
				<>
					<Button type="button" size="sm" onClick={handleStartNewChat}>
						Start new chat
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						square
						onClick={handleDismiss}
						aria-label="Dismiss long-thread warning"
					>
						<Icon name="x" height={14} width={14} />
					</Button>
				</>
			}
		>
			{warning.message}
		</ComposerTray>
	)
}
