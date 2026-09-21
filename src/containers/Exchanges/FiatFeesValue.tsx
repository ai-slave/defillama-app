import { Hovercard } from '~/ui/Hovercard'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import type { ExchangeFiatFeeRow, ExchangeFiatFees } from './models'

export function fiatFeeSummary(fees: ExchangeFiatFees): string {
	return `${fees.onRamp.length} in · ${fees.offRamp.length} out`
}

function displayText(value: string) {
	return value === '' ? '–' : value
}

function FiatFeeTable({ label, rows }: { label: string; rows: Array<ExchangeFiatFeeRow> }) {
	return (
		<section className="flex flex-col gap-1.5">
			<h4 className="label-md text-primary">{label}</h4>
			{rows.length === 0 ? (
				<p className="body-sm text-tertiary">No authored fee routes.</p>
			) : (
				<div className="overflow-x-auto">
					<table className="min-w-[720px] border-separate border-spacing-0 body-sm">
						<thead>
							<tr className="text-left text-tertiary">
								<th className="border-b border-subtle px-2 py-1.5">Method</th>
								<th className="border-b border-subtle px-2 py-1.5">Currency</th>
								<th className="border-b border-subtle px-2 py-1.5">Fee</th>
								<th className="border-b border-subtle px-2 py-1.5">Minimum</th>
								<th className="border-b border-subtle px-2 py-1.5">Time</th>
								<th className="border-b border-subtle px-2 py-1.5">Notes</th>
								<th className="border-b border-subtle px-2 py-1.5">Source</th>
							</tr>
						</thead>
						<tbody>
							{keyedOccurrences(rows, (row) => JSON.stringify([row.method, row.currency])).map(({ item: row, key }) => (
								<tr key={key}>
									<td className="border-b border-subtle px-2 py-1.5 text-primary">{displayText(row.method)}</td>
									<td className="border-b border-subtle px-2 py-1.5 text-primary">{displayText(row.currency)}</td>
									<td className="border-b border-subtle px-2 py-1.5 text-primary">{displayText(row.fee)}</td>
									<td className="border-b border-subtle px-2 py-1.5 text-primary">{displayText(row.minimum)}</td>
									<td className="border-b border-subtle px-2 py-1.5 text-primary">{displayText(row.processingTime)}</td>
									<td className="max-w-72 border-b border-subtle px-2 py-1.5 text-secondary">
										{displayText(row.note)}
									</td>
									<td className="border-b border-subtle px-2 py-1.5">
										{row.source ? (
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

export function FiatFeesValue({ name, fees }: { name: string; fees: ExchangeFiatFees | null }) {
	if (fees === null) return <span className="text-tertiary">–</span>
	const summary = fiatFeeSummary(fees)
	return (
		<Hovercard
			placement="left-start"
			className="inline-flex rounded-md border border-subtle px-2 py-0.5 label-sm whitespace-nowrap text-link hover:bg-hover-row"
			render={
				<button
					type="button"
					aria-label={`${name} fiat fee details: ${fees.onRamp.length} on-ramp routes and ${fees.offRamp.length} off-ramp routes`}
				/>
			}
			contentClassName="w-[900px] p-3"
			content={
				<div className="flex flex-col gap-4">
					<h3 className="heading-xs">{name} authored fiat fees</h3>
					<FiatFeeTable label="On-ramp" rows={fees.onRamp} />
					<FiatFeeTable label="Off-ramp" rows={fees.offRamp} />
				</div>
			}
		>
			{summary}
		</Hovercard>
	)
}
