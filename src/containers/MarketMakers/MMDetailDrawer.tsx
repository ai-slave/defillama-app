import { useMutation } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { type ComponentProps, useState } from 'react'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Button } from '~/ui/Button'
import { DialogBody, DialogHeader, SideSheet } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { formatUsd, formatNumber, formatPercent } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { AccentBadge, SecondaryBadge, StatusBadge } from './badges'
import { BreakdownTables } from './BreakdownTable'
import { ClaimDialog } from './ClaimDialog'
import {
	type LeaderboardRange,
	type LeadKind,
	requestLeadClickId,
	useMarketMakerBreakdown,
	useMarketMakerDetail,
	useMarketMakerPerformance
} from './client'
import { ConnectDialog } from './ConnectDialog'
import { countryFromCode } from './country'
import { roundPercentile } from './format'
import type { RadarScores } from './RadarChart'
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
const CARD_BORDER = 'rounded-lg border border-subtle bg-surface'
const EMPTY_SECTIONS = { depth: {}, volume: {}, spread: {}, kpi: {} }

const INTEGRATION_LABEL: Record<'full' | 'partial' | 'none', string> = {
	full: 'Fully integrated',
	partial: 'Partially integrated',
	none: 'None'
}

function integrationLabel(status: string | null): string {
	return INTEGRATION_LABEL[(status ?? 'none') as 'full' | 'partial' | 'none'] ?? INTEGRATION_LABEL.none
}

const SCORE_ROWS: Array<{ key: keyof RadarScores; label: string }> = [
	{ key: 'composite', label: 'Composite Score' },
	{ key: 'tradingKpis', label: 'Trading KPIs' },
	{ key: 'trustIntegration', label: 'Trust' },
	{ key: 'coverageCapabilities', label: 'Coverage & Capabilities' },
	{ key: 'uptime', label: 'Uptime' },
	{ key: 'integrationLevel', label: 'Integration Level' }
]

const BOARD_CARDS: Array<{ rankKey: string; label: string; suffix: string; icon: IconName }> = [
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

function stringList(value: unknown): Array<string> {
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

function engagementOptionLabels(value: unknown): Array<string> {
	if (!Array.isArray(value)) return []
	return value
		.filter((slug): slug is string => typeof slug === 'string' && slug.length > 0)
		.map((slug) => ENGAGEMENT_OPTION_LABELS[slug] ?? titleCaseSlug(slug))
}

type Venue = { key: string; name: string; icon: string | null }

function venueList(value: unknown): Array<Venue> {
	if (!Array.isArray(value)) return []
	const venues: Array<Venue> = []
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
			size="sm"
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

function BadgeRow({ title, items }: { title: string; items: Array<string> }) {
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

function VenueSection({ title, venues }: { title: string; venues: Array<Venue> }) {
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

function BulletList({ title, items }: { title: string; items: Array<string> }) {
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
			<VenueSection title="Major CEXs supported" venues={cexs} />
			<VenueSection title="Major DEXs supported" venues={dexs} />
			<BulletList title="Ancillary services offered" items={ancillary} />
		</>
	)
}

function ClaimBanner({ onClaim }: { onClaim: () => void }) {
	return (
		<section className="flex gap-3 rounded-lg bg-brand p-4">
			<Icon name="shield-check" height={24} width={24} className="mt-0.5 shrink-0 text-on-brand" />
			<div className="flex flex-col gap-2">
				<h3 className="label-lg text-on-brand">Claim this organization</h3>
				<p className="body-md text-on-brand">
					Claimed organizations have a better chance to improve the leaderboard score. Join Forgd today, complete your
					profile details, and start tracking your activity.
				</p>
				<button type="button" onClick={onClaim} className={`${forgdCtaSecondaryButtonStyles} mt-1`}>
					Claim organization
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
	onOpenLead
}: {
	open: boolean
	marketMakerId: string | null
	range: LeaderboardRange
	badge: string
	fallbackName?: string
	onOpenLead: (kind: 'connect' | 'claim') => void
}) {
	const detail = useMarketMakerDetail(marketMakerId, open)
	const breakdown = useMarketMakerBreakdown(marketMakerId, range, open)
	const performance = useMarketMakerPerformance(marketMakerId, range, open)

	// Any one of the three missing would show fallbacks and 0.00 scores as if they were this market maker's data.
	const failedQueries = [detail, breakdown, performance].filter(queryReadFailed)
	if (failedQueries.length > 0) {
		const retry = () => {
			for (const query of failedQueries) void query.refetch()
		}
		return (
			<SurfaceBodyStatus variant="error" contentClassName="flex flex-col items-center gap-3">
				<p>Could not load this market maker.</p>
				<Button
					type="button"
					size="sm"
					onClick={retry}
					pendingLabel={failedQueries.some((query) => query.isFetching) ? 'Retrying…' : null}
				>
					Try again
				</Button>
			</SurfaceBodyStatus>
		)
	}
	if (detail.isPending || breakdown.isPending || performance.isPending) return <SurfaceBodyLoadingStatus />

	const d = asDict(detail.data)
	const p = asDict(performance.data)
	const name = asStr(d.name) ?? fallbackName ?? marketMakerId ?? 'Market maker'
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
					{/* Chips and a small link level at 24px; a 32px pin broke once md buttons grew in phone sheets. */}
					<StatusBadge status={status ?? 'none'} label={integrationLabel(status)} className="min-h-6 px-2.5" />
					{country ? (
						<SecondaryBadge className="min-h-6">{`HQ: ${country.flag} ${country.name}`}</SecondaryBadge>
					) : null}
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
					<h3 className="heading-xs">Leaderboards performance</h3>
					<AccentBadge className="h-6">{badge}</AccentBadge>
				</div>
				<RadarChart scores={scores} />
				<div className={`flex flex-col p-3 ${CARD_BORDER}`}>
					{SCORE_ROWS.map((row) => (
						<div key={row.key} className="flex h-8 items-center justify-between">
							<span className="body-md text-secondary">{row.label}</span>
							<span className="label-md">
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
								<h4 className="flex items-center gap-2 label-md">
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
					<span className="heading-sm">{activeEngagements == null ? FALLBACK : activeEngagements}</span>
				</div>
				<div className={`flex min-h-20 flex-col justify-center gap-1 p-4 ${CARD_BORDER}`}>
					<span className="body-sm text-secondary">Avg. FDV of projects in Forgd</span>
					<span className="heading-sm">{avgFdv == null ? FALLBACK : formatUsd(Math.round(avgFdv))}</span>
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
	// Both callers clear the id and the name together.
	const [last, setLast] = useState({ marketMakerId, fallbackName })
	if (marketMakerId !== null && (last.marketMakerId !== marketMakerId || last.fallbackName !== fallbackName)) {
		setLast({ marketMakerId, fallbackName })
	}

	const id = marketMakerId ?? last.marketMakerId
	const name = marketMakerId !== null ? fallbackName : last.fallbackName
	const detail = useMarketMakerDetail(id, open)
	const title = asStr(asDict(detail.data).name) ?? name ?? id ?? 'Market maker'
	const logo = asStr(asDict(detail.data).imageUrl)

	const [leadDialog, setLeadDialog] = useState<LeadKind | null>(null)
	// The click that opens a lead form records one click id for that opening, sent or not.
	const leadClick = useMutation({
		mutationFn: (lead: { kind: LeadKind; marketMakerId: string | null }) =>
			requestLeadClickId(lead.kind, lead.marketMakerId)
	})
	const openLead = (kind: LeadKind) => {
		setLeadDialog(kind)
		leadClick.mutate({ kind, marketMakerId: id })
	}
	const clickId = leadClick.data ?? null

	return (
		<>
			<SideSheet
				size="md"
				canvas
				open={open}
				onClose={onClose}
				// A lead dialog on top owns Escape and outside taps until it closes.
				hideOnEscape={leadDialog == null}
				hideOnInteractOutside={leadDialog == null}
				portal
				unmountOnHide
			>
				<DialogHeader title={title} />
				<DialogBody kind="flush">
					<DrawerBody
						open={open}
						marketMakerId={id}
						range={range}
						badge={badge}
						fallbackName={name}
						onOpenLead={openLead}
					/>
				</DialogBody>
			</SideSheet>
			<ConnectDialog
				open={leadDialog === 'connect'}
				onClose={() => setLeadDialog(null)}
				marketMakerId={id}
				marketMakerName={title}
				clickId={clickId}
			/>
			<ClaimDialog
				open={leadDialog === 'claim'}
				onClose={() => setLeadDialog(null)}
				marketMakerId={id}
				marketMakerName={title}
				marketMakerLogo={logo}
				clickId={clickId}
			/>
		</>
	)
}
