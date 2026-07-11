import dynamic from 'next/dynamic'
import { type ComponentProps, useEffect, useState } from 'react'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Button } from '~/ui/Button'
import { AccentBadge, SecondaryBadge, StatusBadge, TimeframeBadge } from './badges'
import { BreakdownTables, BreakdownTablesSkeleton } from './BreakdownTable'
import {
	type LeaderboardRange,
	useMarketMakerBreakdown,
	useMarketMakerDetail,
	useMarketMakerPerformance
} from './client'
import { countryFromCode } from './country'
import { Drawer } from './Drawer'
import { roundPercentile } from './format'
import { type RadarScores } from './RadarChart'

const RadarChart = dynamic(() => import('./RadarChart').then((mod) => mod.RadarChart), {
	ssr: false,
	loading: () => <div className="h-[280px] w-full" />
})

type Dict = Record<string, unknown>
type IconName = ComponentProps<typeof Icon>['name']

function asDict(value: unknown): Dict {
	return value && typeof value === 'object' ? (value as Dict) : {}
}

function asNum(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asStr(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null
}

const FALLBACK = '—'
const NA = 'N/A'
const CARD_BORDER = 'rounded-lg border border-subtle bg-surface'
const EMPTY_SECTIONS = { depth: {}, volume: {}, spread: {}, kpi: {} }

const INTEGRATION_LABEL: Record<'full' | 'partial' | 'none', string> = {
	full: 'Fully Integrated',
	partial: 'Partially Integrated',
	none: 'None'
}

function integrationLabel(status: string | null): string {
	return INTEGRATION_LABEL[(status ?? 'none') as 'full' | 'partial' | 'none'] ?? INTEGRATION_LABEL.none
}

const SCORE_ROWS: { key: keyof RadarScores; label: string }[] = [
	{ key: 'composite', label: 'Composite Score' },
	{ key: 'tradingKpis', label: 'Trading KPIs' },
	{ key: 'trustIntegration', label: 'Trust & Integration' },
	{ key: 'coverageCapabilities', label: 'Coverage & Capabilities' },
	{ key: 'uptime', label: 'Uptime' },
	{ key: 'integrationLevel', label: 'Integration Level' }
]

const BOARD_CARDS: { rankKey: string; label: string; suffix: string; icon: IconName }[] = [
	{ rankKey: 'aggregatedRank', label: 'Aggregated Leaderboard', suffix: 'across all major KPIs.', icon: 'layers' },
	{ rankKey: 'depthRank', label: 'Depth Leaderboard', suffix: 'for liquidity provision.', icon: 'bar-chart-2' },
	{ rankKey: 'volumeRank', label: 'Volume Leaderboard', suffix: 'for trade volume.', icon: 'activity' },
	{ rankKey: 'spreadRank', label: 'Spread Leaderboard', suffix: 'for top-of-book spreads.', icon: 'repeat' },
	{ rankKey: 'kpiRank', label: 'KPI Adherence Leaderboard', suffix: 'for uptime across critical KPIs.', icon: 'flag' }
]

function toScores(performance: Dict): RadarScores {
	const score = (key: string) => {
		const v = performance[key]
		if (typeof v === 'number') return asNum(v)
		return asNum(asDict(v).value)
	}
	return {
		composite: score('composite'),
		tradingKpis: score('tradingKpis'),
		trustIntegration: score('trustIntegration'),
		coverageCapabilities: score('coverageCapabilities'),
		uptime: score('uptime'),
		integrationLevel: score('integrationLevel')
	}
}

function stringList(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value
		.map((item) => (typeof item === 'string' ? item : asStr(asDict(item).name)))
		.filter((s): s is string => !!s)
}

const ENGAGEMENT_OPTION_LABELS: Record<string, string> = {
	loan_call_option: 'Loan + Call Option',
	retainer_working_capital: 'Retainer + Working Capital'
}

function titleCaseSlug(slug: string): string {
	return slug
		.split('_')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ')
}

function engagementOptionLabels(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value
		.filter((slug): slug is string => typeof slug === 'string' && slug.length > 0)
		.map((slug) => ENGAGEMENT_OPTION_LABELS[slug] ?? titleCaseSlug(slug))
}

type Venue = { key: string; name: string; icon: string | null }

function venueList(value: unknown): Venue[] {
	if (!Array.isArray(value)) return []
	const venues: Venue[] = []
	for (const item of value) {
		const o = asDict(item)
		const name = asStr(o.label)
		if (!name) continue
		venues.push({ key: asStr(o.value) ?? name, name, icon: asStr(o.url) })
	}
	return venues
}

function WebsiteButton({ href }: { href: string }) {
	return (
		<Button as={BasicLink} href={href} target="_blank" rel="noopener noreferrer" size="md">
			<Icon name="globe" height={14} width={14} />
			Website
			<Icon name="arrow-up-right" height={14} width={14} />
		</Button>
	)
}

function BadgeRow({ title, items }: { title: string; items: string[] }) {
	if (items.length === 0) return null
	return (
		<section className="flex flex-col gap-2">
			<h3 className="label-md text-primary">{title}</h3>
			<div className="flex flex-wrap gap-2">
				{items.map((item) => (
					<AccentBadge key={item} className="h-8">
						{item}
					</AccentBadge>
				))}
			</div>
		</section>
	)
}

function VenueSection({ title, venues }: { title: string; venues: Venue[] }) {
	if (venues.length === 0) return null
	return (
		<section className="flex flex-col gap-2">
			<h3 className="label-md text-primary">{title}</h3>
			<div className="flex flex-wrap gap-2">
				{venues.map((venue) => (
					<span key={venue.key} className={`inline-flex items-center gap-1.5 px-2 py-1 body-sm ${CARD_BORDER}`}>
						{venue.icon ? (
							<img src={venue.icon} alt={venue.name} width={18} height={18} className="rounded-full" />
						) : null}
						{venue.name}
					</span>
				))}
			</div>
		</section>
	)
}

function BulletList({ title, items }: { title: string; items: string[] }) {
	if (items.length === 0) return null
	return (
		<section className="flex flex-col gap-2">
			<h3 className="label-md text-primary">{title}</h3>
			<ul className="list-disc pl-5 body-sm text-secondary">
				{items.map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
		</section>
	)
}

function DetailSections({ detail }: { detail: Dict }) {
	const engagementOptions = engagementOptionLabels(detail.engagementOptions)
	const cexs = venueList(detail.supportedCEX)
	const dexs = venueList(detail.supportedDEX)
	const ancillary = stringList(detail.services)

	return (
		<>
			<BadgeRow title="Available engagement options" items={engagementOptions} />
			<VenueSection title="Major CEXs Supported" venues={cexs} />
			<VenueSection title="Major DEXs Supported" venues={dexs} />
			<BulletList title="Ancillary services offered" items={ancillary} />
		</>
	)
}

function DrawerBody({
	open,
	marketMakerId,
	range,
	badge,
	fallbackName
}: {
	open: boolean
	marketMakerId: string | null
	range: LeaderboardRange
	badge: string
	fallbackName?: string
}) {
	const detail = useMarketMakerDetail(marketMakerId, open)
	const breakdown = useMarketMakerBreakdown(marketMakerId, range, open)
	const performance = useMarketMakerPerformance(marketMakerId, range, open)

	if (detail.isPending || breakdown.isPending || performance.isPending) {
		return (
			<div className="flex flex-col gap-6 p-4">
				<div className="h-6 w-2/3 animate-pulse rounded-sm bg-surface-elevated-2" />
				<div className="h-24 w-full animate-pulse rounded-sm bg-surface-elevated-2" />
				<BreakdownTablesSkeleton />
				<div className="h-64 w-full animate-pulse rounded-sm bg-surface-elevated-2" />
				<div className="h-40 w-full animate-pulse rounded-sm bg-surface-elevated-2" />
			</div>
		)
	}

	const d = asDict(detail.data)
	const p = asDict(performance.data)
	const name = asStr(d.name) ?? fallbackName ?? marketMakerId ?? 'Market Maker'
	const description = asStr(d.description) ?? FALLBACK
	const status = asStr(p.integrationStatus)
	const country = countryFromCode(asStr(d.countryCode))
	const logo = asStr(d.imageUrl)
	const website = asStr(d.website)
	const activeEngagements = asNum(d.activeEngagementsCount)
	const avgFdv = asNum(d.averageFDV)

	const scores = toScores(p)
	const b = asDict(breakdown.data)

	return (
		<div className="flex flex-col gap-6 p-4">
			<section className="flex flex-col gap-3">
				<div className="flex items-center gap-2">
					{logo ? <TokenLogo src={logo} size={28} alt={name} /> : null}
					<h3 className="heading-xs">About {name}</h3>
				</div>
				<p className="body-sm text-secondary">{description}</p>
				<div className="flex flex-wrap items-center gap-2">
					<StatusBadge status={status ?? 'none'} label={integrationLabel(status)} className="h-8 px-3" />
					{country ? <SecondaryBadge className="h-8">{`HQ: ${country.flag} ${country.name}`}</SecondaryBadge> : null}
					{website ? <WebsiteButton href={website} /> : null}
				</div>
			</section>

			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<h3 className="heading-xs">Leaderboards Performance</h3>
					<TimeframeBadge label={badge} />
				</div>
				<RadarChart scores={scores} />
				<div className={`flex flex-col p-3 ${CARD_BORDER}`}>
					{SCORE_ROWS.map((row) => (
						<div key={row.key} className="flex h-8 items-center justify-between text-sm">
							<span className="text-secondary">{row.label}</span>
							<span className="font-medium">{(scores[row.key] ?? 0).toFixed(2)}/10.00</span>
						</div>
					))}
				</div>
			</section>

			<section className="flex flex-col gap-3">
				{BOARD_CARDS.map((card) => {
					const rank = asDict(b[card.rankKey])
					const percentile = roundPercentile(asNum(rank.percentile))
					const rankValue = asNum(rank.value)
					const percentileLabel = percentile == null ? NA : String(percentile)
					return (
						<div
							key={card.rankKey}
							className={`flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 ${CARD_BORDER}`}
						>
							<div className="flex flex-col gap-1">
								<h4 className="flex items-center gap-2 text-sm font-semibold">
									<Icon name={card.icon} height={16} width={16} className="shrink-0 text-secondary" />
									{card.label}
								</h4>
								<p className="body-sm text-secondary">
									Outperformed {percentileLabel}% of their peers {card.suffix}
								</p>
							</div>
							<div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end sm:gap-1">
								<SecondaryBadge>Percentile: {percentileLabel}%</SecondaryBadge>
								<SecondaryBadge>Rank: {rankValue == null ? NA : rankValue}</SecondaryBadge>
							</div>
						</div>
					)
				})}
			</section>

			<section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
				<div className={`flex min-h-20 flex-col justify-center gap-1 p-4 ${CARD_BORDER}`}>
					<span className="body-sm text-secondary">Active Engagements in Forgd</span>
					<span className="text-xl font-bold">{activeEngagements == null ? FALLBACK : activeEngagements}</span>
				</div>
				<div className={`flex min-h-20 flex-col justify-center gap-1 p-4 ${CARD_BORDER}`}>
					<span className="body-sm text-secondary">Avg. FDV of Projects in Forgd</span>
					<span className="text-xl font-bold">
						{avgFdv == null ? FALLBACK : `$${Math.round(avgFdv).toLocaleString('en-US')}`}
					</span>
				</div>
			</section>

			<BreakdownTables sections={breakdown.data?.sections ?? EMPTY_SECTIONS} badge={badge} />

			<DetailSections detail={d} />
		</div>
	)
}

export function MMDetailDrawer({
	open,
	onClose,
	marketMakerId,
	fallbackName,
	range,
	badge
}: {
	open: boolean
	onClose: () => void
	marketMakerId: string | null
	fallbackName?: string
	range: LeaderboardRange
	badge: string
}) {
	// Keep the last opened market maker while the drawer animates closed so the content
	// does not blank out to N/A before it finishes leaving.
	const [lastId, setLastId] = useState<string | null>(marketMakerId)
	const [lastName, setLastName] = useState<string | undefined>(fallbackName)
	useEffect(() => {
		if (marketMakerId) {
			setLastId(marketMakerId)
			setLastName(fallbackName)
		}
	}, [marketMakerId, fallbackName])

	const id = marketMakerId ?? lastId
	const name = fallbackName ?? lastName
	const detail = useMarketMakerDetail(id, open)
	const title = asStr(asDict(detail.data).name) ?? name ?? id ?? 'Market Maker'

	return (
		<Drawer open={open} onClose={onClose} title={title} widthClassName="sm:max-w-2xl">
			<DrawerBody open={open} marketMakerId={id} range={range} badge={badge} fallbackName={name} />
		</Drawer>
	)
}
