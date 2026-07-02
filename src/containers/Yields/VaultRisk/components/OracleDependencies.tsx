import type { BlockExplorersResponse } from '~/api/types'
import { formattedNum } from '~/utils'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { toneClasses } from '../kindMeta'
import { AddressActions } from '../primitives/AddressActions'
import { MofNPips } from '../primitives/MofNPips'
import type { OracleDependency, OracleExposure, PoolType } from '../types'
import { isProvenVendor } from './collateralShared'

// An EOA (single key) is the worst control point and the only one toned danger.
function oracleAdminLabel(o: OracleDependency): string {
	if (o.admin_kind === 'eoa') return 'a single private key (EOA)'
	if (o.admin_kind === 'guardian-set') return o.multisig ? `a ${o.multisig} guardian set` : 'a guardian set'
	if (o.admin_kind === 'safe') return o.multisig ? `a ${o.multisig} Safe multisig` : 'a Safe multisig'
	return 'a control contract'
}

function parseMofN(s?: string): { m: number; n: number } | null {
	if (!s) return null
	const [m, n] = s.split('/').map((x) => Number(x.trim()))
	return Number.isFinite(m) && Number.isFinite(n) && n > 0 ? { m, n } : null
}

// exposure_pct can slightly exceed 1 via overlap — clamp; sub-1% reads as "<1%".
function pctOfVault(p: number | null | undefined): string | null {
	if (p == null) return null
	const v = Math.min(100, Math.max(0, p * 100))
	return v > 0 && v < 1 ? '<1%' : `${Math.round(v)}%`
}

// The vault's oracle attack surface: leads with the union total (per-collateral, never
// double-counted); per-control rows overlap (a multi-admin feed counts toward each) and are never summed.
export function OracleDependencies({
	providers,
	deps,
	chain,
	explorers,
	totalDrainableUsd = 0,
	supplyUsd = 0,
	poolType = 'vault'
}: {
	providers: OracleExposure['by_provider']
	deps: OracleDependency[]
	chain?: string
	explorers?: BlockExplorersResponse
	totalDrainableUsd?: number
	supplyUsd?: number
	poolType?: PoolType
}) {
	const shareWord = poolType === 'market' ? 'of market' : 'of vault'
	const vendors = providers
		.filter((p) => isProvenVendor(p.provider) && p.exposure_usd > 0)
		.sort((a, b) => b.exposure_usd - a.exposure_usd)
	const admins = [...deps].filter((d) => d.exposure_usd > 0).sort((a, b) => b.exposure_usd - a.exposure_usd)
	if (!vendors.length && !admins.length) return null
	const adminUrl = (addr: string) =>
		explorers
			? (getBlockExplorerNew({
					apiResponse: explorers,
					address: addr,
					chainName: chain ?? 'ethereum',
					urlType: 'address'
				})?.url ?? null)
			: null

	// vendors already represented by a resolved admin row drop out of the unresolved tail
	const resolvedVendors = new Set(admins.flatMap((a) => a.vendors.map((v) => v.toLowerCase())))
	const unresolvedVendors = vendors.filter((v) => !resolvedVendors.has(v.provider.toLowerCase()))
	const totalPct =
		totalDrainableUsd > 0 && supplyUsd > 0 ? pctOfVault(Math.min(1, totalDrainableUsd / supplyUsd)) : null
	const feedCount = vendors.length
	const controlCount = admins.length

	return (
		<div className="overflow-hidden rounded-md border border-(--cards-border)">
			<div className="flex flex-col gap-2 border-b border-(--cards-border) bg-(--bg-main)/30 px-3 py-3">
				<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
					<h4 className="text-sm font-semibold text-(--text-primary)">Oracle dependencies</h4>
					<span className="text-[10px] text-(--text-secondary) tabular-nums">
						{feedCount > 0 ? `${feedCount} feed${feedCount === 1 ? '' : 's'}` : null}
						{feedCount > 0 && controlCount > 0 ? ' · ' : null}
						{controlCount > 0 ? `${controlCount} control point${controlCount === 1 ? '' : 's'}` : null}
					</span>
				</div>
				{totalDrainableUsd > 0 ? (
					<p className="flex flex-wrap items-baseline gap-x-1.5">
						<span className="text-xs text-(--text-secondary)">Up to</span>
						<span className="text-base font-semibold text-(--text-primary) tabular-nums">
							{formattedNum(totalDrainableUsd, true)}
						</span>
						<span className="text-xs text-(--text-secondary)">
							drainable if these feeds are mispriced{totalPct ? ` · ${totalPct} ${shareWord}` : ''}
						</span>
					</p>
				) : null}
				<p className="max-w-2xl text-[10px] text-(--text-tertiary)">
					Each price traces to a feed and the on-chain admin that can move it. Compromise either to misprice the
					collateral and borrow against it. Per-row amounts overlap and are not summed.
				</p>
			</div>

			<ul className="divide-y divide-(--cards-border)">
				{admins.map((o) => {
					const eoa = o.admin_kind === 'eoa'
					const mn = parseMofN(o.multisig)
					const p = pctOfVault(o.exposure_pct)
					return (
						<li
							key={o.admin_address}
							className="flex flex-col gap-1.5 px-3 py-2.5 text-xs sm:flex-row sm:items-start sm:justify-between sm:gap-3"
						>
							<span className="flex min-w-0 flex-col gap-1">
								<span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
									<span className="font-medium text-(--text-primary)">{o.vendors.join(' / ') || 'Oracle feed'}</span>
									<span className="text-(--text-tertiary)">·</span>
									<span className={eoa ? `font-medium ${toneClasses('danger').text}` : 'text-(--text-primary)'}>
										{oracleAdminLabel(o)}
									</span>
									{mn ? <MofNPips m={mn.m} n={mn.n} /> : null}
								</span>
								{o.collateral_symbols.length ? (
									<span className="text-[10px] text-(--text-tertiary)">prices {o.collateral_symbols.join(', ')}</span>
								) : null}
								<AddressActions
									address={o.admin_address}
									url={adminUrl(o.admin_address)}
									label="oracle admin address"
								/>
							</span>
							<span className="shrink-0 text-left sm:text-right">
								<span className="text-(--text-primary) tabular-nums">{formattedNum(o.exposure_usd, true)}</span>
								{p ? <span className="text-(--text-secondary) tabular-nums">{` · ${p} ${shareWord}`}</span> : null}
								<span className="block text-[10px] text-(--text-tertiary)">
									{eoa ? 'drainable if that key leaks' : 'drainable if it is compromised'}
								</span>
							</span>
						</li>
					)
				})}

				{unresolvedVendors.map((v) => {
					const p = pctOfVault(v.exposure_pct)
					return (
						<li
							key={v.provider}
							className="flex flex-col gap-1.5 px-3 py-2.5 text-xs sm:flex-row sm:items-start sm:justify-between sm:gap-3"
						>
							<span className="flex min-w-0 flex-col gap-1">
								<span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
									<span className="font-medium text-(--text-primary)">{v.provider}</span>
									<span className="text-(--text-tertiary)">· on-chain control not resolved</span>
								</span>
								{v.collateral_symbols.length ? (
									<span className="text-[10px] text-(--text-tertiary)">prices {v.collateral_symbols.join(', ')}</span>
								) : null}
							</span>
							<span className="shrink-0 text-left sm:text-right">
								<span className="text-(--text-primary) tabular-nums">{formattedNum(v.exposure_usd, true)}</span>
								{p ? <span className="text-(--text-secondary) tabular-nums">{` · ${p} ${shareWord}`}</span> : null}
								<span className="block text-[10px] text-(--text-tertiary)">mispriceable if this feed lies</span>
							</span>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
