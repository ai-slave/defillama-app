import { useMemo, useState } from 'react'
import { useLeaderboardRows } from './client'
import { type ColumnConfig, DISPLAY_MODES, type DisplayMode, THRESHOLDS, type Threshold } from './constants'
import { DocsDrawer } from './DocsDrawer'
import { MarketMakersOutro } from './MarketMakersOutro'
import { MarketMakersTabs } from './MarketMakersTabs'
import { MMDetailDrawer } from './MMDetailDrawer'
import { RankTable } from './RankTable'
import { RefineDrawer } from './RankTable/RefineDrawer'
import { DocsActionButton, SectionHeader } from './SectionHeader'
import { selectDepthBucket, toBoardRows } from './server/shape'
import { timeframeBadge, useLeaderboardTimeframe } from './timeframe'
import type { LeaderboardRow } from './types'

interface ILeaderboardProps {
	active: string
	title: string
	subtitle: string
	columns: ColumnConfig[]
	initialData: unknown
	fetchPath: 'depth' | 'volume' | 'spread' | 'kpi'
	hasThreshold?: boolean
}

export function Leaderboard({
	active,
	title,
	subtitle,
	columns,
	initialData,
	fetchPath,
	hasThreshold
}: ILeaderboardProps) {
	const { timeframe, setTimeframe, applyToAll, setApplyToAll, range } = useLeaderboardTimeframe(fetchPath)
	const badge = timeframeBadge(timeframe)
	const [mode, setMode] = useState<DisplayMode>(DISPLAY_MODES[0])
	const [threshold, setThreshold] = useState<Threshold>(THRESHOLDS[0])
	const shape = useMemo<(raw: unknown) => LeaderboardRow[]>(
		() =>
			hasThreshold ? (raw) => selectDepthBucket(raw, threshold) : (raw) => toBoardRows(Array.isArray(raw) ? raw : []),
		[hasThreshold, threshold]
	)
	const { data, isLoading } = useLeaderboardRows(fetchPath, range, initialData, shape)
	const [refineOpen, setRefineOpen] = useState(false)
	const [docsOpen, setDocsOpen] = useState(false)
	const [selectedMM, setSelectedMM] = useState<{ id: string; name: string } | null>(null)

	return (
		<>
			<div className="flex flex-col gap-2">
				<MarketMakersTabs active={active} />
				<div className="flex flex-col gap-2">
					<SectionHeader
						title={title}
						description={subtitle}
						badge={badge}
						action={<DocsActionButton onClick={() => setDocsOpen(true)} />}
					/>
					<RankTable
						rows={data ?? []}
						columns={columns}
						mode={mode}
						setMode={setMode}
						threshold={hasThreshold ? threshold : undefined}
						setThreshold={hasThreshold ? setThreshold : undefined}
						onRefine={() => setRefineOpen(true)}
						onSelectMM={(id, name) => setSelectedMM({ id, name })}
						isLoading={isLoading}
					/>
					<MarketMakersOutro />
				</div>
			</div>
			<RefineDrawer
				open={refineOpen}
				onClose={() => setRefineOpen(false)}
				timeframe={timeframe}
				setTimeframe={setTimeframe}
				applyToAll={applyToAll}
				setApplyToAll={setApplyToAll}
			/>
			<DocsDrawer open={docsOpen} onClose={() => setDocsOpen(false)} />
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
