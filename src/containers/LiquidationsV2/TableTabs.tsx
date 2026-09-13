import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { TabLink } from '~/ui/Tab'
import { Tabs, Tab, TabPanel } from '~/ui/Tabs'

type TableTab<T extends string> = { id: T; label: string }

export function LiquidationsTableTabs<T extends string>({
	tabs,
	activeTab,
	setActiveTab,
	resetTableOnChange,
	children
}: {
	tabs: ReadonlyArray<TableTab<T>>
	activeTab: T
	setActiveTab: (id: T) => void
	resetTableOnChange: boolean
	children: ReactNode
}) {
	return (
		<Tabs value={activeTab} onValueChange={setActiveTab} values={tabs.map((tab) => tab.id)}>
			<div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)]">
				<Ariakit.TabList
					aria-label="Liquidations table view"
					className="z-10 col-start-1 row-start-1 flex min-w-0 items-center self-start overflow-x-auto px-2 pt-2 sm:pb-2"
				>
					{tabs.map((tab) => (
						<Tab key={tab.id} value={tab.id} render={<TabLink as="button" />}>
							{tab.label}
						</Tab>
					))}
				</Ariakit.TabList>
				{/* Standalone pages reset table state; token pages keep it across views. */}
				<TabPanel
					key={resetTableOnChange ? activeTab : undefined}
					value={activeTab}
					className="col-span-full col-start-1 row-span-2 row-start-2 grid min-w-0 grid-cols-subgrid grid-rows-subgrid sm:row-start-1"
				>
					{children}
				</TabPanel>
			</div>
		</Tabs>
	)
}

export function LiquidationsTableContent({ toolbar, children }: { toolbar: ReactNode; children: ReactNode }) {
	return (
		<>
			<div className="col-start-1 row-start-1 min-w-0 self-center sm:col-start-2 sm:[&_label]:mr-0 sm:[&_label]:ml-auto">
				{toolbar}
			</div>
			<div className="col-span-full row-start-2 min-w-0">{children}</div>
		</>
	)
}
