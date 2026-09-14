import * as Ariakit from '@ariakit/react'
import { type ReactNode, useCallback, useEffect, useRef } from 'react'
import { useHorizontalOverflow } from '~/hooks/useHorizontalOverflow'
import { Icon } from '~/ui/Icon'
import { Tab, TabPanel, Tabs } from '~/ui/Tabs'
import { tw } from '~/ui/tw'
import type { DashboardLayoutTab } from '../dashboardLayout/buildDashboardLayout'
import { ProButton } from '../ui'
import { proTabStyles } from '../ui/styles'

const scrollButtonClassName = tw`absolute top-1/2 z-10 hidden -translate-y-1/2 opacity-0 shadow-overlay-sm transition-opacity duration-120 group-hover/rail:opacity-100 focus-visible:opacity-100 md:flex`

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
	const listRef = useRef<HTMLDivElement | null>(null)
	const setListRef = useCallback(
		(node: HTMLDivElement | null) => {
			listRef.current = node
			overflowRef(node)
		},
		[overflowRef]
	)
	const hasScrolledToActiveTab = useRef(false)
	useEffect(() => {
		if (!activeTabId) return
		if (!hasScrolledToActiveTab.current) {
			hasScrolledToActiveTab.current = true
			return
		}
		const list = listRef.current
		const active = list?.querySelector<HTMLElement>('[data-active="true"]')
		if (!list || !active) return
		const maxScrollLeft = list.scrollWidth - list.clientWidth
		if (maxScrollLeft <= 0) return
		const centered = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2
		list.scrollTo?.({ left: Math.max(0, Math.min(centered, maxScrollLeft)), behavior: 'smooth' })
	}, [activeTabId])

	return (
		<Tabs value={activeTabId} onValueChange={onChange} values={values} {...(id === undefined ? {} : { id })}>
			<div className="group/rail relative">
				{canScrollLeft ? (
					<>
						<div className="pointer-events-none absolute inset-y-0 left-0 z-5 hidden w-10 bg-linear-to-r from-pro-app-bg to-transparent md:block" />
						<ProButton
							type="button"
							size="sm"
							square
							variant="secondary"
							aria-label="Scroll tabs left"
							onClick={() => scrollByPage('left')}
							className={`${scrollButtonClassName} left-0`}
						>
							<Icon name="chevron-left" height={16} width={16} />
						</ProButton>
					</>
				) : null}
				<Ariakit.TabList
					ref={setListRef}
					aria-label="Dashboard sections"
					className="flex scrollbar-none overflow-x-auto border-b border-pro-cards-border"
				>
					{tabs.map((tab) => (
						<Tab
							key={tab.section.id}
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
				{canScrollRight ? (
					<>
						<div className="pointer-events-none absolute inset-y-0 right-0 z-5 hidden w-10 bg-linear-to-l from-pro-app-bg to-transparent md:block" />
						<ProButton
							type="button"
							size="sm"
							square
							variant="secondary"
							aria-label="Scroll tabs right"
							onClick={() => scrollByPage('right')}
							className={`${scrollButtonClassName} right-0`}
						>
							<Icon name="chevron-right" height={16} width={16} />
						</ProButton>
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
