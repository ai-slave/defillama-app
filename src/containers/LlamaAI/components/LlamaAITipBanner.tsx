import Router from 'next/router'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'
import { useActiveTip } from '~/containers/LlamaAI/hooks/useLlamaAITip'
import { isSettingsTabId } from '~/containers/LlamaAI/utils/settingsIntent'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { focusComposerOnLeave } from './ComposerTray'

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
		// The impression is recorded by the element that shows the tip; markSeen sends it once per tip.
		<div
			ref={(node) => {
				if (node) markSeen(tip)
				return focusComposerOnLeave(node)
			}}
			className="flex items-center gap-3 rounded-lg border border-subtle bg-surface px-3.5 py-2.5"
		>
			<Tooltip
				content={tip.title}
				render={<p />}
				className="m-0 min-w-0 flex-1 truncate text-[13px] text-secondary"
				data-fullwidth
			>
				{tip.title}
			</Tooltip>
			{tip.cta.kind !== 'none' && (
				<Button variant="primary" size="md" onClick={onPrimary}>
					{tip.cta.label}
				</Button>
			)}
			<Tooltip
				content="Dismiss tip"
				render={
					<Button
						type="button"
						variant="ghost"
						size="md"
						square
						onClick={() => dismissTip(tip)}
						aria-label="Dismiss tip"
					/>
				}
			>
				<Icon name="x" height={16} width={16} />
			</Tooltip>
		</div>
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
