import { Button } from '~/ui/Button'
import { formatUsd } from '~/utils/numberFormat'
import {
	collateralDepegLossUsd,
	isCollateralStressModelable,
	vaultDepegLossUsd,
	vaultDepegLossUsdAtDrops
} from '../derive'
import { toneClasses } from '../kindMeta'
import type { CollateralVM, PoolType } from '../types'
import { DEFAULT_STRESS_DROP, dropLabel } from './collateralShared'
import { usePositionUsd } from './PositionControl'
import { lossPct } from './scenarioShared'

// The section-level readout of the per-asset stress: sums whatever drop each collateral is
// currently set to. It owns no control — each asset's drop is dialled in its own row, so
// there's one place to change a drop instead of a vault-wide slider competing with per-row ones.
export function VaultStress({
	collateral,
	supplyUsd,
	poolType,
	singleCollateral,
	dropFor,
	tunedCount,
	onReset
}: {
	collateral: CollateralVM[]
	supplyUsd: number
	poolType: PoolType
	singleCollateral: boolean
	dropFor: (c: CollateralVM) => number
	tunedCount: number
	onReset: () => void
}) {
	const [position] = usePositionUsd()
	const scopeWord = poolType === 'market' ? 'market-wide' : 'vault-wide'
	const modelable = collateral.filter(isCollateralStressModelable)
	const ceiling = vaultDepegLossUsd(modelable, 1)
	// Nothing the backend could model → honest gap, not a dead slider.
	if (modelable.length < 1)
		return (
			<div className="flex flex-col gap-1 border-b border-subtle bg-surface-elevated-1 px-3 py-3 body-md">
				<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
					<span className="label-md text-primary">If collateral prices drop</span>
					<span className="body-sm text-secondary">{`${scopeWord} · not modeled`}</span>
				</div>
				<p className="text-secondary">
					{`Bad debt isn’t modeled for this ${poolType === 'market' ? 'market' : 'vault'}’s collateral. Per-collateral exposure ceilings are listed below.`}
				</p>
			</div>
		)
	// Everything models to exactly zero (e.g. borrow-disabled) — a real zero, not missing data.
	if (ceiling <= 0)
		return (
			<div className="flex flex-col gap-1 border-b border-subtle bg-surface-elevated-1 px-3 py-3 body-md">
				<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
					<span className="label-md text-primary">If collateral prices drop</span>
					<span className="body-sm text-secondary">{`${scopeWord} · no modeled bad debt`}</span>
				</div>
				<p className="text-secondary">
					{`No modeled bad-debt path at any drop — borrowing against this ${poolType === 'market' ? 'market' : 'vault'}’s collateral is fully buffered or disabled.`}
				</p>
			</div>
		)

	const perColl = modelable
		.map((c) => ({ symbol: c.symbol, drop: dropFor(c), loss: collateralDepegLossUsd(c, dropFor(c) / 100) }))
		.filter((x) => x.loss > 0)
		.sort((a, b) => b.loss - a.loss)
	const total = vaultDepegLossUsdAtDrops(modelable, (c) => dropFor(c) / 100)
	const buffered = total <= 0
	const yourShare = !buffered && position != null && supplyUsd > 0 ? total * Math.min(1, position / supplyUsd) : null
	// Bad debt reads as a share of the deposit; dollars only once a deposit is entered.
	const asShare = (usd: number) =>
		lossPct(usd, supplyUsd) ??
		formatUsd(usd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
	const drivers = perColl.slice(0, 3)
	const otherLoss = perColl.slice(3).reduce((a, x) => a + x.loss, 0)
	const excluded = collateral.length - modelable.length

	return (
		<div className="flex flex-col gap-2 border-b border-subtle bg-surface-elevated-1 px-3 py-3">
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
				<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
					<span className="label-md text-primary">If collateral prices drop</span>
					<span className="body-sm text-secondary">{`per asset · no liquidations · stress estimate`}</span>
				</div>
				{tunedCount > 0 ? (
					<Button type="button" variant="ghost" size="md" onClick={onReset} className="-mr-2">
						<span className="underline decoration-dotted">{`Reset ${tunedCount} to −${DEFAULT_STRESS_DROP}%`}</span>
					</Button>
				) : null}
			</div>

			<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
				<span aria-live="polite" className="min-w-0 body-sm text-secondary">
					{buffered ? (
						<span className={toneClasses('good').text}>absorbed by liquidations — no bad debt</span>
					) : (
						<>
							{'est. bad debt up to '}
							<span className="label-md text-primary tabular-nums">{asShare(total)}</span>
							{' of deposit'}
							{yourShare != null
								? ` · ≈ ${formatUsd(yourShare, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} of yours`
								: null}
						</>
					)}
				</span>
			</div>

			{/* a single collateral IS the driver, so the breakdown is dropped — just the ceiling */}
			<p className="body-sm text-secondary">
				{!singleCollateral && drivers.length ? (
					<>
						<span className="text-secondary">Driven by </span>
						{drivers.map((d, i) => (
							<span key={d.symbol} className="tabular-nums">
								{i > 0 ? ' · ' : ''}
								<span className="text-secondary">{d.symbol}</span> {`${dropLabel(d.drop)} `}
								{asShare(d.loss)}
							</span>
						))}
						{otherLoss > 0 ? <span className="tabular-nums">{` · other ${asShare(otherLoss)}`}</span> : null}
						{' · '}
					</>
				) : null}
				<span className="tabular-nums">{`−100% ${asShare(ceiling)} modeled all-to-zero bad-debt ceiling`}</span>
				{excluded > 0 ? ` · ${excluded} of ${collateral.length} excluded (no bad-debt attribution)` : null}
			</p>
		</div>
	)
}
