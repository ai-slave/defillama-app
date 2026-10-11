import { useEffect, useRef, useState } from 'react'
import { Icon } from '~/ui/Icon'
import { Tabs, Tab, TabPanel as RiskTabPanel, TabLink, UnderlineTabList } from '~/ui/Tabs'
import { EASE_OUT_EXPO } from '../primitives/motion'

// Every panel stays in the DOM (inactive ones get `hidden`) so SSR HTML carries all of it
// and in-page anchors resolve; the panel ids ARE the section's public anchors.

export interface RiskTab {
	id: string
	icon: React.ComponentProps<typeof Icon>['name']
	iconFlipY?: boolean // the sprite has no trending-down — a crash points down
	label: string
	count?: number
	content: React.ReactNode
}

function TabPanel({ tab, active }: { tab: RiskTab; active: boolean }) {
	const ref = useRef<HTMLDivElement>(null)
	const mounted = useRef(false)
	// Rise+fade when a panel becomes active — not on first mount, never under reduced motion.
	useEffect(() => {
		if (!mounted.current) {
			mounted.current = true
			return
		}
		const el = ref.current
		if (!active || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		el.animate(
			[
				{ opacity: 0, transform: 'translateY(4px)' },
				{ opacity: 1, transform: 'translateY(0)' }
			],
			{ duration: 220, easing: EASE_OUT_EXPO }
		)
	}, [active])
	return (
		<RiskTabPanel ref={ref} id={tab.id} value={tab.id} className="scroll-mt-24 p-4">
			{tab.content}
		</RiskTabPanel>
	)
}

export function RiskTabs({ tabs, defaultId }: { tabs: Array<RiskTab>; defaultId: string }) {
	const [active, setActive] = useState(defaultId)

	// A hash naming a tab activates it — on load and on every hashchange (deep links, the
	// section nav, ConditionsTree's oracle-config link, back/forward).
	useEffect(() => {
		const ids = new Set(tabs.map((t) => t.id))
		const sync = () => {
			const id = window.location.hash.slice(1)
			if (!ids.has(id)) return
			setActive(id)
			// the native scroll already fired against the then-hidden panel; redo it once shown
			requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
		}
		sync()
		window.addEventListener('hashchange', sync)
		return () => window.removeEventListener('hashchange', sync)
	}, [tabs])

	// replaceState keeps the URL shareable without a scroll jump or firing hashchange.
	const activate = (id: string) => {
		setActive(id)
		window.history.replaceState(null, '', `#${id}`)
	}

	return (
		<Tabs
			id="risk"
			value={active}
			onValueChange={activate}
			values={tabs.map((tab) => tab.id)}
			selectOnMove
			orientation="both"
		>
			<div className="flex flex-col">
				{/* transparent borders on every segment keep sizing stable so the active edge doesn't
			    shift layout */}
				<div className="px-4 pt-4">
					<UnderlineTabList label="Risk detail" className="sm:w-auto sm:max-w-full">
						{tabs.map((t) => {
							const selected = t.id === active
							return (
								<Tab
									value={t.id}
									render={<TabLink as="button" />}
									key={t.id}
									type="button"
									className="inline-flex flex-1 items-center justify-center gap-1.5 sm:flex-initial"
								>
									<Icon name={t.icon} className={`size-4${t.iconFlipY ? ' -scale-y-100' : ''}`} aria-hidden />
									{t.label}
									{t.count != null ? (
										<span className={selected ? 'text-secondary' : 'text-tertiary'}>{t.count}</span>
									) : null}
								</Tab>
							)
						})}
					</UnderlineTabList>
				</div>
				{tabs.map((t) => (
					<TabPanel key={t.id} tab={t} active={t.id === active} />
				))}
			</div>
		</Tabs>
	)
}
