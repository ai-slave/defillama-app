import * as React from 'react'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tooltip } from '~/ui/Tooltip'
import { letterLogoDataUri } from '~/utils/icons'
import { byRealPillarOrder, TIER_COLORS, TierBadge } from './directoryColumns'
import { EXCHANGES_METHODOLOGY_URL, ExchangeDocsLinks } from './docsLinks'
import type {
	ExchangeRankingModel,
	ExchangeRankingPillarModel,
	ExchangeRankingRowModel,
	ExchangeRankingSubModel
} from './models'
import { scoreColor } from './ProfileRanking'

type KindFilter = 'all' | 'cex' | 'dex'

const KIND_OPTIONS = [
	{ value: 'all', label: 'All' },
	{ value: 'cex', label: 'CEX' },
	{ value: 'dex', label: 'DEX' }
] as const

// Fixed public bands, restated here for the legend. S also requires measured execution.
const TIER_BANDS = [
	{ tier: 'S', from: 85, label: '85+' },
	{ tier: 'A', from: 70, label: '70+' },
	{ tier: 'B', from: 55, label: '55+' },
	{ tier: 'C', from: 40, label: '40+' },
	{ tier: 'D', from: 0, label: 'below 40' }
] as const

/** A 0–100 score as a thin bar plus the rounded number; "n/a" when not measured. */
function ScoreBar({ score, emphasis = false }: { score: number | null; emphasis?: boolean }) {
	const measured = score !== null
	return (
		<span className="flex items-center gap-2">
			<span
				className={`${emphasis ? 'h-2' : 'h-1.5'} w-16 shrink-0 overflow-hidden rounded-full bg-surface-elevated-2`}
			>
				<span
					className="block h-full rounded-full"
					style={{
						width: `${measured ? Math.max(2, Math.min(100, score)) : 0}%`,
						backgroundColor: measured ? scoreColor(score) : undefined
					}}
				/>
			</span>
			<span
				className={`w-7 text-right tabular-nums ${emphasis ? 'title-md' : ''} ${measured ? '' : 'text-tertiary'}`}
				style={measured && emphasis ? { color: scoreColor(score) } : undefined}
			>
				{measured ? Math.round(score) : 'n/a'}
			</span>
		</span>
	)
}

function TierLegend() {
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
			{TIER_BANDS.map((band) => (
				<span key={band.tier} className="flex items-center gap-1.5 body-sm text-secondary">
					<TierBadge tier={band.tier} />
					{band.label}
				</span>
			))}
			<span className="body-sm text-tertiary">S also requires measured execution.</span>
		</div>
	)
}

function SubScoreRows({
	title,
	subs,
	scores,
	extra
}: {
	title: string
	subs: Array<ExchangeRankingSubModel>
	scores: Record<string, number | null> | null
	extra?: React.ReactNode
}) {
	if (!scores || subs.length === 0) return null
	return (
		<div className="flex min-w-0 flex-1 flex-col gap-1.5">
			<span className="label-sm text-secondary">{title}</span>
			{subs.map((sub) => (
				<div key={sub.key} className="flex items-center justify-between gap-3">
					<Tooltip content={sub.what} className="min-w-0">
						<span className="truncate body-sm underline decoration-dotted">
							{sub.label} <span className="text-tertiary">{sub.weight}</span>
						</span>
					</Tooltip>
					<ScoreBar score={scores[sub.key] ?? null} />
				</div>
			))}
			{extra}
		</div>
	)
}

function RankingRow({
	row,
	pillars,
	ranking,
	expanded,
	onToggle
}: {
	row: ExchangeRankingRowModel
	pillars: Array<ExchangeRankingPillarModel>
	ranking: ExchangeRankingModel
	expanded: boolean
	onToggle: () => void
}) {
	const hasDetail = row.execSubs !== null || row.reserveSubs !== null
	return (
		<>
			<tr className="border-t border-subtle">
				<td className="py-2 pr-2 text-right text-tertiary tabular-nums">{row.overallRank}</td>
				<td className="py-2 pr-3">
					<span className="flex items-center gap-2">
						<TokenLogo
							name={row.slug}
							kind="exchange"
							size={22}
							fallbackSrc={letterLogoDataUri(row.name)}
							alt={`${row.name} logo`}
						/>
						<BasicLink href={row.profileHref} className="truncate label-md text-link hover:underline">
							{row.name}
						</BasicLink>
						<span className="body-sm text-tertiary uppercase">{row.kind}</span>
					</span>
				</td>
				<td className="py-2 pr-3">
					<TierBadge tier={row.tier} />
				</td>
				<td className="py-2 pr-4">
					<ScoreBar score={row.score} emphasis />
				</td>
				{pillars.map((pillar) => (
					<td key={pillar.key} className="py-2 pr-4">
						<ScoreBar score={row.components[pillar.key] ?? null} />
					</td>
				))}
				<td className="py-2 text-right">
					{hasDetail ? (
						<button
							type="button"
							onClick={onToggle}
							aria-expanded={expanded}
							aria-label={`${expanded ? 'Hide' : 'Show'} sub-scores for ${row.name}`}
							className="rounded-sm p-1 text-tertiary hover:bg-surface-elevated-1 hover:text-primary"
						>
							<Icon name={expanded ? 'chevron-up' : 'chevron-down'} height={14} width={14} />
						</button>
					) : null}
				</td>
			</tr>
			{expanded ? (
				<tr className="bg-surface-elevated-1">
					<td />
					<td colSpan={4 + pillars.length} className="px-2 py-3">
						<div className="flex flex-col gap-4 md:flex-row md:gap-10">
							<SubScoreRows title="Reserves sub-scores" subs={ranking.reserveSubs} scores={row.reserveSubs} />
							<SubScoreRows
								title="Execution sub-scores"
								subs={ranking.execSubs}
								scores={row.execSubs}
								extra={
									row.execDelivery !== null ? (
										<div className="flex items-center justify-between gap-3">
											<Tooltip
												content="Did fills pay what the book promised at that size? 100 means at or better than quoted; a shortfall cuts Execution by up to 12%."
												className="min-w-0"
											>
												<span className="truncate body-sm underline decoration-dotted">Delivery vs quote</span>
											</Tooltip>
											<ScoreBar score={row.execDelivery} />
										</div>
									) : null
								}
							/>
						</div>
					</td>
				</tr>
			) : null}
		</>
	)
}

/** Best, typical and lowest scorer on one pillar, from the venues that were measured on
 * it. Pure data: whoever the numbers say, never an editorial pick. */
function pillarExamples(rows: Array<ExchangeRankingRowModel>, key: string) {
	const measured = rows
		.filter((row) => row.components[key] != null)
		.sort((a, b) => (b.components[key] ?? 0) - (a.components[key] ?? 0))
	if (measured.length < 3) return null
	return {
		best: measured[0],
		typical: measured[Math.floor(measured.length / 2)],
		lowest: measured[measured.length - 1]
	}
}

function ExampleChip({ label, row, pillarKey }: { label: string; row: ExchangeRankingRowModel; pillarKey: string }) {
	const score = row.components[pillarKey] ?? 0
	return (
		<span className="flex items-center gap-2 rounded-md bg-surface-elevated-1 px-2.5 py-1.5">
			<span className="body-sm text-tertiary">{label}</span>
			<TokenLogo
				name={row.slug}
				kind="exchange"
				size={18}
				fallbackSrc={letterLogoDataUri(row.name)}
				alt={`${row.name} logo`}
			/>
			<BasicLink href={row.profileHref} className="label-sm text-link hover:underline">
				{row.name}
			</BasicLink>
			<span className="mono-sm-bold" style={{ color: scoreColor(score) }}>
				{Math.round(score)}
			</span>
		</span>
	)
}

function PillarSection({ pillar, ranking }: { pillar: ExchangeRankingPillarModel; ranking: ExchangeRankingModel }) {
	const examples = pillarExamples(ranking.rows, pillar.key)
	const subs = pillar.key === 'R' ? ranking.reserveSubs : pillar.key === 'E' ? ranking.execSubs : []
	return (
		<Card as="section" padding="md" className="flex flex-col gap-4" id={`pillar-${pillar.key}`}>
			<div className="flex flex-wrap items-baseline gap-3">
				<h3 className="heading-xs">
					<span className="pr-2 font-jetbrains font-bold text-tertiary">{pillar.key}</span>
					{pillar.label}
				</h3>
				<span className="rounded-sm bg-brand-muted px-2 py-0.5 mono-sm-bold text-primary">{pillar.weight} points</span>
			</div>
			<p className="body-md text-secondary">{pillar.what}</p>
			{subs.length > 0 ? (
				<ul className="flex flex-col gap-2 border-l-2 border-subtle pl-4">
					{subs.map((sub) => (
						<li key={sub.key} className="body-sm">
							<span className="label-sm">{sub.label}</span>{' '}
							<span className="text-tertiary">
								{sub.weight}
								{pillar.key === 'R' ? ` of ${pillar.weight}` : ''}
							</span>
							<span className="text-secondary">: {sub.what}</span>
						</li>
					))}
				</ul>
			) : null}
			<p className="body-sm text-tertiary">
				<b>When it is missing:</b> {pillar.na}
			</p>
			{examples ? (
				<div className="flex flex-wrap gap-2">
					<ExampleChip label="Best" row={examples.best} pillarKey={pillar.key} />
					<ExampleChip label="Typical" row={examples.typical} pillarKey={pillar.key} />
					<ExampleChip label="Lowest" row={examples.lowest} pillarKey={pillar.key} />
				</div>
			) : null}
		</Card>
	)
}

export function ExchangeRanking({ ranking }: { ranking: ExchangeRankingModel | null }) {
	const [kind, setKind] = React.useState<KindFilter>('all')
	const [expanded, setExpanded] = React.useState<string | null>(null)
	if (!ranking) {
		return (
			<Card padding="md" className="body-md text-secondary">
				The ranking is being recomputed and will be back shortly.
			</Card>
		)
	}
	const pillars = [...ranking.pillars].sort((a, b) => byRealPillarOrder(a.key, b.key))
	const rows = kind === 'all' ? ranking.rows : ranking.rows.filter((row) => row.kind === kind)
	const insufficient = kind === 'all' ? ranking.insufficient : ranking.insufficient.filter((v) => v.kind === kind)
	return (
		<div className="flex flex-col gap-4">
			<Card padding="md" className="flex flex-col gap-3">
				{/* The four pillars spell the name: whatever the backend labels them, the keys are R, E, A, L. */}
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<h2 className="heading-sm">REAL Ranking</h2>
					<p className="label-sm text-tertiary">Reserves · Execution · Activity · Liquidity</p>
				</div>
				<p className="body-md text-secondary">
					One score per exchange, built only on what we can measure or verify: reserves, execution from real fills,
					volume and open interest the venue&apos;s own order book could support, and the depth we observed. Volume
					alone is easy to inflate, so every pillar is something a venue cannot print. A low pillar means weak
					measurable evidence, not misconduct.
				</p>
				<div className="flex flex-wrap items-center gap-2">
					{pillars.map((pillar) => (
						<a
							key={pillar.key}
							href={`#pillar-${pillar.key}`}
							className="flex items-center gap-1.5 rounded-md border border-subtle px-2.5 py-1 hover:bg-surface-elevated-1"
						>
							<span className="mono-sm-bold text-link">{pillar.key}</span>
							<span className="label-sm">{pillar.label}</span>
							<span className="mono-sm-bold text-secondary">{pillar.weight}</span>
						</a>
					))}
					<span className="body-sm text-tertiary">points out of 100 · weights redistribute over measured pillars</span>
				</div>
				<TierLegend />
				<ExchangeDocsLinks />
			</Card>

			<Card padding="sm" className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-2 px-1">
					<SegmentedControl<KindFilter>
						value={kind}
						onValueChange={setKind}
						options={KIND_OPTIONS}
						label="Exchange kind"
						variant="default"
						size="md"
					/>
					<span className="body-sm text-tertiary">
						{rows.length} exchanges scored · computed {ranking.generatedAt}
					</span>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full min-w-[56rem] border-collapse text-left">
						<thead>
							<tr className="body-sm text-tertiary">
								<th className="pr-2 pb-1 text-right font-normal">#</th>
								<th className="pr-3 pb-1 font-normal">Exchange</th>
								<th className="pr-3 pb-1 font-normal">Tier</th>
								<th className="pr-4 pb-1 font-normal">Score</th>
								{pillars.map((pillar) => (
									<th key={pillar.key} className="pr-4 pb-1 font-normal">
										<Tooltip content={pillar.what}>
											<span className="underline decoration-dotted">
												{pillar.label} {pillar.weight}
											</span>
										</Tooltip>
									</th>
								))}
								<td className="pb-1" />
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<RankingRow
									key={row.slug}
									row={row}
									pillars={pillars}
									ranking={ranking}
									expanded={expanded === row.slug}
									onToggle={() => setExpanded(expanded === row.slug ? null : row.slug)}
								/>
							))}
						</tbody>
					</table>
				</div>
				{insufficient.length > 0 ? (
					<p className="px-1 body-sm text-tertiary">
						Not ranked, no observed order book:{' '}
						{insufficient.map((venue, index) => (
							<React.Fragment key={venue.slug}>
								{index > 0 ? ', ' : ''}
								<BasicLink href={venue.profileHref} className="text-link hover:underline">
									{venue.name}
								</BasicLink>
							</React.Fragment>
						))}
						.
					</p>
				) : null}
			</Card>

			<h2 className="px-1 pt-2 heading-sm">How the REAL score is built</h2>
			<Card padding="md" className="flex flex-col gap-2 body-md text-secondary">
				<p>
					REAL is a weighted mean of four 0 to 100 pillars. Size is log-scaled, so a venue a tenth the size of the
					leader still scores about 70. Each credibility check lowers the pillar whose data it questions, an input we
					cannot measure hands its weight to the pillars we did, and CEX and DEX are ranked within their own type.
					Nothing self-reported that we cannot check enters the score.
				</p>
				<p>
					The full method, every check and its thresholds:{' '}
					<a
						href={EXCHANGES_METHODOLOGY_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="text-link hover:underline"
					>
						Exchanges methodology
					</a>
					.
				</p>
			</Card>
			{pillars.map((pillar) => (
				<PillarSection key={pillar.key} pillar={pillar} ranking={ranking} />
			))}

			<Card as="section" padding="md" className="flex flex-col gap-3">
				<h3 className="heading-xs">Tiers</h3>
				<div className="relative flex h-6 w-full overflow-hidden rounded-sm">
					{[...TIER_BANDS].reverse().map((band, index, all) => {
						const next = all[index + 1]
						const width = (next ? next.from : 100) - band.from
						return (
							<span
								key={band.tier}
								className="flex items-center justify-center mono-sm-bold text-on-brand"
								style={{ width: `${width}%`, backgroundColor: TIER_COLORS[band.tier] }}
							>
								{band.tier}
							</span>
						)
					})}
				</div>
				<p className="body-md text-secondary">
					Fixed bands on the 0 to 100 score, not quantiles, so a new listing does not reshuffle everyone. S also
					requires a measured execution pillar: the top grade cannot be earned from displayed data alone. A venue with
					no observed order book is not ranked rather than scored low.
				</p>
			</Card>

			<p className="px-1 body-sm text-tertiary">
				Scores are recomputed after listings or material data changes, reviewed, then published. Every venue&apos;s
				pillar breakdown is on its profile. The ranking, its pillars and their weights are subject to change as coverage
				improves.
			</p>
			<ExchangeDocsLinks className="px-1 pb-2" />
		</div>
	)
}
