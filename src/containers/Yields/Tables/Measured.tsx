// The seal, the padlock and the card behind them, all belonging to the earn table's APY cell.
// Unmeasured pools get nothing: a missing measurement is not a negative claim about the pool.
import { useRouter } from 'next/router'
import { Fragment, type ReactNode } from 'react'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { RelativeTime } from '~/ui/RelativeTime'
import { resolveVerifiedApy } from '../data/apy'
import { parseApyWindow } from '../data/query'
import type { ApyWindow, VerifiedBlock } from '../data/types'
import { exitFeeWarning } from '../domain/exitPresentation'
import { isVerifiedCurrent } from '../domain/verifiedFreshness'
import { useSubscribeProModal } from '../useSubscribeProModal'
import { useVerifiedAccess } from '../useVerifiedAccess'

// Each method is "signature — annotation". Split on the FIRST em-dash only: annotations
// themselves contain dashes, and the signature is always the head.
export function splitMethod(method: string): { signature: string; annotation: string | null } {
	const at = method.indexOf('—')
	if (at === -1) return { signature: method.trim(), annotation: null }
	return { signature: method.slice(0, at).trim(), annotation: method.slice(at + 1).trim() || null }
}

/** The verified mark: a filled scallop with the check knocked out in the surface color. */
export function SealGlyph({ size = 15, className = 'text-verified' }: { size?: number; className?: string }) {
	return (
		<svg viewBox="0 0 24 24" height={size} width={size} className={`shrink-0 ${className}`} aria-hidden>
			<polygon
				fill="currentColor"
				points="24,12 21.42,15.9 20.49,20.49 15.9,21.42 12,24 8.1,21.42 3.51,20.49 2.58,15.9 0,12 2.58,8.1 3.51,3.51 8.1,2.58 12,0 15.9,2.58 20.49,3.51 21.42,8.1"
			/>
			<path
				d="M7.6 12.3l2.9 2.9 6-6.1"
				fill="none"
				stroke="var(--bg-surface)"
				strokeWidth="2.3"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

/** Blue: the digits beside it ARE the measurement. Muted: the pool is measured, this window isn't. */
export function MeasuredSeal({ muted = false, size = 13 }: { muted?: boolean; size?: number }) {
	return (
		<span
			role="img"
			aria-label={
				muted
					? 'This pool is measured on-chain, but this APY window has no measurement'
					: "Verified: this APY was observed by simulating a real holder's withdrawal on-chain"
			}
			className="flex shrink-0"
		>
			<SealGlyph size={size} className={muted ? 'text-tertiary' : 'text-verified'} />
		</span>
	)
}

/**
 * The figure beside it is the reported one; the measured one is behind the subscription.
 * Tertiary wherever it marks a withheld number; inherit beside a redacted value, so it takes the
 * value's ink.
 */
export function MeasuredLock({
	size = 12,
	className,
	tone = 'tertiary',
	label = "This pool's verified APY is available on a Pro subscription"
}: {
	size?: number
	className?: string
	tone?: 'tertiary' | 'inherit'
	label?: string
}) {
	const color = tone === 'inherit' ? '' : 'text-tertiary'
	return (
		<Icon
			name="lock"
			height={size}
			width={size}
			aria-label={label}
			className={`shrink-0 ${color} ${className ?? ''}`.replace(/\s+/g, ' ').trim()}
		/>
	)
}

interface MeasuredOfferContent {
	headline: string
	detail: ReactNode
	label: string
	/** The provenance word beside the label, only where a reported counterpart exists to contrast with. */
	qualifier?: string
	redacted: string
	/** Further withheld figures, one per line. */
	extraRows?: Array<{ label: string; redacted: string }>
	cta: string
}

/** The claim, the shape of the withheld number, and one way to buy it, in its own tinted block. */
function MeasuredOffer({ onUpgrade, content }: { onUpgrade: () => void; content: MeasuredOfferContent }) {
	// A neutral wash, not the brand tint, so the blue is only the seal, badge and button. The seal is brand
	// here because this panel sells the tier; green is for the reader who already has it.
	// Nothing tertiary inside it: grey over the wash measures 4.15:1 dark and 4.43:1 light, under AA.
	return (
		<span className="flex flex-col gap-2 rounded-lg border border-medium bg-border-subtle px-3 py-2.5">
			<span className="flex items-center justify-between gap-3">
				<span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
					<SealGlyph size={15} />
					{content.headline}
				</span>
				<span className="shrink-0 rounded-md bg-brand-muted px-1.5 py-0.5 label-xs tracking-widest text-link">PRO</span>
			</span>
			<span className="flex items-baseline justify-between gap-6">
				<span className="text-secondary">
					{content.label}
					{content.qualifier ? (
						<>
							{' · '}
							<span className="text-primary">{content.qualifier}</span>
						</>
					) : null}
				</span>
				<span className="flex shrink-0 items-center gap-1.5 text-primary">
					<MeasuredLock tone="inherit" />
					<span aria-label="hidden">{content.redacted}</span>
				</span>
			</span>
			{content.extraRows?.map((row) => (
				<span key={row.label} className="flex items-baseline justify-between gap-6">
					<span className="text-secondary">{row.label}</span>
					<span className="shrink-0 text-primary" aria-label="hidden">
						{row.redacted}
					</span>
				</span>
			))}
			<span className="text-secondary">{content.detail}</span>
			<button
				type="button"
				onClick={onUpgrade}
				className="mt-0.5 w-fit rounded-lg bg-brand px-3 py-1.5 text-left label-sm text-on-brand hover:brightness-110 focus-visible:focus-ring-on-brand"
			>
				{content.cta}
			</button>
		</span>
	)
}

/** The APY-specific offer; callers only supply the pool and modal action. */
export function MeasuredApyOffer({ poolName, onUpgrade }: { poolName: string; onUpgrade: () => void }) {
	return (
		<MeasuredOffer
			onUpgrade={onUpgrade}
			content={{
				headline: 'Verified APY',
				detail: `What a real holder withdrawing from ${poolName} actually received.`,
				label: 'Base',
				qualifier: 'verified',
				redacted: '•••',
				cta: 'Unlock Verified APY'
			}}
		/>
	)
}

/** The exit-specific offer; its copy cannot accidentally inherit APY defaults. */
export function MeasuredExitOffer({ poolName, onUpgrade }: { poolName: string; onUpgrade: () => void }) {
	return (
		<MeasuredOffer
			onUpgrade={onUpgrade}
			content={{
				headline: 'Verified Exit Status',
				detail: (
					<>
						Whether a real holder could actually withdraw from {poolName}:{' '}
						<span className="text-primary">instant, partial, queued or blocked</span>, how long it took, and what it
						cost.
					</>
				),
				label: 'Exit',
				qualifier: 'verified',
				redacted: '•••',
				extraRows: [
					{ label: 'Time to exit', redacted: '•••' },
					{ label: 'Cost', redacted: '•••' }
				],
				cta: 'Unlock Verified Exit Status'
			}}
		/>
	)
}

/**
 * The padlock on the APY column head and its card: what "verified" means, and what else is
 * measured. A reader without a subscription gets the padlock plus the offer (PRO badge and unlock
 * button); a subscriber gets the seal and the same card without them. Sits beside the header's
 * sort button, never inside it. Tier-driven, not row-driven: a page sorted onto unmeasured pools
 * still has the measurements behind it.
 */
export function MeasuredColumnHint() {
	const { show, modal } = useSubscribeProModal('verified-yields', 'apy-column')
	const { hasAccess: unlocked, isDenied } = useVerifiedAccess()
	return (
		<>
			{/* With the header's own 4px gap this matches the cells' 6px figure-to-seal gap. */}
			<span className="ml-0.5 flex">
				<Hovercard
					contentClassName="p-3"
					placement="bottom-end"
					content={
						<span className="flex w-80 max-w-(--popover-available-width) flex-col gap-2">
							{/* The claim in its own tinted block: what the column holds, the tier, and what the number means. */}
							<span className="flex flex-col gap-1 rounded-lg border border-medium bg-border-subtle px-3 py-2.5">
								<span className="flex items-center justify-between gap-3">
									<span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
										<SealGlyph size={15} />
										Verified APY
									</span>
									{isDenied ? (
										<span className="shrink-0 rounded-md bg-brand-muted px-1.5 py-0.5 label-xs tracking-widest text-link">
											PRO
										</span>
									) : null}
								</span>
								<span className="text-secondary">What holders actually received.</span>
							</span>
							<span className="text-secondary">
								Every day we simulate a real holder withdrawing from each measured pool on-chain and record what they
								actually received.
							</span>
							<span className="text-secondary">
								Also verified: whether you can actually get out of the pool, how fast, what it costs, and how much you
								could withdraw right now.
							</span>
							<span className="border-t border-subtle pt-2 text-secondary">
								<span className="font-medium text-(--yield-reward-text)">Token rewards</span> are not verified. Only the
								base APY is.
							</span>
							<span className="border-t border-subtle pt-2 text-secondary">
								APYs without the seal are reported: what our adapters calculate.
							</span>
							{isDenied ? (
								<button
									type="button"
									onClick={show}
									className="mt-0.5 w-fit rounded-lg bg-brand px-3 py-1.5 text-left label-sm text-on-brand hover:brightness-110 focus-visible:focus-ring-on-brand"
								>
									Unlock Verified APY
								</button>
							) : null}
						</span>
					}
				>
					{/* The seal, blue like the row seals, once the reader has it; the lock otherwise, including while
				    access settles: this HTML reaches every reader, and a grey lock resolving to a blue seal for the
				    few subscribers is quieter than anything else flashing for the signed-out majority. */}
					{unlocked ? (
						<span role="img" aria-label="Verified APYs in this column were measured on-chain" className="flex shrink-0">
							<SealGlyph size={13} />
						</span>
					) : (
						<MeasuredLock
							tone="inherit"
							className="text-verified"
							label="Verified APYs in this column are available on a Pro subscription"
						/>
					)}
				</Hovercard>
			</span>
			{modal}
		</>
	)
}

/**
 * The Exit Status header's mark and card: the lock with the offer for a reader without access,
 * the seal with the same explainer once they have it. Header marks say which columns belong to
 * the product; the cells' status icons already carry each value's meaning, so they stay unmarked.
 */
export function MeasuredExitColumnHint() {
	const { show, modal } = useSubscribeProModal('verified-yields', 'exit-column')
	const { hasAccess: unlocked, isDenied } = useVerifiedAccess()
	return (
		<>
			<span className="ml-0.5 flex">
				<Hovercard
					contentClassName="p-3"
					placement="bottom-end"
					content={
						<span className="flex w-80 max-w-(--popover-available-width) flex-col gap-2">
							<span className="flex flex-col gap-1 rounded-lg border border-medium bg-border-subtle px-3 py-2.5">
								<span className="flex items-center justify-between gap-3">
									<span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
										<SealGlyph size={15} />
										Verified Exit Status
									</span>
									{isDenied ? (
										<span className="shrink-0 rounded-md bg-brand-muted px-1.5 py-0.5 label-xs tracking-widest text-link">
											PRO
										</span>
									) : null}
								</span>
								<span className="text-secondary">Whether a real holder could actually withdraw.</span>
							</span>
							<span className="text-secondary">
								Every day we simulate a real holder withdrawing from each measured pool on-chain and record what
								happened: whether it went through, how long it took, and what it cost.
							</span>
							<span className="text-secondary">
								Each cell shows the latest result: instant, queued and the wait, the share of the pool that could leave
								right now, or blocked, plus any exit fee actually charged.
							</span>
							<span className="border-t border-subtle pt-2 text-secondary">
								It&apos;s a daily measurement at that day&apos;s block, not a live quote.
							</span>
							{isDenied ? (
								<button
									type="button"
									onClick={show}
									className="mt-0.5 w-fit rounded-lg bg-brand px-3 py-1.5 text-left label-sm text-on-brand hover:brightness-110 focus-visible:focus-ring-on-brand"
								>
									Unlock Verified Exit Status
								</button>
							) : null}
						</span>
					}
				>
					{unlocked ? (
						<span
							role="img"
							aria-label="Verified exit status in this column is measured on-chain"
							className="flex shrink-0"
						>
							<SealGlyph size={13} />
						</span>
					) : (
						<MeasuredLock
							tone="inherit"
							className="text-verified"
							label="Verified exit status in this column is available on a Pro subscription"
						/>
					)}
				</Hovercard>
			</span>
			{modal}
		</>
	)
}

/** One label/value pair of the card's breakdown. `muted` drops the whole row a tier. */
export interface MeasuredRow {
	label: string
	/** Token qualifier, printed after a middot one tier below the label. */
	qualifier?: string | null
	/** Where the figure comes from, in its own column so the legs line up. */
	provenance?: 'verified' | 'reported' | 'last verified' | null
	value: string
	muted?: boolean
	/** Rule above this row — the composition's Total separator. */
	ruled?: boolean
	/** Bold value — the Total. */
	strong?: boolean
}

/**
 * The APY cell's hovercard: the breakdown alone when unmeasured, the same grid plus a header and
 * exit line when measured, and the offer in place of both when locked.
 */
const WINDOW_LABEL: Record<ApyWindow, string> = { current: 'Now', avg_7d: '7d', avg_30d: '30d' }

export function MeasuredCard({
	rows,
	verified,
	measured,
	unsubstitutedMeasured = false,
	poolUrl,
	offer
}: {
	rows: Array<MeasuredRow>
	/** Null on unmeasured pools AND on locked ones, which the server strips — see `offer`. */
	verified: VerifiedBlock | null | undefined
	/** True when the headline carries our measured base rather than the protocol's. */
	measured: boolean
	/** True when a fresh reading exists but could not safely replace the reported total. */
	unsubstitutedMeasured?: boolean
	poolUrl: string
	/** Set for a reader without a subscription: the measurement is replaced by the offer. */
	offer?: { poolName: string; onUpgrade: () => void } | undefined
}) {
	// The card mounts on hover only, so the router read never touches the row path.
	const window = parseApyWindow(useRouter().query)

	if (offer) {
		return (
			<span className="flex w-80 max-w-(--popover-available-width) flex-col gap-3">
				{rows.length > 0 ? <Grid rows={rows} /> : null}
				<MeasuredApyOffer poolName={offer.poolName} onUpgrade={offer.onUpgrade} />
			</span>
		)
	}

	const breakdown = rows.length > 0 ? <Grid rows={rows} /> : null

	if (!verified) {
		return <span className="flex w-max max-w-(--popover-available-width) flex-col">{breakdown}</span>
	}

	const hasReading = verified.apy.avg_1d != null || verified.apy.avg_7d != null || verified.apy.avg_30d != null
	const feeWarning = verified.exit ? exitFeeWarning(verified.exit.fee_bps) : null
	// A reading too old to be the headline still belongs to the APY leg: the card says "Verified APY"
	// and dates THAT reading, so a fresher exit probe can never make a stale APY look current.
	const apyStale = hasReading && !isVerifiedCurrent(verified.apy_as_of)
	const reportsApy = measured || unsubstitutedMeasured || hasReading
	// APY and exit are probed separately; date whichever leg the card is reporting.
	const stamp = reportsApy ? verified.apy_as_of : (verified.exit?.as_of ?? verified.apy_as_of)
	const stale = reportsApy ? apyStale : !isVerifiedCurrent(stamp)
	// The headline is the protocol's figure in two cases; each says which reading is missing and why.
	const windowLabel = WINDOW_LABEL[window]
	const pendingWindow =
		!measured && !unsubstitutedMeasured && !apyStale && hasReading && resolveVerifiedApy(verified, window) == null
	const reportedNote = pendingWindow
		? `No ${windowLabel} measurement yet. Showing the protocol's reported ${windowLabel} rate.`
		: hasReading
			? null
			: "Exits are measured, yield is not. Showing the protocol's reported rate."

	return (
		<span className="flex w-80 max-w-(--popover-available-width) flex-col gap-2">
			<span className="flex items-center justify-between gap-3">
				<span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
					<MeasuredSeal muted={!measured} size={14} />
					{unsubstitutedMeasured
						? 'Verified APY · not included in total'
						: hasReading
							? 'Verified APY'
							: 'Verified exit'}
				</span>
				{stamp ? (
					<RelativeTime
						value={stamp}
						prefix={reportsApy ? (stale ? 'last measured' : 'measured') : 'exit measured'}
						className={`shrink-0 ${stale ? 'text-warning' : 'text-tertiary'}`}
					/>
				) : null}
			</span>

			{breakdown}

			{reportedNote ? <span className="text-secondary">{reportedNote}</span> : null}
			{verified.apy_note ? <span className="text-secondary">{verified.apy_note}</span> : null}
			{feeWarning ? (
				<span className="flex items-center gap-1.5 text-warning">
					<Icon name="alert-triangle" height={12} width={12} className="shrink-0" aria-hidden />
					{feeWarning}
				</span>
			) : null}

			{/* The exit has its own column and card; a fee stays here because it comes out of the yield. */}
			<span className="flex items-center justify-end border-t border-subtle pt-2">
				<a href={poolUrl} className="shrink-0 whitespace-nowrap text-link hover:underline">
					Evidence →
				</a>
			</span>
		</span>
	)
}

function Grid({ rows }: { rows: Array<MeasuredRow> }) {
	return (
		<span className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-5 gap-y-1">
			{rows.map((row) => (
				<Fragment key={`${row.label}-${row.provenance ?? ''}`}>
					{row.ruled ? <span className="col-span-full mt-0.5 border-t border-subtle" aria-hidden /> : null}
					<span className={row.muted ? 'text-tertiary' : 'text-secondary'}>
						{row.label}
						{/* A muted row is already a tier down; dropping its qualifier again fails contrast. */}
						{row.qualifier ? (
							row.muted ? (
								` · ${row.qualifier}`
							) : (
								<span className="text-tertiary">{` · ${row.qualifier}`}</span>
							)
						) : null}
					</span>
					{/* "verified" wears the seal's colour so it reads as the seal's claim, row by row. */}
					<span className={row.provenance === 'verified' ? 'text-primary' : 'text-tertiary'}>{row.provenance}</span>
					<span
						className={`text-right whitespace-nowrap ${row.muted ? 'text-tertiary' : 'text-primary'} ${
							row.strong ? 'font-semibold' : ''
						}`.trim()}
					>
						{row.value}
					</span>
				</Fragment>
			))}
		</span>
	)
}
