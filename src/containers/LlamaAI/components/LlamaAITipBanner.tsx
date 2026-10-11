import Router from 'next/router'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'
import { useActiveTip } from '~/containers/LlamaAI/hooks/useLlamaAITip'
import { isSettingsTabId } from '~/containers/LlamaAI/utils/settingsIntent'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { ComposerTip } from './ComposerTip'

export function LlamaAITipBanner() {
	const { tip, markSeen, dismissTip, clickTip } = useActiveTip()
	const actions = useTipActions()
	if (!tip) return null

	const onPrimary = () => {
		if (tip.cta.kind === 'none') return
		if (tip.cta.kind === 'link') {
			void clickTip(tip, 'link')
			if (tip.cta.external) window.open(tip.cta.href, '_blank', 'noopener,noreferrer')
			else void Router.push(tip.cta.href)
			return
		}
		void clickTip(tip, tip.cta.action)
		runAction(
			tip.cta.action,
			actions,
			tip.cta.kind === 'action' ? tip.cta.prompt : undefined,
			tip.cta.kind === 'action' ? tip.cta.payload : undefined
		)
	}

	return (
		<ComposerTip
			message={tip.title}
			action={tip.cta.kind === 'none' ? undefined : { label: tip.cta.label, onClick: onPrimary }}
			dismissLabel="Dismiss tip"
			onDismiss={() => dismissTip(tip)}
			// markSeen sends the impression once per tip.
			onShow={() => markSeen(tip)}
		/>
	)
}

function runAction(
	action: string,
	actions: ReturnType<typeof useTipActions>,
	prompt?: string,
	payload?: Record<string, unknown>
) {
	switch (action) {
		case 'open-settings': {
			const tab = isSettingsTabId(payload?.tab) ? payload.tab : undefined
			actions.openSettingsModal?.(tab)
			break
		}
		case 'open-alerts':
			trackUmamiEvent('llamaai-alerts-open', { source: 'tip' })
			actions.openAlertsModal?.()
			break
		case 'open-research-mode':
			actions.toggleResearchMode?.()
			break
		case 'submit-prompt':
			if (prompt) actions.submitPrompt?.(prompt)
			break
		default:
			console.warn('Unknown tip action', action)
	}
}
