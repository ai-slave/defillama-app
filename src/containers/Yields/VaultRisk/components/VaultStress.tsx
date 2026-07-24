import { metricOptionChipStyles } from '~/ui/MetricChip'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tooltip } from '~/ui/Tooltip'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import {
	collateralDepegLossUsd,
	isCollateralStressModelable,
	vaultDepegLossUsd,
	vaultDepegLossUsdAtDrops
} from '../derive'
import { toneClasses } from '../kindMeta'
import type { CollateralVM, PoolType } from '../types'
import { dropLabel, SLIDER_THUMB, type StressMode } from './collateralShared'
import { usePositionUsd } from './PositionControl'

// Vault-wide what-if: drag one drop and read this vault's own modeled bad debt. The formula
// mirrors the backend stress model and is scoped to the collateral section.
export function VaultStress({
	collateral,
	supplyUsd,
	poolType,
	singleCollateral,
	mode,
	drop,
	setDrop,
	setModeVault,
	setModeCustom,
	customDrops
}: {
	collateral: CollateralVM[]
	supplyUsd: number
	poolType: PoolType
	singleCollateral: boolean
	mode: StressMode
	drop: number
	setDrop: (drop: number) => void
	setModeVault: () => void
	setModeCustom: () => void
	customDrops: Record<string, number>
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

	const selectedDrop = (c: CollateralVM) => (mode === 'custom' ? (customDrops[c.address.toLowerCase()] ?? drop) : drop)
	const perColl = modelable
		.map((c) => ({ symbol: c.symbol, drop: selectedDrop(c), loss: collateralDepegLossUsd(c, selectedDrop(c) / 100) }))
		.filter((x) => x.loss > 0)
		.sort((a, b) => b.loss - a.loss)
	const total =
		mode === 'custom'
			? vaultDepegLossUsdAtDrops(modelable, (c) => selectedDrop(c) / 100)
			: vaultDepegLossUsd(modelable, drop / 100)
	const buffered = total <= 0
	const yourShare = !buffered && position != null && supplyUsd > 0 ? total * Math.min(1, position / supplyUsd) : null
	const drivers = perColl.slice(0, 3)
	const otherLoss = perColl.slice(3).reduce((a, x) => a + x.loss, 0)
	const excluded = collateral.length - modelable.length
	const anchors = [10, 30, 50].map((drop_pct) => ({
		drop_pct,
		bad_debt_usd: vaultDepegLossUsd(modelable, drop_pct / 100)
	}))

	return (
		<div className="flex flex-col gap-2 border-b border-subtle bg-surface-elevated-1 px-3 py-3">
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
				<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
					<span className="label-md text-primary">If collateral prices drop</span>
					<span className="body-sm text-secondary">
						{mode === 'custom'
							? 'custom by asset · no liquidations · stress estimate'
							: `${scopeWord} · no liquidations · stress estimate`}
					</span>
				</div>
				{/* nothing to split across a single collateral, so the per-asset toggle is dropped */}
				{singleCollateral ? null : (
					<SegmentedControl
						value={mode}
						onValueChange={(next) => (next === 'vault' ? setModeVault() : setModeCustom())}
						options={[
							{ value: 'vault', label: poolType === 'market' ? 'Market-wide' : 'Vault-wide' },
							{ value: 'custom', label: 'Custom by asset' }
						]}
						label="Collateral stress scope"
						variant="default"
						size="md"
					/>
				)}
			</div>

			<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
				{mode === 'vault' ? (
					<span className="relative flex h-3 w-full max-w-72 items-center">
						<span
							aria-hidden
							className="absolute inset-x-0 h-1 rounded-full"
							style={{ background: 'color-mix(in srgb, var(--bg-brand) 28%, transparent)' }}
						/>
						{anchors.map((a) => (
							<span
								key={a.drop_pct}
								aria-hidden
								className="absolute h-2.5 w-px -translate-x-1/2 bg-tertiary/60"
								style={{ left: `${a.drop_pct}%` }}
							/>
						))}
						<input
							type="range"
							min={1}
							max={100}
							step={1}
							value={drop}
							onChange={(e) => setDrop(Number(e.target.value))}
							aria-label={`Simulated ${scopeWord} collateral price drop`}
							aria-valuetext={`${drop}% drop`}
							className={`absolute inset-0 w-full cursor-pointer appearance-none rounded-full bg-transparent outline-offset-4 outline-brand focus-visible:outline-2 ${SLIDER_THUMB}`}
						/>
					</span>
				) : null}
				<span className="w-9 shrink-0 label-md text-primary tabular-nums">
					{mode === 'custom' ? 'Mix' : dropLabel(drop)}
				</span>
				<span aria-live="polite" className="min-w-0 body-sm text-secondary">
					{buffered ? (
						<span className={toneClasses('good').text}>absorbed by liquidations — no bad debt</span>
					) : (
						<>
							{'est. bad debt up to '}
							<span className="label-sm text-primary tabular-nums">
								{formatUsd(total, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
							</span>
							{yourShare != null
								? ` · ≈ ${formatUsd(yourShare, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} of your deposit`
								: null}
						</>
					)}
				</span>
			</div>

			{mode === 'vault' ? (
				<div className="flex flex-wrap items-center gap-1.5">
					{anchors.map((a) => {
						const active = drop === a.drop_pct
						return (
							<Tooltip
								key={a.drop_pct}
								content={`Estimated bad debt ${formatUsd(a.bad_debt_usd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}
								render={
									<button
										type="button"
										onClick={() => setDrop(a.drop_pct)}
										aria-pressed={active}
										className={metricOptionChipStyles}
										data-active={active}
									/>
								}
							>
								{`−${formatPercent(a.drop_pct, { input: 'percent' })}`}
							</Tooltip>
						)
					})}
					<span className="body-sm text-secondary">tap a preset or drag</span>
				</div>
			) : (
				<p className="body-sm text-secondary">Open a row to set each collateral&apos;s drop.</p>
			)}

			{/* a single collateral IS the driver, so the breakdown is dropped — just the ceiling */}
			<p className="body-sm text-secondary">
				{!singleCollateral && drivers.length ? (
					<>
						<span className="text-secondary">Driven by </span>
						{drivers.map((d, i) => (
							<span key={d.symbol} className="tabular-nums">
								{i > 0 ? ' · ' : ''}
								<span className="text-secondary">{d.symbol}</span> {mode === 'custom' ? `${dropLabel(d.drop)} ` : ''}
								{formatUsd(d.loss, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
							</span>
						))}
						{otherLoss > 0 ? (
							<span className="tabular-nums">{` · other ${formatUsd(otherLoss, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}</span>
						) : null}
						{' · '}
					</>
				) : null}
				<span className="tabular-nums">{`−100% ${formatUsd(ceiling, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} modeled all-to-zero bad-debt ceiling`}</span>
				{excluded > 0 ? ` · ${excluded} of ${collateral.length} excluded (no bad-debt attribution)` : null}
			</p>
		</div>
	)
}
