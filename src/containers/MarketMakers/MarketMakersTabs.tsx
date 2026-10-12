import { useRouter } from 'next/router'
import { useState } from 'react'
import { BasicLink } from '~/components/Link'
import { Card } from '~/ui/Card'
import { Icon, type IIcon } from '~/ui/Icon'
import { RailItem } from '~/ui/RailItem'
import { TabLink, TabNav } from '~/ui/Tabs'
import { DEFAULT_TIMEFRAME, readTimeframe } from './timeframe'

export const MARKET_MAKER_TABS: Array<{ label: string; to: string; icon: IIcon['name'] }> = [
	{ label: 'Performance Index', to: '/market-makers', icon: 'layers' },
	{ label: 'Depth', to: '/market-makers/depth', icon: 'chart-no-axes-column-increasing' },
	{ label: 'Volume', to: '/market-makers/volume', icon: 'presentation' },
	{ label: 'Spread', to: '/market-makers/spread', icon: 'arrow-left-right' },
	{ label: 'KPI Adherence', to: '/market-makers/kpi', icon: 'flag' },
	{ label: 'Documentation', to: '/market-makers/documentation', icon: 'file-text' }
]

export function MarketMakersTabs({ active }: { active: string }) {
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const activeTab = MARKET_MAKER_TABS.find((tab) => tab.label === active)
	// Every leaderboard reads the same `period`, so moving between tabs keeps the reader's timeframe.
	const timeframe = readTimeframe(router.query)
	const periodQuery = timeframe === DEFAULT_TIMEFRAME ? '' : `?period=${timeframe}`

	return (
		<>
			<Card padding="none" className="overflow-hidden min-[713px]:hidden">
				<button
					type="button"
					onClick={() => setOpen((value) => !value)}
					aria-expanded={open}
					className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 label-md text-primary"
				>
					<span className="flex items-center gap-2">
						{activeTab ? <Icon name={activeTab.icon} className="size-4 shrink-0" aria-hidden /> : null}
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
					{/* inert while collapsed, so the hidden links leave the tab order. */}
					<div className="overflow-hidden" inert={!open}>
						<nav className="flex flex-col gap-1 border-t border-subtle p-1" aria-label="Market makers pages">
							{MARKET_MAKER_TABS.map((tab) => (
								<RailItem
									as={BasicLink}
									key={tab.to}
									href={tab.to + periodQuery}
									active={tab.label === active}
									aria-current={tab.label === active ? 'page' : undefined}
								>
									<Icon name={tab.icon} className="size-3.5 shrink-0" aria-hidden />
									{tab.label}
								</RailItem>
							))}
						</nav>
					</div>
				</div>
			</Card>
			<TabNav label="Market makers pages" className="hidden min-[713px]:flex">
				{MARKET_MAKER_TABS.map((tab) => (
					<TabLink
						as={BasicLink}
						key={tab.to}
						href={tab.to + periodQuery}
						aria-current={tab.label === active ? 'page' : undefined}
					>
						<Icon name={tab.icon} className="size-3.5 shrink-0" aria-hidden />
						{tab.label}
					</TabLink>
				))}
			</TabNav>
		</>
	)
}
