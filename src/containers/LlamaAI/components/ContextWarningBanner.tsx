import type { ContextWarningPayload } from '~/containers/LlamaAI/fetchAgenticResponse'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'

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
		<div
			role="status"
			className="flex items-center gap-3 rounded-lg border border-warning/60 bg-warning/10 px-3.5 py-2.5"
		>
			<Icon name="alert-triangle" height={16} width={16} className="shrink-0 text-warning" />
			<p className="m-0 min-w-0 flex-1 text-[13px] text-warning">{warning.message}</p>
			<button
				type="button"
				onClick={handleStartNewChat}
				className="shrink-0 rounded-md bg-warning px-3 py-1 text-xs font-medium text-on-brand not-disabled:not-aria-disabled:hover:opacity-90"
			>
				Start new chat
			</button>
			<Button
				type="button"
				variant="ghost"
				size="md"
				square
				onClick={handleDismiss}
				aria-label="Dismiss long-thread warning"
			>
				<Icon name="x" height={16} width={16} />
			</Button>
		</div>
	)
}
