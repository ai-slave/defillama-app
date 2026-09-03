import { TabLink, tabTrackStyles } from '~/ui/Tab'

export interface ViewTab<T extends string> {
	id: T
	label: string
}

export function viewTabIds(idPrefix: string, view: string) {
	return { tabId: `${idPrefix}-tab-${view}`, panelId: `${idPrefix}-panel-${view}` }
}

/** Page-level underline tabs that switch the content panel below them. The panel must carry
    `role="tabpanel"`, `id={panelId}` and `aria-labelledby={tabId}` from {@link viewTabIds}. */
export function ViewTabs<T extends string>({
	tabs,
	activeTab,
	onChange,
	idPrefix,
	label
}: {
	tabs: ReadonlyArray<ViewTab<T>>
	activeTab: T
	onChange: (id: T) => void
	idPrefix: string
	label: string
}) {
	return (
		<div className={tabTrackStyles} role="tablist" aria-label={label}>
			{tabs.map((tab) => {
				const { tabId, panelId } = viewTabIds(idPrefix, tab.id)
				const isActive = tab.id === activeTab
				return (
					<TabLink
						as="button"
						key={tab.id}
						type="button"
						id={tabId}
						role="tab"
						aria-selected={isActive}
						aria-controls={panelId}
						data-active={isActive}
						onClick={() => onChange(tab.id)}
					>
						{tab.label}
					</TabLink>
				)
			})}
		</div>
	)
}
