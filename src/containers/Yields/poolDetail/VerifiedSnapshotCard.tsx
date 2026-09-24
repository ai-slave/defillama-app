import { Panel } from '~/ui/Panel'
import { withdrawableFraction } from '../data/exit'
import type { VerifiedBlock } from '../data/types'
import { exitCoverageLine, exitHeadline, exitShareLine } from '../domain/exitPresentation'
import { isVerifiedCurrent } from '../domain/verifiedFreshness'
import { MeasuredOffer } from '../Tables/Measured'
import { useSubscribeProModal } from '../useSubscribeProModal'
import type { VerifiedWindowRow } from './VerifiedApyPanel'

export interface VerifiedSnapshotModel {
	// The hero figure. Null when the reading is not current — see `isVerifiedCurrent` — so the
	// reported rate takes the hero slot and this pool cannot show a days-old number as today's.
	baseApy: number | null
	// The last reading when it was too old to be the hero; shown a tier down, dated.
	lastVerifiedApy: number | null
	current: boolean
	exitHeadline: string
	exitDetail: string
	// The amount that could leave right now, from the verified exit measurement.
	withdrawableUsd: number | null
	// 0..1 share of measured deposits that can exit now. Null on an uncapped queue, which is a
	// different claim from zero: there is no instant lane to measure.
	withdrawableFraction: number | null
	// Persistent discount against the reported rate. Signed: only a positive value is a fee the
	// holder pays, and exactly one pool currently shows one.
	feeBps: number | null
}

// Null stays null: the headline never fills a missing measurement from the reported feed.
export function buildVerifiedSnapshot(
	verified: VerifiedBlock,
	windows: Array<VerifiedWindowRow>,
	now: number = Date.now()
): VerifiedSnapshotModel {
	const daily = windows.find((row) => row.label === '24h') ?? null
	const reading = daily?.verified ?? verified.apy.avg_1d
	const current = isVerifiedCurrent(verified.apy_as_of, now)
	const baseApy = current ? reading : null
	// The dollar figure gets its own row on an instant lane, so the detail carries the share instead.
	const withdrawable = verified.exit?.status === 'instant' && verified.exit_liquidity?.usd != null
	return {
		baseApy,
		lastVerifiedApy: current ? null : reading,
		current,
		// Shared wording with the earn table; an absent exit block means nothing was probed.
		exitHeadline: exitHeadline(verified) ?? '—',
		exitDetail: withdrawable ? exitShareLine(verified) : (exitCoverageLine(verified) ?? 'Exit not measured'),
		withdrawableUsd: verified.exit_liquidity?.usd ?? null,
		withdrawableFraction: withdrawableFraction(verified),
		feeBps: verified.exit?.fee_bps ?? null
	}
}

export interface MeasuredApyPart {
	key: string
	label: string
	/** Where the figure comes from, so the legs line up as in the table's card. */
	provenance?: string
	value: string
	strong: boolean
}

/** The measured supply composition: the table cell's split, on the pool page. */
export interface MeasuredComposition {
	total: number
	parts: Array<MeasuredApyPart>
}

/** The stand-in for the measured sections when the reader has no subscription. */
export function LockedVerifiedSection({ symbol }: { symbol: string }) {
	const { show, modal } = useSubscribeProModal('verified-yields', 'pool-page')
	return (
		<>
			<Panel padding="none" className="overflow-hidden">
				<div className="grid grid-cols-1 items-center gap-6 bg-(--yield-verified-badge) p-4 @min-[48rem]:grid-cols-[minmax(0,1fr)_auto] @min-[48rem]:gap-10">
					<div className="flex max-w-[60ch] flex-col gap-2">
						<h2 className="heading-sm text-primary">See what {symbol} holders actually received.</h2>
						<p className="body-md text-secondary">
							Every day we simulate a real holder withdrawing from {symbol} on-chain and record what they actually
							received: the base yield an exit paid, whether it went through, how long it took and what it cost.
						</p>
						<p className="body-sm text-secondary">Plus daily charts of measured growth and exit history.</p>
					</div>
					<span className="flex w-80 max-w-full flex-col gap-3 body-sm">
						<MeasuredOffer
							onUpgrade={show}
							content={{
								headline: 'Verified APY',
								label: 'Base',
								qualifier: 'verified',
								redacted: '•••',
								lock: false,
								extraRows: [{ label: 'Exit, time to exit, cost', redacted: '•••' }],
								cta: 'Unlock Verified APY'
							}}
						/>
					</span>
				</div>
			</Panel>
			{modal}
		</>
	)
}
