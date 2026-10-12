import { TagLink } from '~/ui/Tag'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import { ValueBadge } from './feePresentation'
import type { CryptoRailRowModel, CryptoRailsModel } from './models'

export function cryptoRailSummary(rails: CryptoRailsModel): string {
	return `${rails.deposit.length} in · ${rails.withdraw.length} out`
}

function displayText(value: string) {
	return value === '' ? '–' : value
}

function CryptoRailTable({ label, rows }: { label: string; rows: Array<CryptoRailRowModel> }) {
	return (
		<section className="flex flex-col gap-1.5">
			<h4 className="label-md text-primary">{label}</h4>
			{rows.length === 0 ? (
				<p className="body-sm text-tertiary">No authored routes.</p>
			) : (
				<div className="overflow-x-auto">
					<table className="min-w-[560px] border-separate border-spacing-0 body-sm">
						<thead>
							<tr className="text-left text-tertiary">
								<th className="border-b border-subtle px-2 py-1.5">Asset</th>
								<th className="border-b border-subtle px-2 py-1.5">Network</th>
								<th className="border-b border-subtle px-2 py-1.5">Fee</th>
								<th className="border-b border-subtle px-2 py-1.5">Minimum</th>
								<th className="border-b border-subtle px-2 py-1.5">Time</th>
								<th className="border-b border-subtle px-2 py-1.5">Notes</th>
								<th className="border-b border-subtle px-2 py-1.5">Source</th>
							</tr>
						</thead>
						<tbody>
							{keyedOccurrences(rows, (row) => JSON.stringify([row.asset, row.network])).map(({ item: row, key }) => (
								<tr key={key}>
									<td className="border-b border-subtle px-2 py-1.5 text-primary">{displayText(row.asset)}</td>
									<td className="border-b border-subtle px-2 py-1.5 text-primary">{displayText(row.network)}</td>
									<td className="border-b border-subtle px-2 py-1.5 text-primary">{displayText(row.fee)}</td>
									<td className="border-b border-subtle px-2 py-1.5 text-primary">{displayText(row.minimum)}</td>
									<td className="border-b border-subtle px-2 py-1.5 text-primary">{displayText(row.processingTime)}</td>
									<td className="max-w-72 border-b border-subtle px-2 py-1.5 text-secondary">
										{displayText(row.note)}
									</td>
									<td className="border-b border-subtle px-2 py-1.5">
										{row.source?.url ? (
											<TagLink href={row.source.url} target="_blank" rel="noopener noreferrer">
												{row.source.label}
											</TagLink>
										) : (
											<span className="text-tertiary">–</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	)
}

/** Chain-side twin of FiatFeesValue: deposit and withdrawal routes per asset and
 *  network, L2s included. Sparse today — most venues have only the derived BTC
 *  withdrawal row until more routes are authored. */
export function CryptoRailsValue({ name, rails }: { name: string; rails: CryptoRailsModel | null }) {
	if (rails === null) return <span className="text-tertiary">–</span>
	return (
		<ValueBadge
			status="neutral"
			ariaLabel={`${name} crypto routes: ${rails.deposit.length} deposit and ${rails.withdraw.length} withdrawal`}
			width="fit"
			content={
				<div className="flex flex-col gap-4">
					<h3 className="heading-xs">{name} crypto deposit and withdrawal fees</h3>
					<CryptoRailTable label="Deposit" rows={rails.deposit} />
					<CryptoRailTable label="Withdraw" rows={rails.withdraw} />
				</div>
			}
		>
			{cryptoRailSummary(rails)}
		</ValueBadge>
	)
}
