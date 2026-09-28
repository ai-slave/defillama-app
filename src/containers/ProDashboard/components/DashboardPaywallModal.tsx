import type * as Ariakit from '@ariakit/react'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon, type IIcon } from '~/ui/Icon'
import { FREE_TIER_MAX_DASHBOARDS } from '../hooks/useFreeTierStatus'
import { proPanelStyles } from '../ui'

export type PaywallReason = 'dashboard-limit' | 'llamaai' | 'private-dashboard' | 'pro-feature'

interface DashboardPaywallModalProps {
	dialogStore: Ariakit.DialogStore
	reason?: PaywallReason
}

const REASON_CONFIG: Record<
	PaywallReason,
	{ icon: IIcon['name']; title: string; description: string; features: Array<string> }
> = {
	'dashboard-limit': {
		icon: 'layout-grid',
		title: 'Dashboard Limit Reached',
		description: `Free accounts can create up to ${FREE_TIER_MAX_DASHBOARDS} dashboard${FREE_TIER_MAX_DASHBOARDS === 1 ? '' : 's'}. Upgrade to Pro for unlimited dashboards and more.`,
		features: [
			'Unlimited dashboards',
			'Private dashboards',
			'LlamaAI charts & generation',
			'Custom columns & Token Usage tables'
		]
	},
	llamaai: {
		icon: 'sparkles',
		title: 'LlamaAI is a Pro Feature',
		description: 'Generate and edit dashboards with AI, add saved LlamaAI charts, and more.',
		features: [
			'Generate dashboards with AI',
			'Edit existing dashboards with AI',
			'Add saved LlamaAI charts',
			'Unlimited dashboards'
		]
	},
	'private-dashboard': {
		icon: 'key',
		title: 'Private Dashboards Require Pro',
		description: 'Free accounts can only create public dashboards. Upgrade to keep your dashboards private.',
		features: [
			'Private dashboards',
			'Unlimited dashboards',
			'LlamaAI charts & generation',
			'Custom columns & Token Usage tables'
		]
	},
	'pro-feature': {
		icon: 'file-lock-2',
		title: 'Pro Feature',
		description: 'This feature requires a Pro subscription. Upgrade to unlock the full dashboard experience.',
		features: [
			'Unlimited dashboards',
			'Private dashboards',
			'LlamaAI charts & generation',
			'Custom columns & Token Usage tables'
		]
	}
}

export function DashboardPaywallModal({ dialogStore, reason = 'pro-feature' }: DashboardPaywallModalProps) {
	const config = REASON_CONFIG[reason]

	return (
		<Dialog size="sm" scope="pro" store={dialogStore} portal unmountOnHide>
			<DialogHeader title={config.title} />
			<DialogBody>
				<div className="flex flex-col items-center gap-4 text-center">
					<div className="flex size-14 items-center justify-center rounded-full bg-sub-purple/15">
						<Icon name={config.icon} height={28} width={28} className="text-sub-purple" />
					</div>
					<p className="body-sm text-secondary">{config.description}</p>
				</div>
				<div className={proPanelStyles}>
					<p className="mb-2.5 label-sm text-tertiary">Included with Pro</p>
					<ul className="space-y-2">
						{config.features.map((feature) => (
							<li key={feature} className="flex items-center gap-2.5 body-sm text-secondary">
								<Icon name="check" height={14} width={14} className="shrink-0 text-sub-purple" />
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
					<Icon name="sparkles" height={14} width={14} />
					Upgrade to Pro
				</Button>
			</DialogFooter>
		</Dialog>
	)
}
