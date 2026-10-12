import type { ReactNode } from 'react'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tabs, TabPanel } from '~/ui/Tabs'

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
				<div className="z-10 col-start-1 row-start-1 min-w-0 self-start px-2 pt-2 sm:pb-2">
					<SegmentedControl
						semantics="tabs"
						label="Liquidations table view"
						options={tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
						variant="default"
						size="md"
					/>
				</div>
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
