import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { LocalLoader } from '~/components/Loaders'
import { Card } from '~/ui/Card'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import {
	fetchMarketsCategories,
	fetchMarketsCategorySeries,
	fetchMarketsExchangeSeries,
	fetchMarketsExchangesList,
	fetchMarketsTokens
} from './api'
import { ExploreMarketsTable } from './ExploreMarketsTable'
import { MarketsCharts } from './MarketsCharts'
import { MarketsSegmentTabs } from './MarketsSegmentTabs'
import { MarketsStatStrip } from './MarketsStatStrip'
import { MomentumCards } from './MomentumCards'
import { recordBySegment, resolveSegment, type Segment } from './segments'
import type { KnownTokenSlugs } from './shared'
import type { CategoryStatsBySegment, ExchangeListRow, SymbolStatsBySegment } from './types'
import { aggregateCategories, availableSegmentsFromRows, segmentSubtitles as buildSegmentSubtitles } from './utils'

const STALE_TIME = 60 * 60 * 1000

// Stable empty fallbacks so query-less renders don't churn memo/callback deps.
const EMPTY_TOKENS: SymbolStatsBySegment = recordBySegment(() => [])
const EMPTY_CATEGORIES: CategoryStatsBySegment = recordBySegment(() => [])
const EMPTY_EXCHANGES: ExchangeListRow[] = []

export function MarketsHome({
	segment,
	onSegmentChange,
	knownTokenSlugs
}: {
	segment: Segment
	onSegmentChange: (segment: Segment) => void
	knownTokenSlugs: KnownTokenSlugs
}) {
	const tokensQuery = useQuery({
		queryKey: ['markets-tokens'],
		queryFn: fetchMarketsTokens,
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})
	const categoriesQuery = useQuery({
		queryKey: ['markets-categories'],
		queryFn: fetchMarketsCategories,
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})
	const exchangeSeriesQuery = useQuery({
		queryKey: ['markets-exchange-series'],
		queryFn: fetchMarketsExchangeSeries,
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})
	const categorySeriesQuery = useQuery({
		queryKey: ['markets-category-series'],
		queryFn: fetchMarketsCategorySeries,
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})
	const exchangesQuery = useQuery({
		queryKey: ['markets-exchanges-list'],
		queryFn: fetchMarketsExchangesList,
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	const tokens = tokensQuery.data ?? EMPTY_TOKENS
	const availableSegments = React.useMemo(
		() => (tokensQuery.data ? availableSegmentsFromRows(tokens) : []),
		[tokensQuery.data, tokens]
	)
	const activeSegment = tokensQuery.data ? resolveSegment(segment, availableSegments) : segment
	const segmentTokens = tokens[activeSegment]
	const categoriesData = categoriesQuery.data ?? EMPTY_CATEGORIES
	const segmentCategories = React.useMemo(() => {
		const fromServer = categoriesData[activeSegment]
		if (fromServer && fromServer.length > 0) return fromServer
		return aggregateCategories(segmentTokens)
	}, [categoriesData, activeSegment, segmentTokens])

	const segmentSubtitles = React.useMemo(() => {
		if (!tokensQuery.data) return null
		return buildSegmentSubtitles(tokens)
	}, [tokensQuery.data, tokens])

	const subtitleFor = React.useCallback((seg: Segment) => segmentSubtitles?.[seg] ?? null, [segmentSubtitles])

	return (
		<div className="flex flex-1 flex-col gap-2">
			<Card as="header" padding="strip" className="flex flex-col gap-1.5">
				<h1 className="heading-sm">Markets</h1>
				<p className="body-sm text-secondary">Per-asset spot and perpetual metrics merged across venues.</p>
			</Card>
			<MarketsSegmentTabs
				activeSegment={activeSegment}
				onChange={onSegmentChange}
				subtitleFor={subtitleFor}
				availableSegments={tokensQuery.data ? availableSegments : undefined}
			/>

			{tokensQuery.isLoading ? (
				<PanelLoadingStatus>
					<LocalLoader />
				</PanelLoadingStatus>
			) : tokensQuery.isError || segmentTokens.length === 0 ? (
				<PanelStatus variant={tokensQuery.isError ? 'error' : 'empty'}>
					{tokensQuery.isError ? 'Failed to load market data.' : 'No data for this segment.'}
				</PanelStatus>
			) : (
				<div className="flex flex-col gap-6">
					<MarketsStatStrip rows={segmentTokens} segment={activeSegment} />
					<Panel padding="none">
						<PanelHeader>
							<PanelTitle>Movers · 24h</PanelTitle>
						</PanelHeader>
						<div className="p-2">
							<MomentumCards
								categories={segmentCategories}
								tokens={segmentTokens}
								segment={activeSegment}
								knownTokenSlugs={knownTokenSlugs}
							/>
						</div>
					</Panel>
					<MarketsCharts
						exchangeSeries={exchangeSeriesQuery.data ?? []}
						categorySeries={categorySeriesQuery.data ?? []}
						segment={activeSegment}
					/>
					<ExploreMarketsTable
						categories={segmentCategories}
						exchanges={exchangesQuery.data?.[activeSegment] ?? EMPTY_EXCHANGES}
						assets={segmentTokens}
						segment={activeSegment}
						knownTokenSlugs={knownTokenSlugs}
					/>
				</div>
			)}
		</div>
	)
}
