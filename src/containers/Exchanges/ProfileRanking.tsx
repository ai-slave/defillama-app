import { Fragment } from 'react'
import { Card } from '~/ui/Card'
import { Tooltip } from '~/ui/Tooltip'
import { formatUsd } from '~/utils/numberFormat'
import { formatScore, TIER_COLORS, TierBadge } from './directoryColumns'
import type { ExchangeExecutionModel, ExchangeProfileModel, ExchangeProfileQualityModel } from './models'

// Score → hue: 0 red, ~50 amber, 100 green. Moderate saturation so the fills sit
// comfortably on both themes.
const scoreColor = (score: number) => `hsl(${Math.round(Math.max(0, Math.min(100, score)) * 1.2)}, 55%, 42%)`

// Fixed public bands: S ≥85 (requires measured execution), A ≥70, B ≥55, C ≥40, else D.
const TIER_BANDS = [
	{ tier: 'D', from: 0, to: 40 },
	{ tier: 'C', from: 40, to: 55 },
	{ tier: 'B', from: 55, to: 70 },
	{ tier: 'A', from: 70, to: 85 },
	{ tier: 'S', from: 85, to: 100 }
]

/** The 0–100 tier scale with a marker at the venue's score, so the bands and where
 * the venue sits in them read at a glance. */
export function TierScale({ score, tier }: { score: number; tier: string | null }) {
	return (
		<Tooltip
			content={`Fixed bands on the 0 to 100 score: D below 40, C 40+, B 55+, A 70+, S 85+ (S also requires measured execution). The marker is this venue's score, ${formatScore(score)}.`}
			className="w-full"
		>
			<span className="relative flex h-5 w-full overflow-hidden rounded-sm">
				{TIER_BANDS.map((band) => (
					<span
						key={band.tier}
						className="flex items-center justify-center mono-sm-bold text-on-brand"
						style={{
							width: `${band.to - band.from}%`,
							backgroundColor: TIER_COLORS[band.tier],
							opacity: tier === band.tier ? 1 : 0.25
						}}
					>
						{band.tier}
					</span>
				))}
				<span
					className="absolute top-0 h-full w-0.5 rounded-full bg-current"
					style={{ left: `calc(${Math.max(1, Math.min(99, score))}% - 1px)` }}
				/>
			</span>
		</Tooltip>
	)
}

function PillarRow({ pillar }: { pillar: ExchangeProfileQualityModel['components'][number] }) {
	const score = pillar.score
	const measured = score !== null
	return (
		<div className="flex items-center gap-3">
			<Tooltip
				content={measured ? pillar.what : `Not measured, never counted as zero. ${pillar.na}`}
				className="w-40 shrink-0"
			>
				<span className="flex items-baseline gap-1.5 underline decoration-dotted">
					<span className="label-sm">{pillar.label}</span>
					<span className="body-sm text-tertiary">{pillar.weight}%</span>
				</span>
			</Tooltip>
			<div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-elevated-2">
				<div
					className="h-full rounded-full"
					style={{
						width: `${measured ? Math.max(2, Math.min(100, score)) : 0}%`,
						backgroundColor: measured ? scoreColor(score) : undefined
					}}
				/>
			</div>
			<span
				className={`w-24 shrink-0 text-right label-sm ${measured ? 'font-semibold' : 'text-tertiary'}`}
				style={measured ? { color: scoreColor(score) } : undefined}
			>
				{measured ? Math.round(score) : 'not measured'}
			</span>
		</div>
	)
}

const usd = (bps: number | null) =>
	bps == null ? 'n/a' : formatUsd(bps, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** The measured figure behind each execution sub-score (1bp of $10k = $1). */
function execSubFigure(key: string, execution: ExchangeExecutionModel | null): string | null {
	if (!execution) return null
	if (key === 'cost' && execution.costToTradeBps != null) return `${usd(execution.costToTradeBps)} /$10k`
	if (key === 'slip' && execution.realizedSlippage10kBps != null) {
		const predicted = execution.predictedSlippage10kBps
		return `${predicted == null ? '' : `p ${usd(predicted)} → `}${usd(execution.realizedSlippage10kBps)} /$10k`
	}
	if (key === 'markout' && execution.markout1mBps != null) {
		const value = execution.markout1mBps
		return `${formatUsd(value, { signDisplay: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 })} /$10k at 1m`
	}
	return null
}

function ExecSubRow({
	sub,
	share,
	figure
}: {
	sub: ExchangeProfileQualityModel['execSubs'][number]
	share: number | null
	figure: string | null
}) {
	const score = sub.score
	const measured = score !== null
	return (
		<div className="flex items-center gap-3 pl-6">
			<Tooltip content={sub.what} className="w-[8.5rem] shrink-0">
				<span className="flex items-baseline gap-1.5 underline decoration-dotted">
					<span className="body-sm">{sub.label}</span>
					{share ? <span className="body-sm text-tertiary">{share}%</span> : null}
				</span>
			</Tooltip>
			<div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-elevated-2">
				<div
					className="h-full rounded-full opacity-70"
					style={{
						width: `${measured ? Math.max(2, Math.min(100, score)) : 0}%`,
						backgroundColor: measured ? scoreColor(score) : undefined
					}}
				/>
			</div>
			<span className={`w-10 shrink-0 text-right body-sm ${measured ? '' : 'text-tertiary'}`}>
				{measured ? Math.round(score) : 'n/a'}
			</span>
			<span className="w-44 shrink-0 truncate text-right body-sm text-tertiary">{figure ?? ''}</span>
		</div>
	)
}

/** "Why this rank": the venue's quality score, its positions, the tier scale, and the
 * pillar breakdown. Every number measured or independently verifiable, nothing
 * editorial beyond the disclosed reach estimate inside the score itself. */
export function ProfileRanking({ profile }: { profile: ExchangeProfileModel }) {
	const quality = profile.quality
	if (!quality) return null
	let subWeightTotal = 0
	for (const sub of quality.execSubs) subWeightTotal += sub.weight
	return (
		<Card padding="sm" className="flex flex-col gap-5">
			<div className="flex flex-col gap-6 md:flex-row md:items-start">
				<div className="flex w-full shrink-0 flex-col gap-3 md:w-64">
					<Tooltip
						content={`Composite of the weighted pillar scores on a 0 to 100 scale.${quality.generatedAt ? ` Last computed ${quality.generatedAt}.` : ''}`}
						className="w-fit"
					>
						<span className="flex items-end gap-3">
							<TierBadge tier={quality.tier} />
							<span className="font-jetbrains text-4xl leading-none font-semibold">{formatScore(quality.score)}</span>
							<span className="pb-0.5 body-sm text-secondary">/ 100</span>
						</span>
					</Tooltip>
					<TierScale score={quality.score} tier={quality.tier} />
					<span className="body-sm text-secondary">
						Ranked <b>#{quality.rankInKind}</b> of {profile.kind.toUpperCase()}s · <b>#{quality.overallRank}</b> of{' '}
						{quality.overallTotal} overall
					</span>
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					{quality.components.map((pillar) => (
						<Fragment key={pillar.key}>
							<PillarRow pillar={pillar} />
							{pillar.key === 'E' &&
								quality.execSubs.map((sub) => (
									<ExecSubRow
										key={`E:${sub.key}`}
										sub={sub}
										share={
											sub.weight > 0 && subWeightTotal > 0 ? Math.round((sub.weight / subWeightTotal) * 100) : null
										}
										figure={execSubFigure(sub.key, profile.execution)}
									/>
								))}
						</Fragment>
					))}
				</div>
			</div>
			<p className="body-sm text-tertiary">
				Built only on what we can measure or independently verify: order-book depth we snapshot ourselves, volume that
				survives verification against those books, on-chain or attested reserves, open interest backed by them,
				execution quality measured from tick-level fills, and how steadily it all holds. Inputs we could not measure
				never count as zero; their weight redistributes. The indented rows split the Execution pillar into its
				sub-metrics, each with its peer-relative score and the measured figure behind it. Experimental; weights will
				move.
			</p>
		</Card>
	)
}
