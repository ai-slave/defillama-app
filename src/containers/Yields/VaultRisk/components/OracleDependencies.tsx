import type { BlockExplorersResponse } from '~/api/types'
import { Card } from '~/ui/Card'
import { MetaLine } from '~/ui/MetaLine'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { formatUsd } from '~/utils/numberFormat'
import { toneClasses } from '../kindMeta'
import { AddressActions } from '../primitives/AddressActions'
import { MofNPips } from '../primitives/MofNPips'
import type { CollateralVM, OracleDependency, OracleExposure, PoolType } from '../types'
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
	return m !== undefined && n !== undefined && Number.isFinite(m) && Number.isFinite(n) && n > 0 ? { m, n } : null
}

// exposure_pct can slightly exceed 1 via overlap — clamp; sub-1% reads as "<1%".
function pctOfVault(p: number | null | undefined): string | null {
	if (p == null) return null
	const v = Math.min(100, Math.max(0, p * 100))
	return v > 0 && v < 1 ? '<1%' : `${Math.round(v)}%`
}

const EXCHANGE_RATE_KINDS = new Set(['exchange-rate', 'constant'])

// Vendorless drainable exposure is grouped under provider 'none' upstream, which the
// vendor tail drops as a gap vendor — without these rows it counts toward the header
// total but appears nowhere (the sUSDe case: an immutable ERC4626 exchange rate carrying
// most of the vault's oracle exposure). Split by what the feed is: a pure onchain
// exchange rate has no admin at all; anything else is an honest resolver gap.
type VendorlessGroup = { kind: 'exchange-rate' | 'unidentified'; exposureUsd: number; symbols: Array<string> }

function vendorlessGroups(collateral: Array<CollateralVM>): Array<VendorlessGroup> {
	const acc = new Map<VendorlessGroup['kind'], VendorlessGroup>()
	for (const c of collateral) {
		if (c.oracleProviders.some(isProvenVendor) || !((c.drainableUsd ?? 0) > 0)) continue
		const kind =
			c.feedKinds.length > 0 && c.feedKinds.every((k) => EXCHANGE_RATE_KINDS.has(k)) ? 'exchange-rate' : 'unidentified'
		const g = acc.get(kind) ?? { kind, exposureUsd: 0, symbols: [] }
		g.exposureUsd += c.drainableUsd ?? 0
		g.symbols.push(c.symbol)
		acc.set(kind, g)
	}
	return [...acc.values()].sort((a, b) => b.exposureUsd - a.exposureUsd)
}

const EMPTY_COLLATERAL: Array<CollateralVM> = []

// The vault's oracle attack surface: leads with the union total (per-collateral, never
// double-counted); per-control rows overlap (a multi-admin feed counts toward each) and are never summed.
export function OracleDependencies({
	providers,
	deps,
	collateral = EMPTY_COLLATERAL,
	chain,
	explorers,
	totalDrainableUsd = 0,
	supplyUsd = null,
	poolType = 'vault'
}: {
	providers: OracleExposure['by_provider']
	deps: Array<OracleDependency>
	collateral?: Array<CollateralVM>
	chain?: string
	explorers?: BlockExplorersResponse
	totalDrainableUsd?: number
	supplyUsd?: number | null
	poolType?: PoolType
}) {
	const shareWord = poolType === 'market' ? 'of market' : 'of vault'
	const vendors = providers
		.filter((p) => isProvenVendor(p.provider) && p.exposure_usd > 0)
		.sort((a, b) => b.exposure_usd - a.exposure_usd)
	const admins = [...deps].filter((d) => d.exposure_usd > 0).sort((a, b) => b.exposure_usd - a.exposure_usd)
	const vendorless = vendorlessGroups(collateral)
	if (vendors.length === 0 && admins.length === 0 && vendorless.length === 0) return null
	const adminUrl = (addr: string) =>
		explorers
			? (getBlockExplorerNew({
					apiResponse: explorers,
					address: addr,
					chainName: chain ?? 'ethereum',
					urlType: 'address'
				})?.url ?? null)
			: null

	// A vendor drops out of the unresolved tail only when its resolved admin rows account for
	// (nearly) all of its exposure. A name match alone is not enough: a managed wrapper whose
	// admin is unresolved can carry most of the vendor's exposure (e.g. USDe behind a
	// deviation-timelock wrapper), and hiding the vendor row would leave the header total
	// unexplained by any row.
	const resolvedVendorExposure = new Map<string, number>()
	for (const a of admins)
		for (const v of a.vendors) {
			const k = v.toLowerCase()
			resolvedVendorExposure.set(k, (resolvedVendorExposure.get(k) ?? 0) + a.exposure_usd)
		}
	const unresolvedVendors = vendors.filter(
		(v) => (resolvedVendorExposure.get(v.provider.toLowerCase()) ?? 0) < v.exposure_usd * 0.9
	)
	const totalPct =
		totalDrainableUsd > 0 && supplyUsd != null && supplyUsd > 0
			? pctOfVault(Math.min(1, totalDrainableUsd / supplyUsd))
			: null
	const feedCount = vendors.length
	const controlCount = admins.length

	return (
		<Card padding="none">
			<div className="flex flex-col gap-2 border-b border-subtle bg-surface-elevated-1 px-3 py-3">
				<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
					<h4 className="label-md text-primary">Oracle dependencies</h4>
					<MetaLine>
						{feedCount > 0 ? `${feedCount} feed${feedCount === 1 ? '' : 's'}` : null}
						{controlCount > 0 ? `${controlCount} control point${controlCount === 1 ? '' : 's'}` : null}
					</MetaLine>
				</div>
				{totalDrainableUsd > 0 ? (
					<p className="flex flex-wrap items-baseline gap-x-1.5">
						<span className="body-sm text-secondary">Up to</span>
						<span className="mono-md-bold text-primary">
							{totalPct ??
								formatUsd(totalDrainableUsd, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
						</span>
						<span className="body-sm text-secondary">
							{totalPct ? `${shareWord} ` : ''}drainable if these feeds are mispriced
							{totalPct
								? ` · ${formatUsd(totalDrainableUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
								: ''}
						</span>
					</p>
				) : null}
				<p className="max-w-2xl body-sm text-secondary">
					Each price traces to a feed and the onchain admin that can move it. Compromise either to misprice the
					collateral and borrow against it. Per-row amounts overlap and are not summed.
				</p>
			</div>

			<ul className="divide-y divide-(--border-subtle)">
				{admins.map((o) => {
					const eoa = o.admin_kind === 'eoa'
					const mn = parseMofN(o.multisig)
					const p = pctOfVault(o.exposure_pct)
					return (
						<li
							key={o.admin_address}
							className="flex flex-col gap-1.5 px-3 py-2.5 body-md sm:flex-row sm:items-start sm:justify-between sm:gap-3"
						>
							<span className="flex min-w-0 flex-col gap-1">
								<span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
									<span className="label-md text-primary">{o.vendors.join(' / ') || 'Oracle feed'}</span>
									<span className="text-tertiary">·</span>
									<span className={eoa ? `label-md ${toneClasses('danger').text}` : 'label-md text-primary'}>
										{oracleAdminLabel(o)}
									</span>
									{mn ? <MofNPips m={mn.m} n={mn.n} /> : null}
								</span>
								{o.collateral_symbols.length > 0 ? (
									<span className="body-sm text-tertiary">prices {o.collateral_symbols.join(', ')}</span>
								) : null}
								<AddressActions
									address={o.admin_address}
									url={adminUrl(o.admin_address)}
									label="oracle admin address"
								/>
							</span>
							<span className="shrink-0 text-left sm:text-right">
								<span className="text-primary">
									{p ??
										formatUsd(o.exposure_usd, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}
								</span>
								{p ? (
									<span className="text-secondary">{` ${shareWord} · ${formatUsd(o.exposure_usd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}</span>
								) : null}
								<span className="block body-sm text-tertiary">
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
							className="flex flex-col gap-1.5 px-3 py-2.5 body-md sm:flex-row sm:items-start sm:justify-between sm:gap-3"
						>
							<span className="flex min-w-0 flex-col gap-1">
								<span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
									<span className="label-md text-primary">{v.provider}</span>
									<span className="text-tertiary">· onchain control not resolved</span>
								</span>
								{v.collateral_symbols.length > 0 ? (
									<span className="body-sm text-tertiary">prices {v.collateral_symbols.join(', ')}</span>
								) : null}
							</span>
							<span className="shrink-0 text-left sm:text-right">
								<span className="text-primary">
									{p ??
										formatUsd(v.exposure_usd, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}
								</span>
								{p ? (
									<span className="text-secondary">{` ${shareWord} · ${formatUsd(v.exposure_usd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}</span>
								) : null}
								<span className="block body-sm text-tertiary">mispriceable if this feed lies</span>
							</span>
						</li>
					)
				})}

				{vendorless.map((g) => {
					const immutable = g.kind === 'exchange-rate'
					const p = pctOfVault(supplyUsd != null && supplyUsd > 0 ? g.exposureUsd / supplyUsd : null)
					return (
						<li
							key={`vendorless-${g.kind}`}
							className="flex flex-col gap-1.5 px-3 py-2.5 body-md sm:flex-row sm:items-start sm:justify-between sm:gap-3"
						>
							<span className="flex min-w-0 flex-col gap-1">
								<span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
									<span className="label-md text-primary">
										{immutable ? 'Onchain exchange rate' : 'Unidentified feeds'}
									</span>
									<span className="text-tertiary">
										{immutable ? '· no external feed or admin' : '· vendor and onchain control not resolved'}
									</span>
								</span>
								<span className="body-sm text-tertiary">prices {g.symbols.join(', ')}</span>
							</span>
							<span className="shrink-0 text-left sm:text-right">
								<span className="text-primary">
									{p ??
										formatUsd(g.exposureUsd, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}
								</span>
								{p ? (
									<span className="text-secondary">{` ${shareWord} · ${formatUsd(g.exposureUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}</span>
								) : null}
								<span className="block body-sm text-tertiary">
									{immutable ? 'mispriceable only via the issuing contract' : 'mispriceable if these feeds lie'}
								</span>
							</span>
						</li>
					)
				})}
			</ul>
		</Card>
	)
}
