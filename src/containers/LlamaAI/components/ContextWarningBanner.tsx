import { Icon } from '~/components/Icon'
import type { ContextWarningPayload } from '~/containers/LlamaAI/fetchAgenticResponse'
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
			className="flex items-center gap-3 rounded-lg border border-ai-warning/60 bg-ai-warning-soft px-3.5 py-2.5"
		>
			<Icon name="alert-triangle" height={16} width={16} className="shrink-0 text-ai-warning" />
			<p className="m-0 min-w-0 flex-1 text-[13px] text-ai-warning-strong">{warning.message}</p>
			<button
				type="button"
				onClick={handleStartNewChat}
				className="shrink-0 rounded-md bg-ai-warning px-3 py-1 text-xs font-medium text-ai-on-inverse transition-opacity hover:opacity-90"
			>
				Start new chat
			</button>
			<button
				type="button"
				onClick={handleDismiss}
				aria-label="Dismiss long-thread warning"
				className="flex size-6 shrink-0 items-center justify-center rounded-full text-ai-warning-strong/70 transition-colors hover:bg-ai-warning/10 hover:text-ai-warning-strong"
			>
				<Icon name="x" height={14} width={14} />
			</button>
		</div>
	)
}
