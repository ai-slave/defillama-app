import * as Ariakit from '@ariakit/react'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { FREE_TIER_MAX_DASHBOARDS } from '../hooks/useFreeTierStatus'

export type PaywallReason = 'dashboard-limit' | 'llamaai' | 'private-dashboard' | 'pro-feature'

interface DashboardPaywallModalProps {
	reason: PaywallReason
	onClose: () => void
}

const REASON_CONFIG: Record<PaywallReason, { title: string; description: string; features: Array<string> }> = {
	'dashboard-limit': {
		title: 'Dashboard limit reached',
		description: `Free accounts can create up to ${FREE_TIER_MAX_DASHBOARDS} dashboard${FREE_TIER_MAX_DASHBOARDS === 1 ? '' : 's'}. Upgrade to Pro for unlimited dashboards and more.`,
		features: [
			'Unlimited dashboards',
			'Private dashboards',
			'LlamaAI charts & generation',
			'Custom columns & Token Usage tables'
		]
	},
	llamaai: {
		title: 'LlamaAI is a Pro feature',
		description: 'Generate and edit dashboards with AI, add saved LlamaAI charts, and more.',
		features: [
			'Generate dashboards with AI',
			'Edit existing dashboards with AI',
			'Add saved LlamaAI charts',
			'Unlimited dashboards'
		]
	},
	'private-dashboard': {
		title: 'Private dashboards require Pro',
		description: 'Free accounts can only create public dashboards. Upgrade to keep your dashboards private.',
		features: [
			'Private dashboards',
			'Unlimited dashboards',
			'LlamaAI charts & generation',
			'Custom columns & Token Usage tables'
		]
	},
	'pro-feature': {
		title: 'Pro feature',
		description: 'This feature requires a Pro subscription. Upgrade to unlock the full dashboard experience.',
		features: [
			'Unlimited dashboards',
			'Private dashboards',
			'LlamaAI charts & generation',
			'Custom columns & Token Usage tables'
		]
	}
}

// Mounted for one opening: the caller renders it while it holds a reason.
export function DashboardPaywallModal({ reason, onClose }: DashboardPaywallModalProps) {
	const config = REASON_CONFIG[reason]

	return (
		<Dialog size="sm" open onClose={onClose} portal unmountOnHide>
			<DialogHeader title={config.title} />
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">{config.description}</Ariakit.DialogDescription>
				<div className="rounded-lg border border-subtle bg-surface-elevated-1 p-3">
					<p className="mb-2 label-sm text-tertiary">Included with Pro</p>
					<ul className="flex flex-col gap-2">
						{config.features.map((feature) => (
							<li key={feature} className="flex items-center gap-2 body-sm text-secondary">
								<Icon name="check" className="size-3.5 shrink-0 text-link" />
								{feature}
							</li>
						))}
					</ul>
				</div>
			</DialogBody>
			<DialogFooter>
				<Button
					as={BasicLink}
					variant="primary"
					size="md"
					href="/subscription"
					data-umami-event="dashboard-paywall-upgrade"
				>
					<Icon name="sparkles" className="size-3.5" />
					Upgrade to Pro
				</Button>
			</DialogFooter>
		</Dialog>
	)
}
