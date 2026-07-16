import type { BlockExplorersResponse } from '~/api/types'
import { Icon } from '~/components/Icon'
import { Card } from '~/ui/Card'
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
		<Card as="details" padding="none" className="group smooth-disclosure overflow-hidden">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 label-md hover:bg-hover-row">
				<span className="label-md text-primary">
					Markets not mapped above <span className="font-normal text-secondary">· {markets.length}</span>
				</span>
				<Icon name="chevron-down" className="size-3.5 text-secondary transition-transform group-open:rotate-180" />
			</summary>
			<div className="overflow-x-auto border-t border-subtle">
				<table className="w-full">
					<thead>
						<tr className="text-left text-sm font-medium text-secondary uppercase">
							<th className="px-3 py-2">Collateral → Loan</th>
							<th className="px-3 py-2 text-right">LLTV</th>
							<th className="px-3 py-2">Oracle</th>
							<th className="px-3 py-2">Vendor</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-(--border-subtle)">
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
								<tr key={m.market_id} className="align-top text-secondary">
									<td className="px-3 py-2 text-primary">
										<span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
											<span>
												{m.collateral_asset?.symbol ?? '—'} <span className="text-tertiary">→</span>{' '}
												{m.loan_asset?.symbol ?? '—'}
											</span>
											{m.pt_pricing ? <PtPricingChip pricing={m.pt_pricing} /> : null}
										</span>
									</td>
									<td className="px-3 py-2 text-right">{m.lltv != null ? `${Math.round(m.lltv * 100)}%` : '—'}</td>
									<td className="px-3 py-2">
										{m.oracle_address ? (
											<AddressActions address={m.oracle_address} url={oracleUrl} label="market oracle address" />
										) : (
											<span className="text-tertiary">none</span>
										)}
										{attribution ? <span className="mt-0.5 block body-xs text-tertiary">{attribution}</span> : null}
									</td>
									<td className="px-3 py-2">{vendor || <span className="text-tertiary">unidentified</span>}</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</Card>
	)
}
