import type { ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { RaisesTotal } from '~/containers/Raises/RaisesTotal'
import { summarizeRaises } from '~/containers/Raises/summary'
import { Card } from '~/ui/Card'
import { Icon, type IIcon } from '~/ui/Icon'
import { Tag } from '~/ui/Tag'
import { formatDate } from '~/utils/dateFormat'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import type { ExchangeProfileModel } from './models'

function HistoryHeader({ icon, title, count }: { icon: IIcon['name']; title: string; count?: number }) {
	return (
		<div className="flex items-center gap-2">
			<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-link">
				<Icon name={icon} height={17} width={17} />
			</span>
			<h2 className="label-lg">{title}</h2>
			{count != null ? <Tag>{count}</Tag> : null}
		</div>
	)
}

function HistorySection({
	icon,
	title,
	count,
	children
}: {
	icon: IIcon['name']
	title: string
	count: number
	children: ReactNode
}) {
	return (
		<Card as="details" open padding="none" className="group/history overflow-hidden">
			<summary className="flex cursor-pointer items-center border-b border-subtle px-3 py-2.5">
				<HistoryHeader icon={icon} title={title} count={count} />
				<Icon
					name="chevron-down"
					height={16}
					width={16}
					className="ml-auto text-tertiary transition-transform group-open/history:rotate-180"
				/>
			</summary>
			<div className="divide-subtle divide-y">{children}</div>
		</Card>
	)
}

function HistoryRecord({ details, amount }: { details: ReactNode; amount: ReactNode }) {
	return (
		<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 p-3 hover:bg-hover-row">
			<div className="min-w-0">{details}</div>
			<div className="text-right font-jetbrains font-semibold">{amount}</div>
		</div>
	)
}

export function ProfileHistory({ profile }: { profile: ExchangeProfileModel }) {
	const totalHacked = profile.hacks.reduce((sum, hack) => sum + (hack.amountUsd ?? 0), 0)
	const hasKnownHackTotal = profile.hacks.some((hack) => hack.amountUsd != null)
	const hackedTotalLabel =
		profile.hacks.length === 0
			? 'No recorded hacks'
			: hasKnownHackTotal
				? (formatUsd(totalHacked, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'Unknown')
				: 'Amount unknown'
	return (
		<section className="flex flex-col gap-2" aria-label="Exchange hacks and raises">
			<Card as="section" padding="none" className="overflow-hidden">
				<div className="border-b border-subtle px-3 py-2.5">
					<HistoryHeader icon="bar-chart-2" title="Overview" />
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2">
					<div className="p-3">
						<p className="label-sm text-tertiary">Funds lost in recorded hacks</p>
						<p className="mt-1 font-jetbrains text-xl font-semibold">{hackedTotalLabel}</p>
					</div>
					<div className="border-t border-subtle p-3 sm:border-t-0 sm:border-l">
						<p className="label-sm text-tertiary">Total disclosed raises</p>
						<p className="mt-1 font-jetbrains text-xl font-semibold">
							{profile.raises.length > 0 ? (
								<RaisesTotal {...summarizeRaises(profile.raises)} />
							) : (
								(formatUsd(null, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'Unknown')
							)}
						</p>
					</div>
				</div>
			</Card>

			{profile.hacks.length > 0 ? (
				<HistorySection icon="alert-triangle" title="Hacks" count={profile.hacks.length}>
					{keyedOccurrences(profile.hacks, (hack) => JSON.stringify([hack.date, hack.name, hack.technique])).map(
						({ item: hack, key }) => (
							<HistoryRecord
								key={key}
								details={
									<>
										<p className="label-md">{hack.technique ?? hack.name}</p>
										<p className="mt-0.5 body-sm text-tertiary">
											{hack.date ? (formatDate(hack.date, { input: 'seconds' }) ?? 'Unknown date') : 'Unknown date'}
										</p>
										{hack.returnedFundsUsd != null ? (
											<p className="mt-1 body-sm text-secondary">
												Returned funds: {formatUsd(hack.returnedFundsUsd, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'Unknown'}
											</p>
										) : null}
									</>
								}
								amount={formatUsd(hack.amountUsd, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'Unknown'}
							/>
						)
					)}
				</HistorySection>
			) : null}

			{profile.raises.length > 0 ? (
				<HistorySection icon="trending-up" title="Raises" count={profile.raises.length}>
					{keyedOccurrences(profile.raises, (raise) => JSON.stringify([raise.date, raise.round, raise.sourceUrl])).map(
						({ item: raise, key }) => (
							<HistoryRecord
								key={key}
								details={
									<>
										<p className="label-md">{raise.round || 'Funding round'}</p>
										<p className="mt-0.5 body-sm text-tertiary">{formatDate(raise.date, { input: 'seconds' })}</p>
										{raise.valuationUsd != null ? (
											<p className="mt-1 body-sm text-secondary">
												Valuation: {formatUsd(raise.valuationUsd, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'Unknown'}
											</p>
										) : null}
										{raise.investors.length > 0 ? (
											<p className="mt-1 body-sm text-secondary">Investors: {raise.investors.join(', ')}</p>
										) : null}
									</>
								}
								amount={
									raise.sourceUrl ? (
										<BasicLink
											href={raise.sourceUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 text-link hover:underline"
										>
											{formatUsd(raise.amountUsd, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'Unknown'}
											<Icon name="external-link" height={12} width={12} />
										</BasicLink>
									) : (
										(formatUsd(raise.amountUsd, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'Unknown')
									)
								}
							/>
						)
					)}
				</HistorySection>
			) : null}
		</section>
	)
}
