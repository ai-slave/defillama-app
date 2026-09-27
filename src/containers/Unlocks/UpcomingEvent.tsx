import * as Ariakit from '@ariakit/react'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { buttonStyles } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { Tooltip } from '~/ui/Tooltip'
import { generateGoogleCalendarUrl } from '~/utils/calendar'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatUsd, formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import type { EmissionEvent } from './api.types'
import { getEmissionEventAmount, isUnknownEmissionEvent } from './eventAmount'

interface CalendarButtonProps {
	event: {
		timestamp: number
	}
	tokenName: string
	tokenValue: string
	isProtocolPage: boolean
}

function ProtocolPageButton() {
	return (
		<Ariakit.MenuButton className="flex items-center gap-2 rounded-sm p-2 hover:bg-hover-row focus-visible:bg-hover-row">
			<Icon name="calendar-plus" width={16} height={16} />
			Add to Calendar
		</Ariakit.MenuButton>
	)
}

function RegularButton() {
	return (
		<Ariakit.MenuButton
			className={buttonStyles({ variant: 'ghost', size: 'md', square: true })}
			aria-label="Add to calendar"
		>
			<Icon name="calendar-plus" width={16} height={16} />
		</Ariakit.MenuButton>
	)
}

function CalendarButton({ event, tokenName, tokenValue, isProtocolPage }: CalendarButtonProps) {
	return (
		<Ariakit.MenuProvider>
			{isProtocolPage ? <ProtocolPageButton /> : <RegularButton />}

			<MenuSurface variant="actions" className="shadow-sm">
				<MenuItem
					render={
						<a
							href={generateGoogleCalendarUrl(event, tokenName, tokenValue)}
							target="_blank"
							rel="noopener noreferrer"
						/>
					}
					className="border-b border-subtle"
				>
					<Icon name="external-link" width={16} height={16} />
					Google Calendar
				</MenuItem>

				<MenuItem
					render={
						<a
							href={`/api/dynamic/calendar/${encodeURIComponent(tokenName)}?${new URLSearchParams({
								timestamp: String(event.timestamp),
								value: tokenValue,
								name: tokenName
							})}`}
						/>
					}
				>
					<Icon name="download-cloud" width={16} height={16} />
					Other Calendars Apps
				</MenuItem>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}

interface UpcomingEventProps {
	timestamp: number
	event: Array<EmissionEvent>
	price: number | null | undefined
	symbol: string | null | undefined
	mcap: number | null | undefined
	maxSupply: number | null | undefined
	name: string
	geckoId?: string | null
	isProtocolPage?: boolean
	/** The page's clock at render time, so the server and the hydrating client count from the same second. */
	initialNowSec: number
}

interface UnlockBreakdown {
	name: string
	amount: number
	isBurn: boolean
	displayUnit: '' | 'per week'
	timestamp: number
	unlockType: string
	endTime: number | null
	usdValue: number | null
	percentage: number | null
	percentageFloat: number | null
}

interface EventSummary {
	label: 'Cliff Unlock' | 'Cliff Burn' | 'Weekly Unlock Rate' | 'Weekly Burn Rate'
	amount: number
	displayUnit: '' | 'per week'
	usdValue: number | null
	percentage: number | null
	percentageFloat: number | null
}

const formatTimeAgo = (timestamp: number) => {
	const now = dayjs()
	const eventDate = dayjs.unix(timestamp)

	const elapsedYears = now.diff(eventDate, 'year')
	const afterYears = eventDate.add(elapsedYears, 'year')
	const elapsedMonths = now.diff(afterYears, 'month')
	const afterMonths = afterYears.add(elapsedMonths, 'month')
	const elapsedDays = now.diff(afterMonths, 'day')

	if (elapsedYears > 0) {
		return elapsedMonths > 0 ? `${elapsedYears}Y ${elapsedMonths}M ago` : `${elapsedYears}Y ago`
	}

	if (elapsedMonths > 0) {
		return elapsedDays > 0 ? `${elapsedMonths}M ${elapsedDays}D ago` : `${elapsedMonths}M ago`
	}

	if (elapsedDays > 0) {
		return `${elapsedDays}D ago`
	}

	const elapsedHours = now.diff(eventDate, 'hour')
	if (elapsedHours > 0) {
		return `${elapsedHours}H ago`
	}

	return 'just now'
}

const formatCountdownBadge = (days: number, hours: number, minutes: number, seconds: number) => {
	if (days < 365) {
		return `${days}D ${hours}H ${minutes}M ${seconds}S`
	}

	const years = Math.floor(days / 365)
	const remainingDays = days % 365
	const months = Math.floor(remainingDays / 30)
	const daysRemainder = remainingDays % 30

	return `${years}Y ${months}MO ${daysRemainder}D ${hours}H ${minutes}M ${seconds}S`
}

const countdownTileStyles =
	'inline-flex min-h-8 w-16 items-center justify-center rounded-lg bg-surface-elevated-2 px-2 py-1.5 label-md text-primary tabular-nums'

export function UpcomingEvent({
	timestamp,
	event,
	price,
	symbol,
	mcap,
	maxSupply,
	name,
	geckoId,
	isProtocolPage = false,
	initialNowSec
}: UpcomingEventProps) {
	const tokenSymbol = symbol ? symbol.toUpperCase() : ''
	const { currentUnlockBreakdown, eventSummaries, calendarTokenValue } = useMemo(() => {
		const breakdown: Array<UnlockBreakdown> = []
		let hasCliffUnlock = false
		let hasCliffBurn = false
		let hasLinearUnlock = false
		let hasLinearBurn = false
		let cliffUnlockAmount = 0
		let cliffBurnAmount = 0
		let linearWeeklyUnlockAmount = 0
		let linearWeeklyBurnAmount = 0
		for (const emissionEvent of event) {
			if (isUnknownEmissionEvent(emissionEvent)) continue
			const { description, timestamp: eventTimestamp, unlockType } = emissionEvent
			const regex =
				/(?:of (.+?) tokens (?:will be|were) unlocked)|(?:will (?:increase|decrease) from \{tokens\[0\]\} to \{tokens\[1\]\} tokens per week from (.+?) on {timestamp})|(?:from (.+?) on {timestamp})|(?:was (?:increased|decreased) from \{tokens\[0\]\} to \{tokens\[1\]\} tokens per week from (.+?) on {timestamp})/
			const matches = description.match(regex)
			const eventName = matches?.[1] || matches?.[2] || matches?.[3] || matches?.[4] || ''

			const signedAmount = getEmissionEventAmount(emissionEvent)
			if (signedAmount === null) continue
			const isBurn = signedAmount < 0
			const amount = Math.abs(signedAmount)
			let displayUnit: UnlockBreakdown['displayUnit']
			if (unlockType === 'linear') {
				if (isBurn) {
					hasLinearBurn = true
					linearWeeklyBurnAmount += amount
				} else {
					hasLinearUnlock = true
					linearWeeklyUnlockAmount += amount
				}
				displayUnit = 'per week'
			} else {
				if (isBurn) {
					hasCliffBurn = true
					cliffBurnAmount += amount
				} else {
					hasCliffUnlock = true
					cliffUnlockAmount += amount
				}
				displayUnit = ''
			}
			const usdValue = price != null && price > 0 ? amount * price : null
			const percentage = maxSupply != null && maxSupply > 0 ? (amount / maxSupply) * 100 : null
			const percentageFloat = usdValue !== null && mcap != null && mcap > 0 ? (usdValue / mcap) * 100 : null
			const endTime = unlockType === 'linear' ? eventTimestamp + emissionEvent.rateDurationDays * 86_400 : null

			breakdown.push({
				name: eventName,
				amount,
				isBurn,
				displayUnit,
				timestamp: eventTimestamp,
				unlockType,
				endTime,
				usdValue,
				percentage,
				percentageFloat
			})
		}

		const eventSummaries: Array<EventSummary> = []
		if (hasCliffUnlock) {
			const usdValue = price != null && price > 0 ? cliffUnlockAmount * price : null
			eventSummaries.push({
				label: 'Cliff Unlock',
				amount: cliffUnlockAmount,
				displayUnit: '',
				usdValue,
				percentage: maxSupply != null && maxSupply > 0 ? (cliffUnlockAmount / maxSupply) * 100 : null,
				percentageFloat: usdValue !== null && mcap != null && mcap > 0 ? (usdValue / mcap) * 100 : null
			})
		}
		if (hasCliffBurn) {
			const usdValue = price != null && price > 0 ? cliffBurnAmount * price : null
			eventSummaries.push({
				label: 'Cliff Burn',
				amount: cliffBurnAmount,
				displayUnit: '',
				usdValue,
				percentage: maxSupply != null && maxSupply > 0 ? (cliffBurnAmount / maxSupply) * 100 : null,
				percentageFloat: usdValue !== null && mcap != null && mcap > 0 ? (usdValue / mcap) * 100 : null
			})
		}
		if (hasLinearUnlock) {
			const usdValue = price != null && price > 0 ? linearWeeklyUnlockAmount * price : null
			eventSummaries.push({
				label: 'Weekly Unlock Rate',
				amount: linearWeeklyUnlockAmount,
				displayUnit: 'per week',
				usdValue,
				percentage: maxSupply != null && maxSupply > 0 ? (linearWeeklyUnlockAmount / maxSupply) * 100 : null,
				percentageFloat: usdValue !== null && mcap != null && mcap > 0 ? (usdValue / mcap) * 100 : null
			})
		}
		if (hasLinearBurn) {
			const usdValue = price != null && price > 0 ? linearWeeklyBurnAmount * price : null
			eventSummaries.push({
				label: 'Weekly Burn Rate',
				amount: linearWeeklyBurnAmount,
				displayUnit: 'per week',
				usdValue,
				percentage: maxSupply != null && maxSupply > 0 ? (linearWeeklyBurnAmount / maxSupply) * 100 : null,
				percentageFloat: usdValue !== null && mcap != null && mcap > 0 ? (usdValue / mcap) * 100 : null
			})
		}
		const calendarTokenValue =
			eventSummaries.length === 0
				? 'Unavailable'
				: eventSummaries
						.map((summary) => {
							const value =
								summary.usdValue !== null
									? formatUsd(summary.usdValue, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})
									: `${formatCompactNumber(summary.amount, {
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})} ${tokenSymbol}`
							return `${summary.label}: ${value}${summary.displayUnit ? ' / week' : ''}`
						})
						.join('; ')

		return {
			currentUnlockBreakdown: breakdown,
			eventSummaries,
			calendarTokenValue
		}
	}, [event, price, maxSupply, mcap, tokenSymbol])

	// One-second ticks: the countdown shows seconds.
	const nowSec = useNowSeconds(initialNowSec, 1000)
	const timeLeft = Math.max(0, timestamp - nowSec)
	const days = Math.floor(timeLeft / 86_400)
	const hours = Math.floor((timeLeft - 86_400 * days) / 3600)
	const minutes = Math.floor((timeLeft - 86_400 * days - 3600 * hours) / 60)
	const seconds = Math.floor(timeLeft - 86_400 * days - 3600 * hours - minutes * 60)

	const renderBreakdownRow = (item: UnlockBreakdown, variant: 'protocol' | 'hover', index: number) => {
		const RowTag = variant === 'protocol' ? 'div' : 'span'
		const LineTag = variant === 'protocol' ? 'div' : 'span'
		const iconSize = variant === 'protocol' ? 14 : 16
		const rowClass = variant === 'protocol' ? 'flex flex-col gap-0.5' : 'flex flex-col gap-1'
		const lineClass = variant === 'protocol' ? 'body-md text-primary' : 'text-sm'
		const subLineClass = variant === 'protocol' ? 'body-sm text-secondary' : 'text-xs text-secondary'
		const suffixClass = variant === 'protocol' ? 'body-sm text-tertiary' : 'text-xs text-tertiary'
		const valueClass = variant === 'protocol' ? '' : 'font-medium'
		const isOngoing = item.endTime != null && nowSec >= item.timestamp && nowSec <= item.endTime

		return (
			<RowTag className={rowClass} key={`${item.name}-${item.amount}-${index}`}>
				<LineTag className={`flex items-center justify-between gap-2 ${lineClass}`}>
					<span className="flex items-center gap-1.5">
						{item.name}
						{isOngoing ? ' (Ongoing)' : null}
						<Tooltip
							content={
								item.isBurn
									? item.unlockType === 'linear'
										? 'Linear Burn'
										: 'Cliff Burn'
									: item.unlockType === 'linear'
										? 'Linear Unlock'
										: 'Cliff Unlock'
							}
						>
							<Icon
								name={item.unlockType === 'linear' ? 'linear-unlock' : 'cliff-unlock'}
								height={iconSize}
								width={iconSize}
								className="text-tertiary"
							/>
						</Tooltip>
					</span>
					<span className={`inline-flex items-baseline gap-1 ${valueClass}`.trim()}>
						{item.usdValue !== null
							? formatUsd(item.usdValue, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})
							: '-'}
						{item.displayUnit ? <span className={suffixClass}>/ week</span> : null}
					</span>
				</LineTag>
				<LineTag className={`flex items-center justify-between gap-2 ${subLineClass}`}>
					<span>
						{item.percentage != null
							? `${formatPercent(item.percentage, { input: 'percent', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
							: '-'}{' '}
						{item.percentageFloat !== null ? (
							<>
								(
								{formatCompactNumber(item.percentageFloat, {
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
								% of float)
							</>
						) : null}
					</span>
					<span className="inline-flex items-baseline gap-1">
						{formatCompactNumber(item.amount, {
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}{' '}
						{tokenSymbol}
						{item.displayUnit ? <span className={suffixClass}>/ week</span> : null}
					</span>
				</LineTag>
			</RowTag>
		)
	}

	if (isProtocolPage) {
		return (
			<Card as="article" padding="md" radius="large" className="flex flex-col gap-2.5">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 flex-col gap-1">
						{eventSummaries.length === 0 ? (
							<span className="body-md text-secondary">Amount unavailable</span>
						) : (
							eventSummaries.map((summary) => (
								<div key={summary.label} className="flex flex-col">
									<span className="body-md text-primary">{summary.label}</span>
									<span className="inline-flex items-baseline gap-1 body-md text-primary">
										{summary.usdValue !== null
											? formatUsd(summary.usdValue, {
													compact: true,
													minimumCompactValue: 1_000_000,
													compactSuffix: 'lowercase'
												})
											: `${formatCompactNumber(summary.amount, {
													minimumCompactValue: 1_000_000,
													compactSuffix: 'lowercase'
												})} ${tokenSymbol}`}
										{summary.displayUnit ? <span className="body-sm text-secondary">/ week</span> : null}
									</span>
									{summary.percentage !== null || summary.percentageFloat !== null ? (
										<span className="body-sm text-secondary">
											{summary.percentage !== null
												? formatPercent(summary.percentage, { input: 'percent', compact: true })
												: null}
											{summary.percentageFloat !== null
												? ` (${formatPercent(summary.percentageFloat, { input: 'percent', compact: true })} of float)`
												: null}
										</span>
									) : null}
								</div>
							))
						)}
					</div>
					<div className="flex shrink-0 flex-col items-end">
						<span className="body-md text-primary">{dayjs(timestamp * 1e3).format('MMM D, YYYY')}</span>
						<span className="body-sm text-secondary">
							{`${dayjs(timestamp * 1e3).format('h:mm A')} GMT${dayjs(timestamp * 1e3).format('Z')}`}
						</span>
						{timeLeft > 0 ? (
							<span className="mt-1 rounded-md bg-surface-elevated-2 px-2 py-0.5 label-sm text-primary tabular-nums">
								{formatCountdownBadge(days, hours, minutes, seconds)}
							</span>
						) : (
							<span className="mt-1 rounded-md bg-surface-elevated-2 px-2 py-0.5 label-sm text-primary">
								{formatTimeAgo(timestamp)}
							</span>
						)}
					</div>
				</div>
				<hr className="border-subtle" />
				<div className="flex flex-col gap-2">
					{currentUnlockBreakdown.map((item, i) => renderBreakdownRow(item, 'protocol', i))}
				</div>
				{timeLeft > 0 ? (
					<CalendarButton
						event={{ timestamp }}
						tokenName={name}
						tokenValue={calendarTokenValue}
						isProtocolPage={isProtocolPage}
					/>
				) : null}
			</Card>
		)
	}

	return (
		<div className="flex h-full items-center gap-2">
			<Ariakit.HovercardProvider timeout={0}>
				<Ariakit.HovercardAnchor>
					{timeLeft > 0 ? (
						<div className="flex items-center gap-3">
							{/* fixed-width summary slot keeps the countdown tiles at the same x on every row */}
							<div className="flex w-[200px] shrink-0 flex-col gap-1">
								{eventSummaries.length === 0 ? (
									<span className="label-sm text-tertiary">Amount unavailable</span>
								) : (
									eventSummaries.map((summary) => (
										<div key={summary.label} className="flex items-center justify-between gap-3">
											<div className="flex min-w-0 flex-col items-start">
												<span className="inline-flex items-baseline gap-1 mono-sm-bold whitespace-nowrap text-primary">
													{summary.usdValue !== null
														? formatUsd(summary.usdValue, {
																compact: true,
																minimumCompactValue: 1_000_000,
																compactSuffix: 'lowercase'
															})
														: `${formatCompactNumber(summary.amount, {
																minimumCompactValue: 1_000_000,
																compactSuffix: 'lowercase'
															})} ${tokenSymbol}`}
													{summary.displayUnit ? <span className="label-sm text-tertiary">/ week</span> : null}
												</span>
												<span className="truncate label-sm text-tertiary">{summary.label}</span>
											</div>
											{summary.percentageFloat !== null ? (
												<div className="flex shrink-0 flex-col items-end">
													<span className="mono-sm-bold text-primary">
														{formatPercent(summary.percentageFloat, { input: 'percent', compact: true })}
													</span>
													<span className="label-sm whitespace-nowrap text-tertiary">of float</span>
												</div>
											) : null}
										</div>
									))
								)}
							</div>

							<div className="flex items-center gap-1.5">
								<span className={countdownTileStyles}>{days}D</span>
								<span className={countdownTileStyles}>{hours}H</span>
								<span className={countdownTileStyles}>{minutes}M</span>
								<span className={countdownTileStyles}>{seconds}S</span>
							</div>
						</div>
					) : (
						<span className="label-sm text-tertiary" suppressHydrationWarning>
							{formatTimeAgo(timestamp)}
						</span>
					)}
				</Ariakit.HovercardAnchor>
				<Ariakit.HovercardDisclosure />
				<Ariakit.Hovercard
					className="z-10 flex max-h-(--popover-available-height) w-96 max-w-(--popover-available-width) flex-col gap-2 overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay p-4 text-sm text-primary shadow-overlay-sm"
					unmountOnHide
					hideOnInteractOutside
					overflowPadding={16}
					portal
				>
					<span className="flex items-center justify-between gap-4">
						<span className="flex items-center gap-2 font-medium">
							<TokenLogo
								name={name}
								kind="token"
								size={30}
								fallbackSrc={geckoId ? geckoTokenIconUrl(geckoId) : null}
								alt={`Logo of ${name}`}
							/>
							{tokenSymbol}
						</span>
						<span className="flex flex-col items-end">
							<span className="font-medium">{dayjs(timestamp * 1e3).format('MMM D, YYYY')}</span>
							<span className="text-xs text-tertiary">
								{`${dayjs(timestamp * 1e3).format('HH:mm')} GMT${dayjs(timestamp * 1e3).format('Z')}`}
							</span>
						</span>
					</span>
					<hr className="border-medium" />
					<div className="flex flex-col gap-4">
						{currentUnlockBreakdown.map((item, i) => renderBreakdownRow(item, 'hover', i))}
					</div>
					<hr className="border-medium" />

					<span className="flex flex-col gap-2">
						{eventSummaries.length === 0 ? (
							<span className="text-xs text-tertiary">Amount unavailable</span>
						) : (
							eventSummaries.map((summary) => (
								<span key={summary.label} className="flex flex-col gap-1">
									<span className="flex items-center justify-between gap-2 font-semibold">
										<span>{summary.label}</span>
										<span className="inline-flex items-baseline gap-1">
											{summary.usdValue !== null
												? formatUsd(summary.usdValue, {
														compact: true,
														minimumCompactValue: 1_000_000,
														compactSuffix: 'lowercase'
													})
												: '-'}
											{summary.displayUnit ? <span className="text-xs font-normal text-tertiary">/ week</span> : null}
										</span>
									</span>
									<span className="flex items-center justify-between gap-2 text-xs text-tertiary">
										<span>
											{summary.percentage !== null
												? formatPercent(summary.percentage, { input: 'percent', compact: true })
												: null}
											{summary.percentageFloat !== null
												? ` (${formatPercent(summary.percentageFloat, { input: 'percent', compact: true })} of float)`
												: null}
										</span>
										<span>
											{formatCompactNumber(summary.amount, {
												minimumCompactValue: 1_000_000,
												compactSuffix: 'lowercase'
											})}{' '}
											{tokenSymbol}
											{summary.displayUnit ? ' / week' : ''}
										</span>
									</span>
								</span>
							))
						)}
					</span>
				</Ariakit.Hovercard>
			</Ariakit.HovercardProvider>
			{timeLeft > 0 ? (
				<CalendarButton
					event={{ timestamp }}
					tokenName={name}
					tokenValue={calendarTokenValue}
					isProtocolPage={isProtocolPage}
				/>
			) : null}
		</div>
	)
}
