import * as Ariakit from '@ariakit/react'
import { type ReactNode, useCallback, useRef } from 'react'
import { useHorizontalOverflow } from '~/hooks/useHorizontalOverflow'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tab, TabPanel, Tabs } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
import { tw } from '~/ui/tw'
import type { DashboardLayoutTab } from '../dashboardLayout/buildDashboardLayout'
import { proTabStyles } from '../ui/styles'

const scrollButtonClassName = tw`absolute top-1/2 z-10 hidden -translate-y-1/2 md:flex`

export function DashboardTabs({
	tabs,
	activeTabId,
	onChange,
	renderTab,
	id
}: {
	tabs: Array<DashboardLayoutTab>
	activeTabId: string
	onChange: (tabId: string) => void
	renderTab: (tab: DashboardLayoutTab) => ReactNode
	id?: string
}) {
	const values = tabs.map((tab) => tab.section.id)
	const { ref: overflowRef, canScrollLeft, canScrollRight, scrollByPage } = useHorizontalOverflow<HTMLDivElement>(240)
	// Each tab that becomes active centers itself in an overflowing rail. The tab active on mount stays where it
	// renders, so a page load never animates the rail.
	const hasActiveTab = useRef(false)
	const centerActiveTab = useCallback((tab: HTMLButtonElement | null) => {
		if (!tab) return
		if (!hasActiveTab.current) {
			hasActiveTab.current = true
			return
		}
		const list = tab.parentElement!
		const maxScrollLeft = list.scrollWidth - list.clientWidth
		if (maxScrollLeft <= 0) return
		const centered = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2
		list.scrollTo({ left: Math.max(0, Math.min(centered, maxScrollLeft)), behavior: 'smooth' })
	}, [])

	return (
		<Tabs value={activeTabId} onValueChange={onChange} values={values} {...(id === undefined ? {} : { id })}>
			<div className="group/rail relative">
				{canScrollLeft || canScrollRight ? (
					<>
						{canScrollLeft ? (
							<div className="pointer-events-none absolute inset-y-0 left-0 z-5 hidden w-10 bg-linear-to-r from-pro-app-bg to-transparent md:block" />
						) : null}
						<Tooltip
							content="Scroll left"
							render={
								<Button
									type="button"
									size="sm"
									square
									variant="overlay"
									aria-label="Scroll tabs left"
									disabled={!canScrollLeft}
									accessibleWhenDisabled
									onClick={() => scrollByPage('left')}
									className={`${scrollButtonClassName} left-0`}
								/>
							}
						>
							<Icon name="chevron-left" height={16} width={16} />
						</Tooltip>
					</>
				) : null}
				<Ariakit.TabList
					ref={overflowRef}
					aria-label="Dashboard sections"
					className="flex scrollbar-none overflow-x-auto border-b border-pro-cards-border"
				>
					{tabs.map((tab) => (
						<Tab
							key={tab.section.id}
							ref={tab.section.id === activeTabId ? centerActiveTab : undefined}
							type="button"
							value={tab.section.id}
							className={proTabStyles}
							data-umami-event="dashboard-tab-switch"
							title={tab.section.description}
						>
							{tab.section.title}
						</Tab>
					))}
				</Ariakit.TabList>
				{canScrollLeft || canScrollRight ? (
					<>
						{canScrollRight ? (
							<div className="pointer-events-none absolute inset-y-0 right-0 z-5 hidden w-10 bg-linear-to-l from-pro-app-bg to-transparent md:block" />
						) : null}
						<Tooltip
							content="Scroll right"
							render={
								<Button
									type="button"
									size="sm"
									square
									variant="overlay"
									aria-label="Scroll tabs right"
									disabled={!canScrollRight}
									accessibleWhenDisabled
									onClick={() => scrollByPage('right')}
									className={`${scrollButtonClassName} right-0`}
								/>
							}
						>
							<Icon name="chevron-right" height={16} width={16} />
						</Tooltip>
					</>
				) : null}
			</div>
			{tabs.map((tab) => (
				<TabPanel
					key={tab.section.id}
					value={tab.section.id}
					unmountOnHide
					className="flex animate-pro-fade-in flex-col gap-2 pt-2 data-leave:hidden"
				>
					{renderTab(tab)}
				</TabPanel>
			))}
		</Tabs>
	)
}
