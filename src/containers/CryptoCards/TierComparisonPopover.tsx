import * as Ariakit from '@ariakit/react'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import type { CardTableRow, CardTierRollupField, CardTierRow } from './models'
import { VARIES_BY_TIER } from './models'

const TIER_COMPARISON_LABELS: Record<CardTierRollupField, string> = {
	region: 'Region',
	cashbackRate: 'Cashback',
	cashbackCurrency: 'Cashback currency',
	maxCashbackPerMonth: 'Monthly cap',
	annualFee: 'Annual fee',
	fxFee: 'FX fee',
	access: 'Requirements',
	custodyType: 'Custody',
	cardClassification: 'Type',
	network: 'Network',
	virtualPhysical: 'Card form',
	issuer: 'Issuer',
	atmFee: 'ATM fee',
	atmAllowance: 'ATM allowance',
	dailySpendingLimit: 'Daily limit',
	monthlySpendingLimit: 'Monthly limit',
	virtual: 'Virtual card',
	physical: 'Physical card',
	applePay: 'Apple Pay',
	googlePay: 'Google Pay',
	iban: 'IBAN'
}

function capitalize(value: string): string {
	return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`
}

function ComparisonValue({ tier, field }: { tier: CardTierRow; field: CardTierRollupField }) {
	const value = tier[field]
	if (value == null) return <span className="text-tertiary">Not disclosed</span>
	if (typeof value === 'boolean') {
		return (
			<span className="inline-flex items-center gap-1.5 whitespace-nowrap">
				<Icon
					name={value ? 'check' : 'x'}
					className={`size-4 ${value ? 'text-success' : 'text-tertiary'}`}
					aria-hidden="true"
				/>
				{value ? 'Yes' : 'No'}
			</span>
		)
	}
	if (field === 'cardClassification' || field === 'network' || field === 'custodyType') return capitalize(value)
	return value
}

export function TierComparisonTable({
	cardName,
	tiers,
	field,
	showCardName = false
}: {
	cardName: string
	tiers: Array<CardTierRow>
	field: CardTierRollupField
	showCardName?: boolean
}) {
	const label = TIER_COMPARISON_LABELS[field]
	const regionIsValue = field === 'region'
	return (
		<table
			className={`w-full table-auto border-collapse text-left body-sm ${regionIsValue ? 'min-w-72' : 'min-w-[28rem]'}`}
		>
			<caption className="sr-only">{`${label} by tier and region for ${cardName}`}</caption>
			<thead>
				<tr>
					<th
						scope="col"
						className="sticky top-0 z-1 border-b border-medium bg-overlay px-3 py-2 label-sm text-secondary"
					>
						{showCardName ? 'Card / tier' : 'Tier'}
					</th>
					{regionIsValue ? null : (
						<th
							scope="col"
							className="sticky top-0 z-1 border-b border-medium bg-overlay px-3 py-2 label-sm text-secondary"
						>
							Region
						</th>
					)}
					<th
						scope="col"
						className="sticky top-0 z-1 border-b border-medium bg-overlay px-3 py-2 label-sm text-secondary"
					>
						{label}
					</th>
				</tr>
			</thead>
			<tbody>
				{tiers.map((tier) => (
					<tr key={tier.tierId} className="border-b border-subtle last:border-b-0">
						<th scope="row" className="px-3 py-2 align-top font-medium text-primary">
							{showCardName ? `${tier.cardName} — ${tier.tierName}` : tier.tierName}
						</th>
						{regionIsValue ? null : <td className="px-3 py-2 align-top text-secondary">{tier.region}</td>}
						<td className="max-w-80 px-3 py-2 align-top text-primary">
							<ComparisonValue tier={tier} field={field} />
						</td>
					</tr>
				))}
			</tbody>
		</table>
	)
}

export function TierComparisonPopover({ row, field }: { row: CardTableRow; field: CardTierRollupField }) {
	const tiers = row.comparisonRows
	if (!tiers?.length) return <span className="text-tertiary">{VARIES_BY_TIER}</span>
	const label = TIER_COMPARISON_LABELS[field]
	const groupedByParent = row.rowKind === 'parent'
	return (
		<Hovercard
			placement="bottom-start"
			contentClassName="flex flex-col"
			render={
				<button
					type="button"
					className="-mx-1 -my-1 rounded-sm px-1 py-1 text-left text-tertiary underline decoration-dotted underline-offset-2 hover:text-secondary focus-visible:focus-ring"
					aria-label={`Show ${label.toLowerCase()} by ${groupedByParent ? 'card and tier' : 'tier'} for ${row.cardName}`}
				/>
			}
			content={
				<>
					{/* Full-bleed header: its divider reaches the card's edges above the table. */}
					<div className="-mx-3 -mt-3 flex items-start gap-3 border-b border-medium px-3 py-2">
						<div className="min-w-0 flex-1">
							<Ariakit.HovercardHeading render={<h2 />} className="label-md text-primary">
								{label} by {groupedByParent ? 'card and tier' : 'tier'}
							</Ariakit.HovercardHeading>
							<p className="truncate body-sm text-secondary">{row.cardName}</p>
						</div>
						<Ariakit.HovercardDismiss className="flex size-8 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-hover-row hover:text-primary focus-visible:focus-ring">
							<Icon name="x" className="size-4" aria-hidden="true" />
							<span className="sr-only">Close tier comparison</span>
						</Ariakit.HovercardDismiss>
					</div>
					{/* The table's cells carry their own padding, so it runs to the card's edges and scrolls sideways. */}
					<div className="-mx-3 -mb-3 overflow-x-auto">
						<TierComparisonTable cardName={row.cardName} tiers={tiers} field={field} showCardName={groupedByParent} />
					</div>
				</>
			}
		>
			{VARIES_BY_TIER}
		</Hovercard>
	)
}
