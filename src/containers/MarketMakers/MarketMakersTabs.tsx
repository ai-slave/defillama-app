import type { ComponentType } from 'react'
import { useState } from 'react'
import { BasicLink } from '~/components/Link'
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

const TAB_CLASS =
	'inline-flex items-center gap-1.5 rounded-md bg-(--link-bg) px-2.5 py-1 text-xs font-medium whitespace-nowrap text-(--link-text) hover:bg-(--link-hover-bg) focus-visible:bg-(--link-hover-bg) data-[active=true]:bg-(--link-active-bg) data-[active=true]:text-white'

export function MarketMakersTabs({ active }: { active: string }) {
	const [open, setOpen] = useState(false)
	const activeTab = MARKET_MAKER_TABS.find((tab) => tab.label === active)

	return (
		<>
			<div className="rounded-md border border-(--cards-border) bg-(--cards-bg) min-[713px]:hidden">
				<button
					type="button"
					onClick={() => setOpen((value) => !value)}
					aria-expanded={open}
					className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-semibold text-(--text-primary)"
				>
					<span className="flex items-center gap-2">
						{activeTab ? <activeTab.Icon /> : null}
						{active}
					</span>
					<span
						className={`text-[10px] leading-none text-(--text-tertiary) transition-transform duration-300 ease-in-out ${open ? 'rotate-180' : ''}`}
					>
						▼
					</span>
				</button>
				<div
					className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
				>
					<div className="overflow-hidden">
						<div className="flex flex-col gap-1 border-t border-(--cards-border) p-1">
							{MARKET_MAKER_TABS.map((tab) => (
								<BasicLink
									key={tab.to}
									href={tab.to}
									data-active={tab.label === active}
									className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-(--link-text) hover:bg-(--link-hover-bg) data-[active=true]:bg-(--link-active-bg) data-[active=true]:font-semibold data-[active=true]:text-white"
								>
									<tab.Icon />
									{tab.label}
								</BasicLink>
							))}
						</div>
					</div>
				</div>
			</div>
			<div className="hidden thin-scrollbar flex-nowrap gap-2 overflow-x-auto rounded-md border border-(--cards-border) bg-(--cards-bg) p-1 min-[713px]:flex">
				{MARKET_MAKER_TABS.map((tab) => (
					<BasicLink key={tab.to} href={tab.to} data-active={tab.label === active} className={TAB_CLASS}>
						<tab.Icon className="size-3.5" />
						{tab.label}
					</BasicLink>
				))}
			</div>
		</>
	)
}
