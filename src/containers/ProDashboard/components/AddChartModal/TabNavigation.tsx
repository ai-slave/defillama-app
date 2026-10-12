import { useAuthContext } from '~/auth'
import { PromoBadge } from '~/ui/PromoBadge'
import { Tab, TabLink, UnderlineTabList } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
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

/** Underline tabs in a dialog, an exception to the Tabs.tsx rule that a dialog's panel tabs are a SegmentedControl: the
    seven card types, with lock badges and wide-screen subtitles, head the whole body of an xl workspace dialog the way
    tabs head a page section, and a segmented control would scroll them. The track runs edge to edge, so the first label
    sits 4px left of the title and content. */
export function TabNavigation({ isSqlAllowed }: { isSqlAllowed: boolean }) {
	const { hasActiveSubscription } = useAuthContext()
	return (
		<UnderlineTabList label="Card type" className="shrink-0">
			{ALL_TABS.map((tab) => {
				const requiresApiPlan = tab.id === 'sql' && !isSqlAllowed
				const requiresPro = PRO_ONLY_TABS.has(tab.id) && !hasActiveSubscription
				const lockLabel = requiresApiPlan ? 'API' : requiresPro ? 'Pro' : null
				const lockTooltip = requiresApiPlan ? 'Requires the API plan' : 'Requires a Pro subscription'
				return (
					<Tab value={tab.id} key={tab.id} render={<TabLink as="button" />}>
						<span className="lg:hidden">{tab.mobileLabel}</span>
						<span className="hidden lg:inline">{tab.label}</span>
						{tab.subtitle ? <span className="hidden text-tertiary lg:inline">{tab.subtitle}</span> : null}
						{lockLabel ? (
							<Tooltip content={lockTooltip}>
								<PromoBadge icon="file-lock-2">{lockLabel}</PromoBadge>
							</Tooltip>
						) : null}
					</Tab>
				)
			})}
		</UnderlineTabList>
	)
}
