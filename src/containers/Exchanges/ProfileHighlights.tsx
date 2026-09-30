/**
 * Top 24h price movers under the venue chart. The metrics card beside the chart is
 * taller than the chart, so this block takes the leftover height: three pills per row,
 * as many whole rows as fit, never more than three rows. Below the xl breakpoint there
 * is no leftover height and it shows one row.
 */
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { geckoTokenIconUrl, letterLogoDataUri } from '~/utils/icons'
import { formatPercent } from '~/utils/numberFormat'
import { EXCHANGE_SEGMENTS, type ExchangePairModel, type ExchangeProfileModel, type ExchangeSegment } from './models'
import { formatPairPrice } from './PairTable'

const PER_ROW = 3
const MAX_ROWS = 3
const ROW_GAP_PX = 8 // gap-2
// A price move on a market nobody trades is noise; require real volume behind it.
const MIN_VOLUME_USD = 1e6

export function topPriceMovers(
	profile: ExchangeProfileModel
): Array<{ pair: ExchangePairModel; segment: ExchangeSegment }> {
	const candidates: Array<{ pair: ExchangePairModel; segment: ExchangeSegment }> = []
	for (const segment of EXCHANGE_SEGMENTS) {
		for (const pair of profile.segments[segment]?.pairs ?? []) {
			if (pair.priceChange24h != null && (pair.volume24h ?? 0) >= MIN_VOLUME_USD) candidates.push({ pair, segment })
		}
	}
	// One pill per base asset: BTC spot and BTC perp move together, so the larger move
	// (usually the more liquid market) represents the token.
	const byBase = new Map<string, { pair: ExchangePairModel; segment: ExchangeSegment }>()
	for (const candidate of candidates.sort(
		(a, b) => Math.abs(b.pair.priceChange24h ?? 0) - Math.abs(a.pair.priceChange24h ?? 0)
	)) {
		if (!byBase.has(candidate.pair.base)) byBase.set(candidate.pair.base, candidate)
	}
	return [...byBase.values()].slice(0, PER_ROW * MAX_ROWS)
}

// Tailwind's xl breakpoint: the only layout where the card sits beside the chart and
// there is leftover height to fill. Below it the block is one row, full stop.
const XL_QUERY = '(min-width: 80rem)'

export function ProfileHighlights({ profile }: { profile: ExchangeProfileModel }) {
	const movers = React.useMemo(() => topPriceMovers(profile), [profile])
	const [rows, setRows] = React.useState(1)
	/** Whole rows of pills that fit the measured leftover height at xl; one row otherwise.
	 *  The grid is `xl:h-0 xl:flex-1`, so its clientHeight is the leftover, not its own
	 *  content — otherwise the count could only ever ratchet up. */
	const fitRows = (grid: HTMLDivElement | null) => {
		if (!grid) return
		const xl = window.matchMedia(XL_QUERY)
		const measure = () => {
			const pill = grid.firstElementChild as HTMLElement | null
			if (!xl.matches || !pill) return setRows(1)
			const fit = Math.floor((grid.clientHeight + ROW_GAP_PX) / (pill.offsetHeight + ROW_GAP_PX))
			setRows(Math.min(MAX_ROWS, Math.max(1, fit)))
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(grid)
		xl.addEventListener('change', measure)
		return () => {
			observer.disconnect()
			xl.removeEventListener('change', measure)
		}
	}
	if (movers.length === 0) return null
	return (
		<section aria-labelledby="exchange-top-movers" className="flex min-h-0 flex-1 flex-col gap-1.5">
			<h3 id="exchange-top-movers" className="body-sm text-secondary">
				Top movers · 24h
			</h3>
			<div
				ref={fitRows}
				className="grid min-h-0 grid-cols-1 content-start gap-2 overflow-hidden sm:grid-cols-3 xl:h-0 xl:flex-1"
			>
				{movers.slice(0, rows * PER_ROW).map(({ pair, segment }) => {
					const change = pair.priceChange24h ?? 0
					return (
						<Card key={`${segment}:${pair.symbol}`} padding="sm" className="flex items-center gap-2">
							<TokenLogo
								src={pair.baseGeckoId ? geckoTokenIconUrl(pair.baseGeckoId, 24) : null}
								size={24}
								fallbackSrc={letterLogoDataUri(pair.base)}
								alt=""
							/>
							<BasicLink href={pair.pairUrl} target="_blank" className="truncate label-md text-link hover:underline">
								{pair.symbol.toUpperCase()}
							</BasicLink>
							<span className="ml-auto flex flex-col items-end">
								<span className="mono-sm">{formatPairPrice(pair.price, pair.quote)}</span>
								<span className={`label-sm ${change >= 0 ? 'text-data-up' : 'text-data-down'}`}>
									{change >= 0 ? '+' : ''}
									{formatPercent(change, { input: 'fraction', maximumFractionDigits: 1, useGrouping: false })}
								</span>
							</span>
						</Card>
					)
				})}
			</div>
		</section>
	)
}
