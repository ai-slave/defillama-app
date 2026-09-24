import type { ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { Card } from '~/ui/Card'
import { RelativeTime } from '~/ui/RelativeTime'
import { Tooltip } from '~/ui/Tooltip'
import { formatCompactNumber, formatPercent, formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { hasPart } from '../domain/apyPresentation'
import { SealGlyph } from '../Tables/Measured'
import { YIELD_PERCENT_OPTIONS } from './format'
import type { ApyBreakdown, PoolSide, StabilityInfo } from './PoolDetailView'
import type { DetailHolders } from './types'
import { HOW_WE_VERIFY_ID } from './VerifiedApyPanel'
import type { MeasuredComposition, VerifiedSnapshotModel } from './VerifiedSnapshotCard'

type ApyKind = 'supply' | 'borrow'

interface ApyPart {
	key: string
	label: string
	value: string
	strong: boolean
	provenance?: string
}

export function apyParts(apy: ApyBreakdown, kind: ApyKind): Array<ApyPart> {
	const parts: Array<ApyPart> = []
	if (apy.base != null) {
		parts.push({
			key: 'base',
			label: kind === 'borrow' ? 'Base cost' : 'Base',
			value: formatPercent(apy.base, YIELD_PERCENT_OPTIONS),
			strong: false
		})
	}
	if (hasPart(apy.reward)) {
		const sign = kind === 'borrow' ? '−' : '+'
		const syms = apy.rewardTokens.length > 0 ? ` · ${apy.rewardTokens.join(', ')}` : ''
		parts.push({
			key: 'reward',
			label: `Reward${syms}`,
			value: `${sign}${formatPercent(Math.abs(apy.reward), YIELD_PERCENT_OPTIONS)}`,
			strong: true
		})
	}
	if (hasPart(apy.intrinsic)) {
		const src = apy.intrinsicSource ? ` · ${apy.intrinsicSource}` : ''
		parts.push({
			key: 'intrinsic',
			label: `Intrinsic${src}`,
			value: `+${formatPercent(Math.abs(apy.intrinsic), YIELD_PERCENT_OPTIONS)}`,
			strong: false
		})
	}
	return parts
}

/* Spans, not divs: the split sits inside an inline aside. */
function Split({ parts }: { parts: Array<ApyPart> }) {
	return (
		<span className="flex flex-col">
			{parts.map((part) => (
				<span
					key={part.key}
					className="flex min-h-6 flex-wrap items-baseline gap-1 border-b border-dashed border-subtle py-1 last:border-none"
				>
					<span className="body-md text-secondary">{part.label}</span>
					{part.provenance ? (
						<span
							className={`ml-auto w-[4.5rem] body-md ${part.provenance === 'verified' ? 'text-primary' : 'text-secondary'}`}
						>
							{part.provenance}
						</span>
					) : null}
					<span
						className={`${part.provenance ? 'mono-md' : 'ml-auto mono-md'}${part.strong ? ' text-(--yield-reward-text)' : ''}`}
					>
						{part.value}
					</span>
				</span>
			))}
		</span>
	)
}

/* `hug`: content width on wide rows, so the tiles beside it take the slack. */
function Cell({ className, hug = false, children }: { className?: string; hug?: boolean; children: ReactNode }) {
	return (
		<div
			className={`flex min-w-0 flex-col justify-center gap-1 border-b border-l border-subtle px-4 py-3 ${hug ? '' : '@min-[64rem]:flex-auto'} ${className ?? ''}`.trim()}
		>
			{children}
		</div>
	)
}

function Stat({
	label,
	tooltip,
	value,
	valueClassName = '',
	aside,
	children
}: {
	label: ReactNode
	tooltip?: string
	value: ReactNode
	valueClassName?: string
	/** The legs beside the headline. */
	aside?: ReactNode
	children?: ReactNode
}) {
	return (
		<span className="flex min-w-0 flex-col gap-1">
			{tooltip ? (
				<Tooltip content={tooltip} className="w-fit label-md text-secondary underline decoration-dotted">
					{label}
				</Tooltip>
			) : (
				<span className="label-md text-secondary">{label}</span>
			)}
			{/* Beside the figure where there is room; under it on a phone, where a tile is half the screen. */}
			<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
				<span className={`flex items-center gap-2 mono-xl whitespace-nowrap ${valueClassName || 'text-primary'}`}>
					{value}
				</span>
				{aside ? (
					<span className="basis-full border-subtle @min-[48rem]:shrink-0 @min-[48rem]:basis-auto @min-[48rem]:border-l @min-[48rem]:pl-4">
						{aside}
					</span>
				) : null}
			</span>
			{children ? <span className="body-sm text-secondary">{children}</span> : null}
		</span>
	)
}

function Tile(props: Parameters<typeof Stat>[0]) {
	return (
		<Cell>
			<Stat {...props} />
		</Cell>
	)
}

export function AnswerStrip({
	supply,
	borrow,
	stability,
	holders,
	snapshot,
	composition,
	verifiedAsOf,
	verifiedNote,
	hasRisk,
	poolId
}: {
	supply: PoolSide | null
	borrow: PoolSide | null
	stability: StabilityInfo | null
	holders: DetailHolders | null
	/** The measured reading, for a subscriber on a measured pool. */
	snapshot: VerifiedSnapshotModel | null
	composition: MeasuredComposition | null
	verifiedAsOf: string | null
	verifiedNote: string | null
	hasRisk: boolean
	poolId: string
}) {
	const measured = composition?.total ?? snapshot?.baseApy ?? null
	// A stale reading shows a tier down but never replaces the reported rate.
	const figure = measured ?? snapshot?.lastVerifiedApy ?? null
	const reportedParts =
		supply && (hasPart(supply.apy.reward) || hasPart(supply.apy.intrinsic)) ? apyParts(supply.apy, 'supply') : []

	const borrowParts = borrow && hasPart(borrow.apy.reward) ? apyParts(borrow.apy, 'borrow') : []

	const stabilityColor =
		stability?.rating === 'stable'
			? 'text-(--yield-positive-text)'
			: stability?.rating === 'volatile'
				? 'text-(--yield-negative-text)'
				: ''

	const holderCount = holders?.count ?? null

	return (
		<Card padding="none" className="overflow-hidden">
			<div className="-mb-px -ml-px grid grid-cols-2 @min-[48rem]:grid-cols-3 @min-[64rem]:flex @min-[64rem]:flex-wrap">
				{/* The reported tile only returns when there is no measured reading. */}
				{supply && snapshot ? (
					<Cell className="col-span-full gap-2" hug>
						{/* The product name is the figure's own label, so "APY" is never said twice. */}
						<Stat
							label={
								<span className="flex items-center gap-1.5 text-primary">
									<SealGlyph size={15} className={snapshot.current ? 'text-verified' : 'text-tertiary'} />
									{borrow ? 'Verified Supply APY' : 'Verified APY'}
								</span>
							}
							value={figure != null ? formatPercent(figure, YIELD_PERCENT_OPTIONS) : '—'}
							valueClassName={figure != null && !snapshot.current ? 'text-tertiary' : ''}
							aside={composition ? <Split parts={composition.parts} /> : null}
						>
							{figure == null && verifiedNote ? verifiedNote : null}
						</Stat>
						<span className="flex flex-wrap items-center gap-x-3 gap-y-1 body-sm text-tertiary">
							{verifiedAsOf ? (
								<RelativeTime
									value={verifiedAsOf}
									prefix={snapshot.current ? 'Measured' : 'Last measured'}
									className={snapshot.current ? '' : 'text-warning'}
								/>
							) : null}
							<a href={`#${HOW_WE_VERIFY_ID}`} className="ml-auto text-link hover:underline">
								How we verify
							</a>
						</span>
					</Cell>
				) : null}
				{supply && (!snapshot || measured == null) ? (
					<Tile
						label={supply.apyLabel}
						value={supply.apy.total == null ? '—' : formatPercent(supply.apy.total, YIELD_PERCENT_OPTIONS)}
						aside={reportedParts.length > 0 ? <Split parts={reportedParts} /> : null}
					/>
				) : null}

				{borrow ? (
					<Tile
						label={borrow.apyLabel}
						value={borrow.apy.total == null ? '—' : formatPercent(borrow.apy.total, YIELD_PERCENT_OPTIONS)}
						aside={borrowParts.length > 0 ? <Split parts={borrowParts} /> : null}
					/>
				) : null}

				{[...(supply?.metrics ?? []), ...(borrow?.metrics ?? [])].map((m) => (
					<Tile
						key={m.label}
						label={m.label}
						value={
							m.format === 'ltv'
								? (formatPercent(m.value, {
										input: 'fraction',
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									}) ?? '—')
								: (formatUsd(m.value, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '—')
						}
					/>
				))}

				{stability?.rating != null && stability.score != null ? (
					<Tile
						label="30d Stability"
						tooltip="How steady this pool's supply APY has been over the last 30 days."
						value={<span className="capitalize">{stability.rating}</span>}
						valueClassName={stabilityColor}
					/>
				) : null}

				{hasRisk ? (
					<Cell>
						<span className="label-md text-secondary">Risk</span>
						<BasicLink href={`/yields/pool/${poolId}/risk`} className="w-fit body-md text-link hover:underline">
							Full report
						</BasicLink>
					</Cell>
				) : null}

				{holderCount != null && holderCount > 0 ? (
					<Tile
						label="Holders"
						value={formatCompactNumber(holderCount, {
							compactSuffix: 'lowercase',
							...(holderCount >= 1e3 ? { minimumFractionDigits: 1, maximumFractionDigits: 1 } : {})
						})}
					/>
				) : null}
			</div>
		</Card>
	)
}
