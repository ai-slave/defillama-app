import { useState } from 'react'
import { Panel, PanelHeader } from '~/ui/Panel'
import { usePerformanceIndex } from '../client'
import { DocsDrawer } from '../DocsDrawer'
import { MarketMakersOutro } from '../MarketMakersOutro'
import { MarketMakersTabs } from '../MarketMakersTabs'
import { MMDetailDrawer } from '../MMDetailDrawer'
import { RefineDrawer } from '../RankTable/RefineDrawer'
import { RefineButton } from '../RefineButton'
import { AboutButton, RfqButton, SectionHeader } from '../SectionHeader'
import { timeframeBadge, timeframePeriod, useLeaderboardTimeframe } from '../timeframe'
import type { PerformanceIndexProps } from './data'
import { Definitions } from './Definitions'
import { Podium } from './Podium'
import { ScoresTable } from './ScoresTable'
import { Superlatives } from './Superlatives'

type SelectedMM = { id: string; name: string }

export function PerformanceIndex(props: PerformanceIndexProps) {
	const { timeframe, setTimeframe, applyToAll, setApplyToAll, range } = useLeaderboardTimeframe('performance')
	const badge = timeframeBadge(timeframe)
	const period = timeframePeriod(timeframe)
	const { data } = usePerformanceIndex(range, props)
	const { performanceRows, aggregated } = data ?? props
	const [docsOpen, setDocsOpen] = useState(false)
	const [refineOpen, setRefineOpen] = useState(false)
	const [selectedMM, setSelectedMM] = useState<SelectedMM | null>(null)

	const selectMM = (id: string, name: string) => setSelectedMM({ id, name })

	return (
		<>
			<div className="flex flex-col gap-2">
				<MarketMakersTabs active="Performance Index" />
				<div className="flex flex-col gap-2">
					<SectionHeader
						title="Forgd Market Maker Performance Index Leaderboard"
						description="Data-driven Market Maker rankings derived from 500+ engagements, evaluating historical execution, reliability, and ecosystem integration."
						badge={badge}
						action={<RfqButton />}
					/>
					<Podium rows={performanceRows} aggregated={aggregated} />
					<Superlatives aggregated={aggregated} period={period} />
					<Panel>
						<PanelHeader className="justify-between">
							<h2 className="heading-xs">Ranking</h2>
							<div className="flex items-center gap-1.5">
								<AboutButton onClick={() => setDocsOpen(true)} />
								<RefineButton onClick={() => setRefineOpen(true)} />
							</div>
						</PanelHeader>
						<ScoresTable rows={performanceRows} onSelectMM={selectMM} />
					</Panel>
					<Definitions />
					<MarketMakersOutro />
				</div>
			</div>
			<DocsDrawer open={docsOpen} onClose={() => setDocsOpen(false)} />
			<RefineDrawer
				open={refineOpen}
				onClose={() => setRefineOpen(false)}
				timeframe={timeframe}
				setTimeframe={setTimeframe}
				applyToAll={applyToAll}
				setApplyToAll={setApplyToAll}
			/>
			<MMDetailDrawer
				open={selectedMM != null}
				onClose={() => setSelectedMM(null)}
				marketMakerId={selectedMM?.id ?? null}
				fallbackName={selectedMM?.name}
				range={range}
				badge={badge}
			/>
		</>
	)
}
