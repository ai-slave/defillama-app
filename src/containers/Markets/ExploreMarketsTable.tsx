import * as React from 'react'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { TAG_GROUP_SIZES, TAG_GROUP_VARIANTS } from '~/ui/SegmentedControl'
import { CategoriesTable } from './CategoriesTable'
import { ExchangesTable } from './ExchangesTable'
import type { Segment } from './segments'
import type { KnownTokenSlugs } from './shared'
import { TokensTable } from './TokensTable'
import type { CategoryStat, ExchangeListRow, SymbolStat } from './types'

type ExploreTab = 'categories' | 'exchanges' | 'assets'

const EXPLORE_TABS: ReadonlyArray<{ id: ExploreTab; label: string }> = [
	{ id: 'categories', label: 'Categories' },
	{ id: 'exchanges', label: 'Exchanges' },
	{ id: 'assets', label: 'Assets' }
]

export function ExploreMarketsTable({
	categories,
	exchanges,
	assets,
	segment,
	knownTokenSlugs
}: {
	categories: CategoryStat[]
	exchanges: ExchangeListRow[]
	assets: SymbolStat[]
	segment: Segment
	knownTokenSlugs: KnownTokenSlugs
}) {
	const [activeTab, setActiveTab] = React.useState<ExploreTab>('categories')
	const panelId = 'explore-markets-panel'
	const focusTab = (tab: ExploreTab) => {
		setActiveTab(tab)
		document.getElementById(`explore-markets-tab-${tab}`)?.focus()
	}
	const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tab: ExploreTab) => {
		const currentIndex = EXPLORE_TABS.findIndex((option) => option.id === tab)
		let nextIndex: number | null = null

		if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % EXPLORE_TABS.length
		if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + EXPLORE_TABS.length) % EXPLORE_TABS.length
		if (event.key === 'Home') nextIndex = 0
		if (event.key === 'End') nextIndex = EXPLORE_TABS.length - 1
		if (nextIndex == null) return

		event.preventDefault()
		focusTab(EXPLORE_TABS[nextIndex].id)
	}

	return (
		<Panel padding="none">
			<PanelHeader>
				<PanelTitle>Explore markets</PanelTitle>
				<div
					className={`${TAG_GROUP_VARIANTS.solid.container} ${TAG_GROUP_SIZES.md}`}
					role="tablist"
					aria-label="Explore markets"
				>
					{EXPLORE_TABS.map((tab) => (
						<button
							key={tab.id}
							id={`explore-markets-tab-${tab.id}`}
							type="button"
							role="tab"
							aria-selected={activeTab === tab.id}
							aria-controls={panelId}
							tabIndex={activeTab === tab.id ? 0 : -1}
							data-active={activeTab === tab.id}
							onClick={() => setActiveTab(tab.id)}
							onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
							className={TAG_GROUP_VARIANTS.solid.button}
						>
							{tab.label}
						</button>
					))}
				</div>
			</PanelHeader>
			<div id={panelId} role="tabpanel" aria-labelledby={`explore-markets-tab-${activeTab}`} className="min-w-0">
				{activeTab === 'categories' ? (
					<CategoriesTable categories={categories} segment={segment} embedded />
				) : activeTab === 'exchanges' ? (
					<ExchangesTable exchanges={exchanges} segment={segment} embedded />
				) : (
					<TokensTable rows={assets} segment={segment} knownTokenSlugs={knownTokenSlugs} embedded />
				)}
			</div>
		</Panel>
	)
}
