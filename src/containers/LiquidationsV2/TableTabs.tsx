import { TabLink } from '~/ui/Tab'

type Tab<T extends string> = {
	id: T
	label: string
}

interface LiquidationsTableTabsProps<T extends string> {
	tabs: ReadonlyArray<Tab<T>>
	activeTab: T
	setActiveTab: (id: T) => void
}

export function LiquidationsTableTabs<T extends string>({
	tabs,
	activeTab,
	setActiveTab
}: LiquidationsTableTabsProps<T>) {
	return (
		<div className="flex items-center overflow-x-auto" role="tablist">
			{tabs.map((tab) => (
				<TabLink
					as="button"
					key={tab.id}
					type="button"
					role="tab"
					aria-selected={activeTab === tab.id}
					tabIndex={activeTab === tab.id ? 0 : -1}
					data-active={activeTab === tab.id}
					onClick={() => setActiveTab(tab.id)}
				>
					{tab.label}
				</TabLink>
			))}
		</div>
	)
}
