import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { Icon } from '~/components/Icon'
import { TagGroup } from '~/components/TagGroup'
import {
	getGeckoIdFromSearchId,
	getTokenSearchFallback,
	hydrateTokenSearchOptionsByIds
} from '~/containers/TokenSearch/search'
import { TokenSearchDialog, toTokenSearchOption } from '~/containers/TokenSearch/TokenSearchDialog'
import type { TokenSearchResult } from '~/containers/TokenSearch/types'
import { useIsClient } from '~/hooks/useIsClient'
import { Card } from '~/ui/Card'
import { pushShallowQuery } from '~/utils/routerQuery'
import { FAQ } from './Faq'
import type { PricePoint } from './hooks'
import { usePriceCharts } from './hooks'
import { pearsonCorrelationCoefficient, toPairedLogReturns } from './util'

function CoinImage({ src }: { src: string }) {
	return (
		<img
			alt=""
			src={src}
			height="24"
			width="24"
			loading="lazy"
			onError={(e) => {
				const img = e.currentTarget
				img.onerror = null
				img.src = '/assets/placeholder.png'
			}}
			className="inline-block aspect-square shrink-0 rounded-full bg-surface-elevated-2 object-cover"
		/>
	)
}

interface CorrelationCellProps {
	coinId: string
	coin1Id: string
	correlations: Record<string, Record<string, number | null>>
	alignedPointCounts: Record<string, Record<string, number>>
	returnPointCounts: Record<string, Record<string, number>>
	requiredReturnPoints: number
}

function CorrelationCell({
	coinId,
	coin1Id,
	correlations,
	alignedPointCounts,
	returnPointCounts,
	requiredReturnPoints
}: CorrelationCellProps) {
	const corr = correlations[coinId]?.[coin1Id] ?? null
	const aligned = alignedPointCounts[coinId]?.[coin1Id] ?? 0
	const returns = returnPointCounts[coinId]?.[coin1Id] ?? 0

	const backgroundColor =
		corr != null
			? corr > 0
				? `rgba(53, 222, 59, ${Math.abs(corr)})`
				: `rgba(255, 0, 0, ${Math.abs(corr)})`
			: undefined

	return (
		<td
			title={`Aligned prices: ${aligned}\nReturns used: ${returns}\nMinimum required: ${requiredReturnPoints}`}
			style={{ backgroundColor }}
			className="relative size-12 hover:after:pointer-events-none hover:after:absolute hover:after:top-[-5000px] hover:after:left-0 hover:after:h-[10000px] hover:after:w-full hover:after:bg-hover-row hover:after:content-['']"
		>
			{corr == null ? '--' : corr.toFixed(2)}
		</td>
	)
}

const PERIODS = ['7d', '1m', '1y'] as const
type Period = (typeof PERIODS)[number]
const PERIOD_MS: Record<Period, number> = {
	'7d': 7 * 24 * 60 * 60 * 1000,
	'1m': 30 * 24 * 60 * 60 * 1000,
	'1y': 365 * 24 * 60 * 60 * 1000
}
const MIN_RETURN_POINTS_BY_PERIOD: Record<Period, number> = {
	'7d': 5,
	'1m': 20,
	'1y': 30
}
const DEFAULT_PERIOD: Period = '1y'
export const DEFAULT_CORRELATION_TOKEN_IDS = ['bitcoin', 'ethereum', 'tether', 'binancecoin'] as const
const DEFAULT_QUERY_COINS = [...DEFAULT_CORRELATION_TOKEN_IDS]
const CORRELATION_BUCKET_MS = 20 * 60 * 1000

const isPeriod = (value: string): value is Period => {
	return PERIODS.includes(value as Period)
}

const bucketPointsByTime = (points: PricePoint[], fromTimestamp: number) => {
	const buckets = new Map<number, number>()
	for (const point of points) {
		if (point.timestamp < fromTimestamp) continue
		const bucketTimestamp = Math.floor(point.timestamp / CORRELATION_BUCKET_MS) * CORRELATION_BUCKET_MS
		// Keep the most recent price in each bucket.
		buckets.set(bucketTimestamp, point.price)
	}
	return buckets
}

interface CorrelationData {
	correlations: Record<string, Record<string, number | null>>
	alignedPointCounts: Record<string, Record<string, number>>
	returnPointCounts: Record<string, Record<string, number>>
}

interface CorrelationsProps {
	initialTokenOptions: TokenSearchResult[]
}

function buildTokenOptionMap(tokens: TokenSearchResult[]): Record<string, TokenSearchResult> {
	const map: Record<string, TokenSearchResult> = {}
	for (const token of tokens) {
		map[token.id] = token
	}
	return map
}

export default function Correlations({ initialTokenOptions }: CorrelationsProps) {
	const router = useRouter()
	const { isReady, pathname, replace } = router
	const getLatestQuery = useEffectEvent(() => router.query)
	const [tokenOptionsById, setTokenOptionsById] = useState<Record<string, TokenSearchResult>>(() =>
		buildTokenOptionMap(initialTokenOptions)
	)
	const queryCoins = useMemo<string[]>(() => {
		const coinQuery = router.query.coin
		if (!coinQuery) return []
		const coins = Array.isArray(coinQuery) ? coinQuery : coinQuery.split(',')
		return coins.filter(Boolean).map(getGeckoIdFromSearchId)
	}, [router.query.coin])
	const missingQueryCoinIds = useMemo(() => {
		if (!isReady || queryCoins.length === 0) return []
		const missingIds: string[] = []
		for (const coinId of queryCoins) {
			if (!tokenOptionsById[coinId]) missingIds.push(coinId)
		}
		return missingIds
	}, [isReady, queryCoins, tokenOptionsById])
	const hydratedTokenOptions = useQuery({
		queryKey: ['token-search-options-by-ids', missingQueryCoinIds],
		queryFn: () => hydrateTokenSearchOptionsByIds(missingQueryCoinIds),
		enabled: missingQueryCoinIds.length > 0,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	})
	const resolvedTokenOptionsById = useMemo(() => {
		const tokens = hydratedTokenOptions.data
		if (!tokens?.length) return tokenOptionsById

		const next = { ...tokenOptionsById }
		for (const token of tokens) {
			next[token.id] = token
		}
		return next
	}, [hydratedTokenOptions.data, tokenOptionsById])

	const selectedCoins = useMemo<Record<string, TokenSearchResult>>(() => {
		if (queryCoins.length === 0) return {}
		const selected: Record<string, TokenSearchResult> = {}

		for (const coinId of queryCoins) {
			const token = resolvedTokenOptionsById[coinId] ?? getTokenSearchFallback(coinId)
			selected[token.id] = token
		}

		return selected
	}, [queryCoins, resolvedTokenOptionsById])

	const period = useMemo<Period>(() => {
		const periodQuery = router.query.period
		const candidate = Array.isArray(periodQuery) ? periodQuery[0] : periodQuery
		return candidate && isPeriod(candidate) ? candidate : DEFAULT_PERIOD
	}, [router.query.period])

	const setPeriod = (nextPeriod: Period) => {
		if (nextPeriod === period) return

		void pushShallowQuery(router, { period: nextPeriod })
	}
	const minReturnPoints = MIN_RETURN_POINTS_BY_PERIOD[period]
	const coins = useMemo(() => Object.values(selectedCoins).filter(Boolean), [selectedCoins])
	const coinIds = useMemo(() => coins.map((c) => c.id), [coins])
	const { data: priceChart, isLoading } = usePriceCharts(coinIds)

	const { correlations, alignedPointCounts, returnPointCounts } = useMemo<CorrelationData>(() => {
		if (isLoading || coins.length === 0) {
			return { correlations: {}, alignedPointCounts: {}, returnPointCounts: {} }
		}
		let latestTimestamp = 0
		for (const coin of coins) {
			for (const point of priceChart[coin.id] ?? []) {
				if (point.timestamp > latestTimestamp) {
					latestTimestamp = point.timestamp
				}
			}
		}
		const fromTimestamp = Math.max(0, latestTimestamp - PERIOD_MS[period])
		const correlationResult: Record<string, Record<string, number | null>> = {}
		const pointCountResult: Record<string, Record<string, number>> = {}
		const returnCountResult: Record<string, Record<string, number>> = {}
		const bucketedSeriesById: Record<string, Map<number, number>> = {}
		for (const coin of coins) {
			bucketedSeriesById[coin.id] = bucketPointsByTime(priceChart[coin.id] ?? [], fromTimestamp)
		}

		for (let i = 0; i < coins.length; i++) {
			const id0 = coins[i].id
			correlationResult[id0] = {}
			pointCountResult[id0] = {}
			returnCountResult[id0] = {}
			for (let j = i + 1; j < coins.length; j++) {
				const id1 = coins[j].id
				const bucketed0 = bucketedSeriesById[id0] ?? new Map<number, number>()
				const bucketed1 = bucketedSeriesById[id1] ?? new Map<number, number>()
				const [smallerSeries, largerSeries] =
					bucketed0.size <= bucketed1.size ? [bucketed0, bucketed1] : [bucketed1, bucketed0]
				const prices0: number[] = []
				const prices1: number[] = []

				for (const [timestamp, price] of smallerSeries.entries()) {
					const otherPrice = largerSeries.get(timestamp)
					if (otherPrice == null) continue
					if (smallerSeries === bucketed0) {
						prices0.push(price)
						prices1.push(otherPrice)
					} else {
						prices0.push(otherPrice)
						prices1.push(price)
					}
				}

				const { returns0, returns1 } = toPairedLogReturns(prices0, prices1)
				const returnPointCount = returns0.length
				pointCountResult[id0][id1] = prices0.length
				returnCountResult[id0][id1] = returnPointCount

				if (returnPointCount < minReturnPoints) {
					correlationResult[id0][id1] = null
					continue
				}

				const corr = pearsonCorrelationCoefficient(returns0, returns1)
				correlationResult[id0][id1] = corr
			}
		}
		// Mirror: corr(A,B) === corr(B,A)
		for (let i = 0; i < coins.length; i++) {
			for (let j = 0; j < i; j++) {
				correlationResult[coins[i].id][coins[j].id] = correlationResult[coins[j].id][coins[i].id]
				pointCountResult[coins[i].id][coins[j].id] = pointCountResult[coins[j].id][coins[i].id]
				returnCountResult[coins[i].id][coins[j].id] = returnCountResult[coins[j].id][coins[i].id]
			}
		}
		return {
			correlations: correlationResult,
			alignedPointCounts: pointCountResult,
			returnPointCounts: returnCountResult
		}
	}, [isLoading, period, coins, priceChart, minReturnPoints])

	useEffect(() => {
		if (!isReady) return
		if (queryCoins.length > 0) return

		void replace(
			{
				pathname,
				query: {
					...getLatestQuery(),
					coin: DEFAULT_QUERY_COINS
				}
			},
			undefined,
			{ shallow: true }
		)
	}, [queryCoins.length, isReady, pathname, replace])

	const dialogStore = Ariakit.useDialogStore()

	const isClient = useIsClient()
	const showContent = isClient && coins.length > 0 && !hydratedTokenOptions.isLoading

	const removeCoin = (coinId: string) => {
		const updatedCoins = queryCoins.filter((c) => c !== coinId)
		void pushShallowQuery(router, { coin: updatedCoins.length > 0 ? updatedCoins : undefined })
	}

	return (
		<>
			<Card padding="strip" className="flex flex-wrap items-center justify-between gap-4">
				<h1 className="heading-sm">Correlations Matrix</h1>
				<TagGroup
					variant="default"
					size="md"
					selectedValue={period}
					setValue={setPeriod}
					values={PERIODS}
					className="ml-auto"
				/>
			</Card>

			<Card padding="md" className="flex flex-col items-center gap-6">
				{!showContent ? (
					<div role="status" aria-live="polite" className="flex min-h-[300px] items-center justify-center">
						<p className="body-sm text-tertiary">Loading...</p>
					</div>
				) : (
					<div className="flex flex-col sm:flex-row">
						<div className="no-scrollbar flex w-40 shrink-0 flex-col overflow-auto sm:mr-6">
							<h2 className="flex h-12 items-center px-3 label-xs text-secondary">Tokens</h2>
							{coins.map((coin) => (
								<button
									key={coin.id}
									onClick={() => removeCoin(coin.id)}
									className="group flex h-12 items-center gap-2 rounded-md px-2 hover:bg-hover-row focus-visible:bg-hover-row"
								>
									<CoinImage src={coin.logo} />
									<span className="label-sm">{coin.symbol}</span>
									<Icon
										name="x"
										height={12}
										width={12}
										className="ml-auto text-tertiary opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"
									/>
								</button>
							))}
							<button
								onClick={dialogStore.toggle}
								className="flex h-12 items-center gap-1 rounded-md px-3 py-2 body-sm text-link hover:bg-hover-row focus-visible:bg-hover-row"
							>
								<Icon name="plus" className="size-3.5" />
								<span>Add token</span>
							</button>
						</div>
						<div className="relative overflow-hidden">
							<table className="table-fixed text-center body-sm">
								<thead>
									<tr>
										<th />
										{coins.map((coin) => (
											<td
												key={`h-${coin.id}`}
												className="relative size-12 font-bold hover:after:pointer-events-none hover:after:absolute hover:after:top-[-5000px] hover:after:left-0 hover:after:h-[10000px] hover:after:w-full hover:after:bg-hover-row hover:after:content-['']"
											>
												{coin.symbol}
											</td>
										))}
										<td>
											<button
												onClick={dialogStore.toggle}
												className="flex size-12 items-center justify-center text-link hover:bg-hover-row focus-visible:bg-hover-row"
											>
												<Icon name="plus" height={16} width={16} />
											</button>
										</td>
									</tr>
								</thead>
								<tbody>
									{coins.map((coin) => (
										<tr key={`r-${coin.id}`} className="hover:bg-hover-row">
											<td className="relative size-12 font-bold hover:after:pointer-events-none hover:after:absolute hover:after:top-[-5000px] hover:after:left-0 hover:after:h-[10000px] hover:after:w-full hover:after:bg-hover-row hover:after:content-['']">
												{coin.symbol}
											</td>
											{coins.map((coin1) =>
												coin1.id === coin.id ? (
													<td
														key={`d-${coin.id}`}
														className="relative size-12 hover:after:pointer-events-none hover:after:absolute hover:after:top-[-5000px] hover:after:left-0 hover:after:h-[10000px] hover:after:w-full hover:after:bg-hover-row hover:after:content-['']"
													>
														<CoinImage src={coin.logo} />
													</td>
												) : (
													<CorrelationCell
														key={`c-${coin.id}-${coin1.id}`}
														coinId={coin.id}
														coin1Id={coin1.id}
														correlations={correlations}
														alignedPointCounts={alignedPointCounts}
														returnPointCounts={returnPointCounts}
														requiredReturnPoints={minReturnPoints}
													/>
												)
											)}
										</tr>
									))}
									<tr>
										<td>
											<button
												onClick={dialogStore.toggle}
												className="flex size-12 items-center justify-center text-link hover:bg-hover-row focus-visible:bg-hover-row"
											>
												<Icon name="plus" height={16} width={16} />
											</button>
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				)}
				<TokenSearchDialog
					initialTokens={initialTokenOptions}
					dialogStore={dialogStore}
					selectedTokens={selectedCoins}
					selectToken={(coin) => {
						const token = toTokenSearchOption(coin)
						setTokenOptionsById((prev) => (prev[token.id] ? prev : { ...prev, [token.id]: token }))
						const updatedCoins = queryCoins.includes(token.id) ? queryCoins : [...queryCoins, token.id]
						void pushShallowQuery(router, { coin: updatedCoins }).then(() => {
							dialogStore.hide()
						})
					}}
				/>
				<div className="w-full border-t border-subtle pt-4">
					<p className="mx-auto max-w-xl text-center body-sm text-secondary">
						Correlation is calculated from log returns built on approximately 20-minute interval price points. A pair
						must have at least {minReturnPoints} aligned return observations for this period; otherwise, the matrix
						shows --.
					</p>
				</div>
			</Card>
			<FAQ />
		</>
	)
}
