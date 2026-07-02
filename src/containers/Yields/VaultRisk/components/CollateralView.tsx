import { useMemo, useState } from 'react'
import type { BlockExplorersResponse } from '~/api/types'
import { Tooltip } from '~/components/Tooltip'
import { buildAllocation } from '../allocation'
import { collateralMarketBreakLossUsd, isDustCollateral } from '../derive'
import { ChapterHead } from '../primitives/ChapterHead'
import type { CollateralVM, MarketOracle, OracleDependency, OracleExposure, PoolType } from '../types'
import { CollateralRow, UnallocatedRow } from './CollateralRow'
import { type StressMode } from './collateralShared'
import { MarketOracleTable } from './MarketOracleTable'
import { OracleDependencies } from './OracleDependencies'
import { VaultStress } from './VaultStress'

const TOP_N = 8

// The header row and each data row are separate grids sharing this template, so the numeric
// columns must be FIXED widths — otherwise each grid sizes to its own content and headings drift.
const MARKET_COLS = 'sm:grid-cols-[minmax(8rem,1fr)_7rem_7.5rem_1rem]'
const VAULT_COLS = 'sm:grid-cols-[minmax(7rem,1fr)_7rem_7rem_7.5rem_1rem]'

function pooledMarketNote(protocolId: string, poolType: PoolType): string | null {
	if (poolType !== 'market') return null
	if (protocolId === 'aave-v3')
		return 'Aave v3 is a shared-liquidity market — your deposit is exposed to bad debt from any collateral below, not just the asset you supplied.'
	if (protocolId === 'compound-v3')
		return 'In Compound v3, every collateral below backs the same base asset — suppliers are exposed to all of them, not just one.'
	return null
}

// One consolidated collateral view, identical in shape across pool types; vaults add the
// numeric Allocation column.
export function CollateralView({
	collateral,
	explorers,
	protocolId,
	poolType,
	supplyUsd = 0,
	allocatedUsd = null,
	idleUsd = null,
	trustScope,
	marketOracles = [],
	oracleDependencies = [],
	oracleExposure = null,
	chain
}: {
	collateral: CollateralVM[]
	explorers?: BlockExplorersResponse
	protocolId: string
	poolType: PoolType
	supplyUsd?: number
	allocatedUsd?: number | null
	idleUsd?: number | null
	trustScope?: string[]
	marketOracles?: MarketOracle[]
	oracleDependencies?: OracleDependency[]
	oracleExposure?: OracleExposure | null
	chain?: string
}) {
	const [showAll, setShowAll] = useState(false)
	const [stressMode, setStressMode] = useState<StressMode>('vault')
	const [stressDrop, setStressDrop] = useState(30)
	const [customDrops, setCustomDrops] = useState<Record<string, number>>({})

	// Derived from props only, so slider ticks (stressDrop/customDrops state) don't re-run them.
	const alloc = useMemo(
		() => (poolType === 'vault' ? buildAllocation(collateral, supplyUsd, allocatedUsd, idleUsd) : null),
		[poolType, collateral, supplyUsd, allocatedUsd, idleUsd]
	)
	const orphanMarkets = useMemo(() => {
		const collateralAddrs = new Set(collateral.map((c) => c.address.toLowerCase()))
		return marketOracles.filter((m) => {
			const a = m.collateral_asset?.address?.toLowerCase()
			return !a || !collateralAddrs.has(a)
		})
	}, [collateral, marketOracles])
	// Dust positions are hidden from the table (summarized as a count below); the loss curve
	// and headline still see the full set.
	const ranked = useMemo(
		() =>
			collateral
				.filter((c) => !isDustCollateral(c))
				.sort((a, b) => collateralMarketBreakLossUsd(b) - collateralMarketBreakLossUsd(a)),
		[collateral]
	)
	const totalDrainableUsd = useMemo(() => collateral.reduce((sum, c) => sum + (c.drainableUsd ?? 0), 0), [collateral])

	if (!collateral.length) return null
	const note = pooledMarketNote(protocolId, poolType)
	const isMarket = poolType === 'market'
	// A one-collateral market needs none of the multi-asset chrome (toggle, "driven by" split).
	const singleCollateral = collateral.length === 1

	const cols = alloc ? VAULT_COLS : MARKET_COLS
	const dustHidden = collateral.length - ranked.length
	const shown = showAll ? ranked : ranked.slice(0, TOP_N)
	const hidden = ranked.length - shown.length
	const customDropFor = (c: CollateralVM) => customDrops[c.address.toLowerCase()] ?? stressDrop
	const setCustomDropFor = (c: CollateralVM, drop: number) => {
		setCustomDrops((prev) => ({ ...prev, [c.address.toLowerCase()]: drop }))
	}
	const enterVaultMode = () => setStressMode('vault')
	const enterCustomMode = () => {
		setCustomDrops((prev) => {
			const next = { ...prev }
			for (const c of collateral) {
				const key = c.address.toLowerCase()
				if (next[key] == null) next[key] = stressDrop
			}
			return next
		})
		setStressMode('custom')
	}

	return (
		<div className="flex flex-col gap-2">
			<ChapterHead
				title="Collateral & oracles"
				hint={
					isMarket
						? 'Each token this market is exposed to, and what backs it. If a collateral breaks, this is how much you lose, in dollars. Open a row for the price feed and stress curve. Below, the oracles those prices depend on and what is at stake if one is compromised.'
						: "Each token you're exposed to, and the market it backs. If that market breaks, this is how much the vault loses, in dollars and as a share of the vault. Open a row for the price feed, stress curve, and supply-cap detail. Below, the oracles those prices depend on and what is at stake if one is compromised."
				}
			>
				{note ? <p className="mt-1 max-w-2xl text-xs text-(--text-secondary)">{note}</p> : null}
			</ChapterHead>

			<div className="overflow-hidden rounded-md border border-(--cards-border)">
				<VaultStress
					collateral={collateral}
					supplyUsd={supplyUsd}
					poolType={poolType}
					singleCollateral={singleCollateral}
					mode={stressMode}
					drop={stressDrop}
					setDrop={setStressDrop}
					setModeVault={enterVaultMode}
					setModeCustom={enterCustomMode}
					customDrops={customDrops}
				/>

				<div
					className={`hidden items-end gap-6 border-b border-(--cards-border) bg-(--bg-main) px-3 py-2 text-xs font-medium text-(--text-secondary) sm:grid ${cols}`}
				>
					<span>Collateral</span>
					{alloc ? (
						<Tooltip
							content="What the curator has deployed into this market — the pool's actual supplied position."
							className="justify-self-end underline decoration-dotted"
						>
							Allocation
						</Tooltip>
					) : null}
					<Tooltip
						content={
							alloc
								? 'Modeled bad-debt exposure if this collateral goes to zero. When attribution is missing, this falls back to the position cap.'
								: 'Modeled bad-debt exposure if this collateral goes to zero. When attribution is missing, this falls back to the market and pool-size cap.'
						}
						className="justify-self-end underline decoration-dotted"
					>
						Market Exposure
					</Tooltip>
					<Tooltip
						content="Separate oracle-compromise path: drainable if the price feed is pushed to a fake value."
						className="justify-self-end underline decoration-dotted"
					>
						Oracle Exposure
					</Tooltip>
					<span />
				</div>
				<div>
					{shown.map((c) => (
						<CollateralRow
							key={c.address}
							c={c}
							explorers={explorers}
							cols={cols}
							alloc={alloc}
							poolType={poolType}
							singleCollateral={singleCollateral}
							supplyUsd={supplyUsd}
							stressDrop={stressMode === 'custom' ? customDropFor(c) : stressDrop}
							stressMode={stressMode}
							onStressDropChange={stressMode === 'custom' ? (drop) => setCustomDropFor(c, drop) : undefined}
							trustScope={trustScope}
							markets={marketOracles}
						/>
					))}
					{alloc && alloc.unallocatedPct > 0 ? <UnallocatedRow alloc={alloc} cols={cols} /> : null}
				</div>
			</div>

			{hidden > 0 || showAll ? (
				<button
					type="button"
					onClick={() => setShowAll((v) => !v)}
					className="-ml-2 inline-flex min-h-9 items-center self-start rounded-md px-2 text-xs text-(--text-secondary) underline decoration-dotted hover:bg-(--bg-main)/50 hover:text-(--text-primary)"
				>
					{showAll ? 'Show fewer' : `Show all ${ranked.length} collaterals`}
				</button>
			) : null}

			{dustHidden > 0 ? (
				<p className="text-xs text-(--text-tertiary)">
					+{dustHidden} {dustHidden === 1 ? 'market' : 'markets'} with no current position
				</p>
			) : null}

			<OracleDependencies
				providers={oracleExposure?.by_provider ?? []}
				deps={oracleDependencies}
				collateral={collateral}
				chain={chain}
				explorers={explorers}
				totalDrainableUsd={totalDrainableUsd}
				supplyUsd={supplyUsd}
				poolType={poolType}
			/>

			<MarketOracleTable markets={orphanMarkets} explorers={explorers} />
		</div>
	)
}
