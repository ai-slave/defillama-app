import dynamic from 'next/dynamic'
import { type ComponentProps, useEffect, useRef, useState } from 'react'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { formatUsd, formatNumber, formatPercent } from '~/utils/numberFormat'
import { AccentBadge, SecondaryBadge, StatusBadge, TimeframeBadge } from './badges'
import type { BreakdownSections } from './breakdown'
import { BreakdownTables, BreakdownTablesSkeleton } from './BreakdownTable'
import { ClaimDialog } from './ClaimDialog'
import {
	type LeaderboardRange,
	useMarketMakerBreakdown,
	useMarketMakerDetail,
	useMarketMakerPerformance
} from './client'
import { ConnectDialog } from './ConnectDialog'
import { countryFromCode } from './country'
import { Drawer } from './Drawer'
import { roundPercentile } from './format'
import { type RadarScores } from './RadarChart'
import { forgdCtaPrimaryButtonStyles, forgdCtaSecondaryButtonStyles } from './styles'

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
const FOCUS_SCROLL_DURATION_MS = 1400

function scrollParentOf(el: HTMLElement): HTMLElement | null {
	let node = el.parentElement
	while (node) {
		const { overflowY } = getComputedStyle(node)
		if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
		node = node.parentElement
	}
	return null
}

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function animateScrollTo(target: HTMLElement, duration: number): () => void {
	const parent = scrollParentOf(target)
	if (!parent) {
		target.scrollIntoView()
		return () => {}
	}
	const from = parent.scrollTop
	const to = Math.min(
		from + target.getBoundingClientRect().top - parent.getBoundingClientRect().top - 8,
		parent.scrollHeight - parent.clientHeight
	)
	let frame = 0
	let startedAt: number | null = null
	const step = (now: number) => {
		if (startedAt == null) startedAt = now
		const progress = Math.min(1, (now - startedAt) / duration)
		parent.scrollTop = from + (to - from) * easeInOutCubic(progress)
		if (progress < 1) frame = requestAnimationFrame(step)
	}
	frame = requestAnimationFrame(step)
	return () => cancelAnimationFrame(frame)
}
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
	{ key: 'trustIntegration', label: 'Trust' },
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

function WebsiteButton({ href, name }: { href: string; name: string }) {
	return (
		<Button
			as={BasicLink}
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			size="md"
			data-umami-event="market-maker-website-click"
			data-umami-event-mm={name}
			data-umami-event-placement="drawer"
			data-umami-event-url={href}
		>
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

function ClaimBanner({ onClaim }: { onClaim: () => void }) {
	return (
		<section className="flex gap-3 rounded-lg bg-brand p-4">
			<Icon name="shield-check" height={24} width={24} className="mt-0.5 shrink-0 text-on-brand" />
			<div className="flex flex-col gap-2">
				<h3 className="text-base font-semibold text-on-brand">Claim this organization</h3>
				<p className="text-sm leading-relaxed text-on-brand/70">
					Claimed organizations have a better chance to improve the leaderboard score. Join Forgd today, complete your
					profile details, and start tracking your activity.
				</p>
				<button type="button" onClick={onClaim} className={`${forgdCtaSecondaryButtonStyles} mt-1`}>
					Claim Organization
				</button>
			</div>
		</section>
	)
}

function DrawerBody({
	open,
	marketMakerId,
	range,
	badge,
	fallbackName,
	focusSection,
	onOpenLead
}: {
	open: boolean
	marketMakerId: string | null
	range: LeaderboardRange
	badge: string
	fallbackName?: string
	focusSection?: keyof BreakdownSections
	onOpenLead: (kind: 'connect' | 'claim') => void
}) {
	const detail = useMarketMakerDetail(marketMakerId, open)
	const breakdown = useMarketMakerBreakdown(marketMakerId, range, open)
	const performance = useMarketMakerPerformance(marketMakerId, range, open)

	const isPending = detail.isPending || breakdown.isPending || performance.isPending
	const bodyRef = useRef<HTMLDivElement | null>(null)
	useEffect(() => {
		if (!open || isPending || !focusSection) return
		let cancelScroll = () => {}
		const frame = requestAnimationFrame(() => {
			const target = bodyRef.current?.querySelector<HTMLElement>(`[data-breakdown-section="${focusSection}"]`)
			if (target) cancelScroll = animateScrollTo(target, FOCUS_SCROLL_DURATION_MS)
		})
		return () => {
			cancelAnimationFrame(frame)
			cancelScroll()
		}
	}, [open, isPending, focusSection, marketMakerId])

	if (isPending) {
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
		<div ref={bodyRef} className="flex flex-col gap-6 p-4">
			<section className="flex flex-col gap-3">
				<div className="flex items-center gap-2">
					{logo ? <TokenLogo src={logo} size={28} alt={name} /> : null}
					<h3 className="heading-xs">About {name}</h3>
				</div>
				<p className="body-sm text-secondary">{description}</p>
				<div className="flex flex-wrap items-center gap-2">
					<StatusBadge status={status ?? 'none'} label={integrationLabel(status)} className="h-8 px-3" />
					{country ? <SecondaryBadge className="h-8">{`HQ: ${country.flag} ${country.name}`}</SecondaryBadge> : null}
					{website ? <WebsiteButton href={website} name={name} /> : null}
				</div>
				<button type="button" className={forgdCtaPrimaryButtonStyles} onClick={() => onOpenLead('connect')}>
					Connect with {name}
					<Icon name="arrow-right" height={14} width={14} />
				</button>
				{(status ?? 'none') === 'none' ? <ClaimBanner onClaim={() => onOpenLead('claim')} /> : null}
			</section>

			<section className="-mt-3 flex flex-col gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<h3 className="heading-xs">Leaderboards Performance</h3>
					<TimeframeBadge label={badge} />
				</div>
				<RadarChart scores={scores} />
				<div className={`flex flex-col p-3 ${CARD_BORDER}`}>
					{SCORE_ROWS.map((row) => (
						<div key={row.key} className="flex h-8 items-center justify-between text-sm">
							<span className="text-secondary">{row.label}</span>
							<span className="font-medium">
								{formatNumber(scores[row.key] ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/10.00
							</span>
						</div>
					))}
				</div>
			</section>

			<section className="flex flex-col gap-3">
				{BOARD_CARDS.map((card) => {
					const rank = asDict(b[card.rankKey])
					const percentile = roundPercentile(asNum(rank.percentile))
					const rankValue = asNum(rank.value)
					const percentileLabel =
						percentile == null ? NA : formatPercent(percentile, { input: 'percent', maximumFractionDigits: 0 })
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
									Outperformed {percentileLabel} of their peers {card.suffix}
								</p>
							</div>
							<div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end sm:gap-1">
								<SecondaryBadge>Percentile: {percentileLabel}</SecondaryBadge>
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
					<span className="text-xl font-bold">{avgFdv == null ? FALLBACK : formatUsd(Math.round(avgFdv))}</span>
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
	badge,
	focusSection
}: {
	open: boolean
	onClose: () => void
	marketMakerId: string | null
	fallbackName?: string
	range: LeaderboardRange
	badge: string
	focusSection?: keyof BreakdownSections
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
	const logo = asStr(asDict(detail.data).imageUrl)

	const [leadDialog, setLeadDialog] = useState<'connect' | 'claim' | null>(null)
	useEffect(() => {
		if (!open) setLeadDialog(null)
	}, [open])

	return (
		<>
			<Drawer
				open={open}
				onClose={onClose}
				title={title}
				widthClassName="sm:max-w-2xl"
				dismissible={leadDialog == null}
			>
				<DrawerBody
					open={open}
					marketMakerId={id}
					range={range}
					badge={badge}
					fallbackName={name}
					focusSection={focusSection}
					onOpenLead={setLeadDialog}
				/>
			</Drawer>
			<ConnectDialog
				open={leadDialog === 'connect'}
				onClose={() => setLeadDialog(null)}
				marketMakerId={id}
				marketMakerName={title}
			/>
			<ClaimDialog
				open={leadDialog === 'claim'}
				onClose={() => setLeadDialog(null)}
				marketMakerId={id}
				marketMakerName={title}
				marketMakerLogo={logo}
			/>
		</>
	)
}
