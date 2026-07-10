import { formattedNum } from '~/utils'
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
			<div className="flex flex-col gap-1 border-b border-(--legacy-cards-border) bg-(--legacy-bg-main)/30 px-3 py-2.5 text-xs">
				<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
					<span className="font-semibold text-(--legacy-text-primary)">If collateral prices drop</span>
					<span className="text-[10px] text-(--legacy-text-secondary)">{`${scopeWord} · not modeled`}</span>
				</div>
				<p className="text-(--legacy-text-secondary)">
					{`Bad debt isn’t modeled for this ${poolType === 'market' ? 'market' : 'vault'}’s collateral. Per-collateral exposure ceilings are listed below.`}
				</p>
			</div>
		)
	// Everything models to exactly zero (e.g. borrow-disabled) — a real zero, not missing data.
	if (ceiling <= 0)
		return (
			<div className="flex flex-col gap-1 border-b border-(--legacy-cards-border) bg-(--legacy-bg-main)/30 px-3 py-2.5 text-xs">
				<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
					<span className="font-semibold text-(--legacy-text-primary)">If collateral prices drop</span>
					<span className="text-[10px] text-(--legacy-text-secondary)">{`${scopeWord} · no modeled bad debt`}</span>
				</div>
				<p className="text-(--legacy-text-secondary)">
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
		<div className="flex flex-col gap-2.5 border-b border-(--legacy-cards-border) bg-(--legacy-bg-main)/30 px-3 py-3">
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
				<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
					<span className="text-xs font-semibold text-(--legacy-text-primary)">If collateral prices drop</span>
					<span className="text-[10px] text-(--legacy-text-secondary)">
						{mode === 'custom'
							? 'custom by asset · no liquidations · stress estimate'
							: `${scopeWord} · no liquidations · stress estimate`}
					</span>
				</div>
				{/* nothing to split across a single collateral, so the per-asset toggle is dropped */}
				{singleCollateral ? null : (
					<div className="inline-flex items-center gap-0.5 rounded-lg bg-(--legacy-bg-main) p-0.5">
						<button
							type="button"
							onClick={setModeVault}
							aria-pressed={mode === 'vault'}
							className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--legacy-primary) ${
								mode === 'vault'
									? 'bg-black/8 text-(--legacy-text-primary) dark:bg-white/8'
									: 'text-(--legacy-text-secondary) hover:text-(--legacy-text-primary)'
							}`}
						>
							{poolType === 'market' ? 'Market-wide' : 'Vault-wide'}
						</button>
						<button
							type="button"
							onClick={setModeCustom}
							aria-pressed={mode === 'custom'}
							className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--legacy-primary) ${
								mode === 'custom'
									? 'bg-black/8 text-(--legacy-text-primary) dark:bg-white/8'
									: 'text-(--legacy-text-secondary) hover:text-(--legacy-text-primary)'
							}`}
						>
							Custom by asset
						</button>
					</div>
				)}
			</div>

			<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
				{mode === 'vault' ? (
					<span className="relative flex h-3 w-full max-w-72 items-center">
						<span
							aria-hidden
							className="absolute inset-x-0 h-1 rounded-full"
							style={{ background: 'color-mix(in srgb, var(--legacy-primary) 28%, transparent)' }}
						/>
						{anchors.map((a) => (
							<span
								key={a.drop_pct}
								aria-hidden
								className="absolute h-2.5 w-px -translate-x-1/2 bg-(--legacy-text-tertiary)/60"
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
							className={`absolute inset-0 w-full cursor-pointer appearance-none rounded-full bg-transparent outline-offset-4 outline-(--legacy-primary) focus-visible:outline-2 ${SLIDER_THUMB}`}
						/>
					</span>
				) : null}
				<span className="w-9 shrink-0 text-sm font-medium text-(--legacy-text-primary) tabular-nums">
					{mode === 'custom' ? 'Mix' : dropLabel(drop)}
				</span>
				<span aria-live="polite" className="min-w-0 text-xs text-(--legacy-text-secondary)">
					{buffered ? (
						<span className={toneClasses('good').text}>absorbed by liquidations — no bad debt</span>
					) : (
						<>
							{'est. bad debt up to '}
							<span className="font-semibold text-(--legacy-text-primary) tabular-nums">
								{formattedNum(total, true)}
							</span>
							{yourShare != null ? ` · ≈ ${formattedNum(yourShare, true)} of your deposit` : null}
						</>
					)}
				</span>
			</div>

			{mode === 'vault' ? (
				<div className="flex flex-wrap items-center gap-1.5">
					{anchors.map((a) => {
						const active = drop === a.drop_pct
						return (
							<button
								key={a.drop_pct}
								type="button"
								onClick={() => setDrop(a.drop_pct)}
								aria-pressed={active}
								title={`est. bad debt ${formattedNum(a.bad_debt_usd, true)}`}
								className={`rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--legacy-primary) ${
									active
										? 'bg-black/8 text-(--legacy-text-primary) dark:bg-white/8'
										: 'text-(--legacy-text-secondary) hover:text-(--legacy-text-primary)'
								}`}
							>
								{`−${a.drop_pct}%`}
							</button>
						)
					})}
					<span className="text-[10px] text-(--legacy-text-tertiary)">tap a preset or drag</span>
				</div>
			) : (
				<p className="text-[10px] text-(--legacy-text-secondary)">Open a row to set each collateral&apos;s drop.</p>
			)}

			{/* a single collateral IS the driver, so the breakdown is dropped — just the ceiling */}
			<p className="text-[10px] text-(--legacy-text-tertiary)">
				{!singleCollateral && drivers.length ? (
					<>
						<span className="text-(--legacy-text-secondary)">Driven by </span>
						{drivers.map((d, i) => (
							<span key={d.symbol} className="tabular-nums">
								{i > 0 ? ' · ' : ''}
								<span className="text-(--legacy-text-secondary)">{d.symbol}</span>{' '}
								{mode === 'custom' ? `${dropLabel(d.drop)} ` : ''}
								{formattedNum(d.loss, true)}
							</span>
						))}
						{otherLoss > 0 ? <span className="tabular-nums">{` · other ${formattedNum(otherLoss, true)}`}</span> : null}
						{' · '}
					</>
				) : null}
				<span className="tabular-nums">{`−100% ${formattedNum(ceiling, true)} modeled all-to-zero bad-debt ceiling`}</span>
				{excluded > 0 ? ` · ${excluded} of ${collateral.length} excluded (no bad-debt attribution)` : null}
			</p>
		</div>
	)
}
