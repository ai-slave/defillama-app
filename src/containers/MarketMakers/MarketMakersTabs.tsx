import type { ComponentType } from 'react'
import { useState } from 'react'
import { BasicLink } from '~/components/Link'
import { Card } from '~/ui/Card'
import { tabTrackStyles, TabLink } from '~/ui/Tab'
import { DepthIcon, DocumentationIcon, KpiIcon, PerformanceIndexIcon, SpreadIcon, VolumeIcon } from './TabIcons'

type TabIcon = ComponentType<{ className?: string }>

export const MARKET_MAKER_TABS: { label: string; to: string; Icon: TabIcon }[] = [
	{ label: 'Performance Index', to: '/market-makers', Icon: PerformanceIndexIcon },
	{ label: 'Depth', to: '/market-makers/depth', Icon: DepthIcon },
	{ label: 'Volume', to: '/market-makers/volume', Icon: VolumeIcon },
	{ label: 'Spread', to: '/market-makers/spread', Icon: SpreadIcon },
	{ label: 'KPI Adherence', to: '/market-makers/kpi', Icon: KpiIcon },
	{ label: 'Documentation', to: '/market-makers/documentation', Icon: DocumentationIcon }
]

export function MarketMakersTabs({ active }: { active: string }) {
	const [open, setOpen] = useState(false)
	const activeTab = MARKET_MAKER_TABS.find((tab) => tab.label === active)

	return (
		<>
			<Card padding="none" border="subtle" className="overflow-hidden min-[713px]:hidden">
				<button
					type="button"
					onClick={() => setOpen((value) => !value)}
					aria-expanded={open}
					className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 label-md text-primary"
				>
					<span className="flex items-center gap-2">
						{activeTab ? <activeTab.Icon /> : null}
						{active}
					</span>
					<span
						className={`label-xs text-tertiary transition-transform duration-300 ease-in-out ${open ? 'rotate-180' : ''}`}
					>
						▼
					</span>
				</button>
				<div
					className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
				>
					<div className="overflow-hidden">
						<div className="flex flex-col gap-1 border-t border-subtle p-1">
							{MARKET_MAKER_TABS.map((tab) => (
								<BasicLink
									key={tab.to}
									href={tab.to}
									data-active={tab.label === active}
									className="flex items-center gap-2 rounded-md px-2.5 py-2 label-md text-primary hover:bg-hover-row data-[active=true]:bg-brand-muted data-[active=true]:text-link"
								>
									<tab.Icon />
									{tab.label}
								</BasicLink>
							))}
						</div>
					</div>
				</div>
			</Card>
			<nav className={`${tabTrackStyles} hidden min-[713px]:flex`}>
				{MARKET_MAKER_TABS.map((tab) => (
					<TabLink
						as={BasicLink}
						key={tab.to}
						href={tab.to}
						data-active={tab.label === active}
						className="flex items-center gap-1.5"
					>
						<tab.Icon className="size-3.5" />
						{tab.label}
					</TabLink>
				))}
			</nav>
		</>
	)
}
