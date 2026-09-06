import { useAuthContext } from '~/auth'
import { Icon } from '~/ui/Icon'
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

interface TabNavigationProps {
	selectedMainTab: MainTabType
	editItem?: DashboardItemConfig | null | undefined
	onTabChange: (tab: MainTabType) => void
	isSqlAllowed?: boolean
}

export function TabNavigation({ selectedMainTab, editItem, onTabChange, isSqlAllowed }: TabNavigationProps) {
	const { hasActiveSubscription } = useAuthContext()

	return (
		<div className="rounded-xl border border-pro-cards-border p-1 shadow-sm">
			<div className="grid grid-cols-6 gap-1">
				{ALL_TABS.map((tab) => {
					const locked = (PRO_ONLY_TABS.has(tab.id) && !hasActiveSubscription) || (tab.id === 'sql' && !isSqlAllowed)
					return (
						<button
							type="button"
							key={tab.id}
							className={`rounded-lg px-3 py-2.5 text-xs font-medium transition-all duration-200 md:text-sm ${
								selectedMainTab === tab.id
									? 'bg-pro-accent text-on-brand shadow-md ring-1 ring-black/10'
									: 'text-pro-text-secondary hover:bg-pro-cards-bg/80 hover:text-pro-text-primary hover:shadow-sm'
							} ${editItem ? 'cursor-not-allowed opacity-50' : ''}`}
							onClick={() => !editItem && onTabChange(tab.id)}
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
						</button>
					)
				})}
			</div>
		</div>
	)
}
