import * as Ariakit from '@ariakit/react'
import { popoverHovercardSurfaceStyles } from '~/ui/Popover'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
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
											<a
												href={row.source.url}
												target="_blank"
												rel="noopener noreferrer"
												className="text-link hover:underline"
											>
												{row.source.label}
											</a>
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
		<Ariakit.PopoverProvider placement="left-start">
			<Ariakit.PopoverDisclosure
				type="button"
				className="inline-flex rounded-md border border-subtle px-2 py-0.5 label-sm whitespace-nowrap text-link hover:bg-hover-row"
				aria-label={`${name} crypto routes: ${rails.deposit.length} deposit and ${rails.withdraw.length} withdrawal`}
			>
				{cryptoRailSummary(rails)}
			</Ariakit.PopoverDisclosure>
			<Ariakit.Popover
				unmountOnHide
				gutter={6}
				overflowPadding={16}
				className={`${popoverHovercardSurfaceStyles} w-[min(760px,calc(100vw-32px))] p-3`}
				portal
			>
				<div className="flex flex-col gap-4">
					<h3 className="heading-xs">{name} crypto deposit and withdrawal fees</h3>
					<CryptoRailTable label="Deposit" rows={rails.deposit} />
					<CryptoRailTable label="Withdraw" rows={rails.withdraw} />
				</div>
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}
