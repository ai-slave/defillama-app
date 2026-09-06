import { TabList } from '@ariakit/react'
import { TabLink, tabTrackStyles } from '~/ui/Tab'
import { Tab } from '~/ui/Tabs'

export interface ViewTab<T extends string> {
	id: T
	label: string
}

/** Underline tabs inside a shared Tabs provider with the corresponding panels. */
export function ViewTabs<T extends string>({ tabs, label }: { tabs: ReadonlyArray<ViewTab<T>>; label: string }) {
	return (
		<TabList className={tabTrackStyles} aria-label={label}>
			{tabs.map((tab) => (
				<Tab key={tab.id} value={tab.id} render={<TabLink as="button" type="button" />}>
					{tab.label}
				</Tab>
			))}
		</TabList>
	)
}
