import type { BlockExplorersResponse } from '~/api/types'
import { Icon } from '~/components/Icon'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { AddressActions } from '../primitives/AddressActions'
import type { MarketOracle } from '../types'
import { isProvenVendor, PtPricingChip } from './collateralShared'

const ATTRIBUTION_LABEL: Record<string, string> = {
	market_exact: 'market oracle',
	asset_fallback: 'asset fallback',
	api_address_only: 'address only',
	same_asset_no_oracle: 'no oracle dependency',
	zero_lltv_no_oracle: 'no oracle dependency',
	unclassified: 'unclassified'
}

// Catch-all for markets whose collateral didn't match a collateral row (null/unmapped
// collateral_asset). Renders nothing when there are none.
export function MarketOracleTable({
	markets,
	explorers
}: {
	markets: MarketOracle[]
	explorers?: BlockExplorersResponse
}) {
	if (!markets.length) return null
	const rows = [...markets].sort(
		(a, b) => (b.allocation_usd ?? 0) - (a.allocation_usd ?? 0) || (b.lltv ?? 0) - (a.lltv ?? 0)
	)
	return (
		<details className="group smooth-disclosure overflow-hidden rounded-md border border-(--legacy-cards-border)">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-(--legacy-bg-main)/50">
				<span className="font-medium text-(--legacy-text-primary)">
					Markets not mapped above{' '}
					<span className="font-normal text-(--legacy-text-secondary)">· {markets.length}</span>
				</span>
				<Icon
					name="chevron-down"
					className="size-3.5 text-(--legacy-text-secondary) transition-transform group-open:rotate-180"
				/>
			</summary>
			<div className="overflow-x-auto border-t border-(--legacy-cards-border)">
				<table className="w-full text-xs">
					<thead>
						<tr className="text-left text-[10px] tracking-wide text-(--legacy-text-secondary) uppercase">
							<th className="px-3 py-2 font-medium">Collateral → Loan</th>
							<th className="px-3 py-2 text-right font-medium">LLTV</th>
							<th className="px-3 py-2 font-medium">Oracle</th>
							<th className="px-3 py-2 font-medium">Vendor</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-(--legacy-cards-border)">
						{rows.map((m) => {
							const coChain = m.collateral_asset?.chain ?? m.loan_asset?.chain
							const oracleUrl =
								explorers && m.oracle_address && coChain
									? (getBlockExplorerNew({
											apiResponse: explorers,
											address: m.oracle_address,
											chainName: coChain,
											urlType: 'address'
										})?.url ?? null)
									: null
							const vendor = m.oracle_providers.filter(isProvenVendor).join(' / ')
							const attribution = ATTRIBUTION_LABEL[m.attribution] ?? null
							return (
								<tr key={m.market_id} className="align-top text-(--legacy-text-secondary)">
									<td className="px-3 py-2 text-(--legacy-text-primary)">
										<span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
											<span>
												{m.collateral_asset?.symbol ?? '—'} <span className="text-(--legacy-text-tertiary)">→</span>{' '}
												{m.loan_asset?.symbol ?? '—'}
											</span>
											{m.pt_pricing ? <PtPricingChip pricing={m.pt_pricing} /> : null}
										</span>
									</td>
									<td className="px-3 py-2 text-right tabular-nums">
										{m.lltv != null ? `${Math.round(m.lltv * 100)}%` : '—'}
									</td>
									<td className="px-3 py-2">
										{m.oracle_address ? (
											<AddressActions address={m.oracle_address} url={oracleUrl} label="market oracle address" />
										) : (
											<span className="text-(--legacy-text-tertiary)">none</span>
										)}
										{attribution ? (
											<span className="mt-0.5 block text-[10px] text-(--legacy-text-tertiary)">{attribution}</span>
										) : null}
									</td>
									<td className="px-3 py-2">
										{vendor || <span className="text-(--legacy-text-tertiary)">unidentified</span>}
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</details>
	)
}
