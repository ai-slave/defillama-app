import * as Ariakit from '@ariakit/react'
import { useAuthContext } from '~/auth'
import { Icon } from '~/ui/Icon'
import { Tab } from '~/ui/Tabs'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type { MainTabType } from './types'

const PRO_ONLY_TABS = new Set<MainTabType>(['llamaai'])
const ALL_TABS: Array<{ id: MainTabType; label: string; subtitle?: string; mobileLabel: string }> = [
	{ id: 'charts', label: 'Charts', subtitle: '', mobileLabel: 'Charts' },
	{ id: 'metric', label: 'Metric', mobileLabel: 'Metric' },
	{ id: 'table', label: 'Table', mobileLabel: 'Table' },
	{ id: 'text', label: 'Text', subtitle: '(Markdown)', mobileLabel: 'Text' },
	{ id: 'llamaai', label: 'LlamaAI', subtitle: '', mobileLabel: 'LlamaAI' },
	{ id: 'sql', label: 'SQL', subtitle: '', mobileLabel: 'SQL' }
]

export const MAIN_TAB_VALUES = ALL_TABS.map((tab) => tab.id)

interface TabNavigationProps {
	editItem?: DashboardItemConfig | null | undefined
	isSqlAllowed?: boolean
}

export function TabNavigation({ editItem, isSqlAllowed }: TabNavigationProps) {
	const { hasActiveSubscription } = useAuthContext()

	return (
		<div className="rounded-xl border border-pro-cards-border p-1 shadow-sm">
			<Ariakit.TabList aria-label="Item type" className="grid grid-cols-3 gap-1 min-[400px]:grid-cols-6">
				{ALL_TABS.map((tab) => {
					const locked = (PRO_ONLY_TABS.has(tab.id) && !hasActiveSubscription) || (tab.id === 'sql' && !isSqlAllowed)
					return (
						<Tab
							value={tab.id}
							key={tab.id}
							className="rounded-lg px-1 py-2.5 text-xs font-medium text-pro-text-secondary transition-all duration-200 hover:bg-pro-cards-bg/80 hover:text-pro-text-primary hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 data-[active=true]:bg-pro-accent data-[active=true]:text-on-brand data-[active=true]:shadow-md data-[active=true]:ring-1 data-[active=true]:ring-black/10 sm:px-3 md:text-sm"
							disabled={!!editItem}
						>
							<span className="lg:hidden">
								{tab.mobileLabel}
								{locked ? <Icon name="file-lock-2" height={10} width={10} className="ml-1 inline" /> : null}
							</span>
							<span className="hidden lg:inline">
								{tab.label}
								{tab.subtitle ? <span className="ml-1 text-xs opacity-70">{tab.subtitle}</span> : null}
								{locked ? <Icon name="file-lock-2" height={10} width={10} className="ml-1 inline opacity-70" /> : null}
							</span>
						</Tab>
					)
				})}
			</Ariakit.TabList>
		</div>
	)
}
