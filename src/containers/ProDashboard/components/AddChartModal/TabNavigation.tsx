import * as Ariakit from '@ariakit/react'
import { useAuthContext } from '~/auth'
import { Icon } from '~/ui/Icon'
import { Tab } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
import { ProBadge, proTabStyles } from '../../ui'
import type { MainTabType } from './types'

const PRO_ONLY_TABS = new Set<MainTabType>(['llamaai', 'custom-data'])
const ALL_TABS: Array<{
	id: MainTabType
	label: string
	subtitle?: string
	mobileLabel: string
	editLabel: string
}> = [
	{ id: 'charts', label: 'Charts', mobileLabel: 'Charts', editLabel: 'Chart' },
	{ id: 'metric', label: 'Metric', mobileLabel: 'Metric', editLabel: 'Metric' },
	{ id: 'table', label: 'Table', mobileLabel: 'Table', editLabel: 'Table' },
	{ id: 'text', label: 'Text', subtitle: '(Markdown)', mobileLabel: 'Text', editLabel: 'Text' },
	{ id: 'llamaai', label: 'LlamaAI', mobileLabel: 'LlamaAI', editLabel: 'LlamaAI chart' },
	{ id: 'custom-data', label: 'Custom data', mobileLabel: 'Data', editLabel: 'Custom data' },
	{ id: 'sql', label: 'SQL', mobileLabel: 'SQL', editLabel: 'SQL' }
]

export const MAIN_TAB_VALUES = ALL_TABS.map((tab) => tab.id)

export function getMainTabEditLabel(tab: MainTabType): string {
	return ALL_TABS.find((entry) => entry.id === tab)!.editLabel
}

export function TabNavigation({ isSqlAllowed }: { isSqlAllowed: boolean }) {
	const { hasActiveSubscription } = useAuthContext()
	return (
		<Ariakit.TabList
			aria-label="Card type"
			className="flex scrollbar-none shrink-0 overflow-x-auto border-b border-subtle px-4"
		>
			{ALL_TABS.map((tab) => {
				const requiresApiPlan = tab.id === 'sql' && !isSqlAllowed
				const requiresPro = PRO_ONLY_TABS.has(tab.id) && !hasActiveSubscription
				const lockLabel = requiresApiPlan ? 'API' : requiresPro ? 'Pro' : null
				const lockTooltip = requiresApiPlan ? 'Requires the API plan' : 'Requires a Pro subscription'
				return (
					<Tab value={tab.id} key={tab.id} className={proTabStyles}>
						<span className="flex items-center justify-center gap-1.5">
							<span className="lg:hidden">{tab.mobileLabel}</span>
							<span className="hidden lg:inline">{tab.label}</span>
							{tab.subtitle ? <span className="hidden text-tertiary lg:inline">{tab.subtitle}</span> : null}
							{lockLabel ? (
								<Tooltip content={lockTooltip}>
									<ProBadge tone="premium" icon={<Icon name="file-lock-2" height={12} width={12} />}>
										{lockLabel}
									</ProBadge>
								</Tooltip>
							) : null}
						</span>
					</Tab>
				)
			})}
		</Ariakit.TabList>
	)
}
