import dayjs from 'dayjs'
import * as React from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { Change } from '~/ui/Change'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { Definition, Tooltip } from '~/ui/Tooltip'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatUsd, formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import { getEmissionEventAmount } from './eventAmount'
import type { EnrichedProtocolEmission } from './queries'
import { TopThreeRow } from './TopThreeRow'

interface PastUnlockPriceImpactProps {
	data: Array<EnrichedProtocolEmission>
	title?: string
	className?: string
	initialNowSec: number
}

interface UnlockBreakdown {
	name: string
	amount: number
	timestamp: number
	unlockType: string
}

const DESCRIPTION_REGEX =
	/(?:of (.+?) tokens (?:will be|were) unlocked)|(?:will (?:increase|decrease) from \{tokens\[0\]\} to \{tokens\[1\]\} tokens per week from (.+?) on {timestamp})|(?:from (.+?) on {timestamp})|(?:was (?:increased|decreased) from \{tokens\[0\]\} to \{tokens\[1\]\} tokens per week from (.+?) on {timestamp})/

const parseDescription = (description: string): string => {
	const matches = description.match(DESCRIPTION_REGEX)
	return matches?.[1] || matches?.[2] || matches?.[3] || matches?.[4] || ''
}

export function PastUnlockPriceImpact({ data, title, className, initialNowSec }: PastUnlockPriceImpactProps) {
	const [now] = React.useState(() => Math.floor(initialNowSec))
	const { topImpacts } = React.useMemo(() => {
		const protocolImpacts = new Map<
			string,
			{
				name: string
				symbol: string
				geckoId?: string | null
				impact: number
				timestamp: number
				unlockBreakdown: Array<UnlockBreakdown>
				cliffAmount: number
				linearWeeklyAmount: number
				maxSupply: number
				mcap?: number
				price: number
			}
		>()

		for (const protocol of data) {
			if (protocol.historicalPrice.length < 8 || protocol.lastEvent.length === 0) continue
			if (protocol.tPrice === null || protocol.tPrice <= 0 || protocol.tSymbol === null) continue
			const thirtyDaysAgo = now - 30 * 24 * 60 * 60
			const latestTimestamp = protocol.lastEvent[0]!.timestamp
			if (latestTimestamp < thirtyDaysAgo) continue

			let cliffAmount = 0
			let linearWeeklyAmount = 0
			const breakdown: Array<UnlockBreakdown> = []
			for (const event of protocol.lastEvent) {
				const amount = getEmissionEventAmount(event)
				if (amount === null || amount <= 0) continue
				if (event.unlockType === 'linear') linearWeeklyAmount += amount
				else cliffAmount += amount
				breakdown.push({
					name: parseDescription(event.description),
					amount,
					timestamp: event.timestamp,
					unlockType: event.unlockType
				})
			}
			if (cliffAmount === 0 && linearWeeklyAmount === 0) continue

			const priceAtUnlock = protocol.historicalPrice[7]![1]
			const priceAfter7d = protocol.historicalPrice[protocol.historicalPrice.length - 1]![1]
			if (priceAtUnlock <= 0) continue
			const impact = ((priceAfter7d - priceAtUnlock) / priceAtUnlock) * 100

			protocolImpacts.set(protocol.name, {
				name: protocol.name,
				symbol: protocol.tSymbol,
				...(protocol.gecko_id !== undefined ? { geckoId: protocol.gecko_id } : {}),
				impact,
				timestamp: latestTimestamp,
				unlockBreakdown: breakdown,
				cliffAmount,
				linearWeeklyAmount,
				maxSupply: protocol.maxSupply,
				...(protocol.mcap !== undefined ? { mcap: protocol.mcap } : {}),
				price: protocol.tPrice
			})
		}

		return {
			topImpacts: Array.from(protocolImpacts.values())
				.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
				.slice(0, 3)
		}
	}, [data, now])

	return (
		<div className={`flex flex-col gap-3 text-primary ${className ?? ''}`}>
			<Definition
				className="heading-xs"
				content="Observed price change during the 7 days after the most recent unlock, excluding non-circulating and farming emissions. This does not imply causation. Sorted by absolute price change."
			>
				{title}
			</Definition>

			{topImpacts.map((impact) => {
				const summaries: Array<{ label: string; amount: number; displayUnit: '' | 'per week' }> = []
				if (impact.cliffAmount > 0) {
					summaries.push({ label: 'Cliff Unlock', amount: impact.cliffAmount, displayUnit: '' })
				}
				if (impact.linearWeeklyAmount > 0) {
					summaries.push({
						label: 'Weekly Unlock Rate',
						amount: impact.linearWeeklyAmount,
						displayUnit: 'per week'
					})
				}
				return (
					<TopThreeRow
						key={impact.name}
						name={impact.name}
						symbol={impact.symbol}
						{...(impact.geckoId !== undefined ? { geckoId: impact.geckoId } : {})}
						value={
							<span className="mono-md-bold">
								<Change value={impact.impact} />
							</span>
						}
						trailingIcon={
							<Hovercard
								width="lg"
								contentClassName="flex flex-col gap-2"
								render={
									<button
										type="button"
										aria-label={`Unlock details for ${impact.name}`}
										className="text-tertiary hover:text-secondary"
									/>
								}
								content={
									<>
										<span className="flex items-center justify-between gap-4">
											<span className="flex items-center gap-2 font-medium">
												<TokenLogo
													name={impact.name}
													kind="token"
													size={30}
													fallbackSrc={impact.geckoId ? geckoTokenIconUrl(impact.geckoId) : null}
													alt={`Logo of ${impact.name}`}
												/>
												{impact.symbol}
											</span>
											<span className="flex flex-col items-end">
												<span className="font-medium">{dayjs(impact.timestamp * 1e3).format('MMM D, YYYY')}</span>
												<span className="body-sm text-tertiary">
													{dayjs(impact.timestamp * 1e3).format('HH:mm')} GMT
													{dayjs(impact.timestamp * 1e3).format('Z')}
												</span>
											</span>
										</span>

										<hr className="border-medium" />

										<span className="flex flex-col gap-4">
											{impact.unlockBreakdown.map((item) => {
												const percentage = impact.maxSupply > 0 ? (item.amount / impact.maxSupply) * 100 : null
												const percentageFloat =
													impact.mcap != null && impact.mcap > 0
														? ((item.amount * impact.price) / impact.mcap) * 100
														: null
												const usdValue = item.amount * impact.price

												return (
													<span
														className="flex flex-col gap-1"
														key={`unlock-${item.name}-${percentage}-${percentageFloat}-${usdValue}`}
													>
														<span className="flex items-center justify-between gap-2">
															<span className="flex items-center gap-2">
																{item.name}
																<Tooltip content={item.unlockType === 'linear' ? 'Linear Unlock' : 'Cliff Unlock'}>
																	<Icon
																		name={item.unlockType === 'linear' ? 'linear-unlock' : 'cliff-unlock'}
																		className="size-4 text-tertiary"
																	/>
																</Tooltip>
															</span>
															<span className="font-medium">
																{formatUsd(usdValue, {
																	compact: true,
																	minimumCompactValue: 1_000_000,
																	compactSuffix: 'lowercase'
																})}
																{item.unlockType === 'linear' ? ' / week' : ''}
															</span>
														</span>
														<span className="flex items-center justify-between gap-2 body-sm text-tertiary">
															<span>
																{percentage != null ? (
																	<>
																		{formatCompactNumber(percentage, {
																			minimumCompactValue: 1_000_000,
																			compactSuffix: 'lowercase'
																		})}
																		%
																	</>
																) : null}{' '}
																{percentageFloat != null ? (
																	<>
																		(
																		{formatCompactNumber(percentageFloat, {
																			minimumCompactValue: 1_000_000,
																			compactSuffix: 'lowercase'
																		})}
																		% of float)
																	</>
																) : null}
															</span>
															<span>
																{formatCompactNumber(item.amount, {
																	minimumCompactValue: 1_000_000,
																	compactSuffix: 'lowercase'
																})}{' '}
																{impact.symbol}
																{item.unlockType === 'linear' ? ' / week' : ''}
															</span>
														</span>
													</span>
												)
											})}
										</span>
										<hr className="border-medium" />

										<span className="flex flex-col gap-2">
											{summaries.map((summary) => {
												const usdValue = summary.amount * impact.price
												return (
													<span key={summary.label} className="flex flex-col gap-1">
														<span className="flex items-center justify-between gap-2 font-semibold">
															<span>{summary.label}</span>
															<span>
																{formatUsd(usdValue, {
																	compact: true,
																	minimumCompactValue: 1_000_000,
																	compactSuffix: 'lowercase'
																})}
																{summary.displayUnit ? ' / week' : ''}
															</span>
														</span>
														<span className="flex items-center justify-between gap-2 body-sm text-tertiary">
															<span>
																{impact.maxSupply > 0
																	? formatPercent(summary.amount / impact.maxSupply, {
																			input: 'fraction',
																			compact: true
																		})
																	: null}
																{impact.mcap != null && impact.mcap > 0
																	? ` (${formatPercent(usdValue / impact.mcap, { input: 'fraction', compact: true })} of float)`
																	: null}
															</span>
															<span>
																{formatCompactNumber(summary.amount, {
																	minimumCompactValue: 1_000_000,
																	compactSuffix: 'lowercase'
																})}{' '}
																{impact.symbol}
																{summary.displayUnit ? ' / week' : ''}
															</span>
														</span>
													</span>
												)
											})}
										</span>
									</>
								}
							>
								<Icon name="help-circle" className="size-4" />
							</Hovercard>
						}
					/>
				)
			})}
		</div>
	)
}
