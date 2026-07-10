import * as Ariakit from '@ariakit/react'
import dayjs from 'dayjs'
import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { Icon } from '~/components/Icon'
import { TokenLogo } from '~/components/TokenLogo'
import { Tooltip } from '~/components/Tooltip'
import { buttonStyles } from '~/ui/Button'
import { Card } from '~/ui/Card'
import {
	menuSurfaceStyles,
	popoverMenuItemStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import { formattedNum } from '~/utils'
import { generateGoogleCalendarUrl } from '~/utils/calendar'

const EMPTY_TOKENS: number[][] = []

interface CalendarButtonProps {
	event: { timestamp: number; noOfTokens: number[][]; symbol: string; description: string }
	tokenName: string
	tokenValue: string | null
	isProtocolPage: boolean
}

const ProtocolPageButton = () => {
	return (
		<Ariakit.MenuButton className="flex items-center gap-2 rounded-sm p-2 hover:bg-hover-row focus-visible:bg-hover-row">
			<Icon name="calendar-plus" width={16} height={16} />
			Add to Calendar
		</Ariakit.MenuButton>
	)
}

const RegularButton = () => {
	return (
		<Ariakit.MenuButton
			className={buttonStyles({ variant: 'ghost', size: 'md', square: true })}
			aria-label="Add to calendar"
		>
			<Icon name="calendar-plus" width={16} height={16} />
		</Ariakit.MenuButton>
	)
}

const CalendarButton = ({ event, tokenName, tokenValue, isProtocolPage }: CalendarButtonProps) => {
	return (
		<Ariakit.MenuProvider>
			{isProtocolPage ? <ProtocolPageButton /> : <RegularButton />}

			<Ariakit.Menu
				unmountOnHide
				hideOnInteractOutside
				gutter={8}
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				className={`${menuSurfaceStyles} shadow-sm`}
				portal
			>
				<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>

				<Ariakit.MenuItem
					render={
						<a
							href={generateGoogleCalendarUrl(
								{ ...event, name: tokenName, noOfTokens: event.noOfTokens.flat() },
								tokenName,
								tokenValue ? parseFloat(tokenValue.replace(/[^0-9.-]+/g, '')) || 0 : 0
							)}
							target="_blank"
							rel="noopener noreferrer"
						/>
					}
					className={`${popoverMenuItemStyles} border-b border-subtle`}
				>
					<Icon name="external-link" width={16} height={16} />
					Google Calendar
				</Ariakit.MenuItem>

				<Ariakit.MenuItem
					render={
						<a
							href={`/api/dynamic/calendar/${tokenName}?timestamp=${event.timestamp}&value=${tokenValue ?? ''}&name=${tokenName}`}
						/>
					}
					className={popoverMenuItemStyles}
				>
					<Icon name="download-cloud" width={16} height={16} />
					Other Calendars Apps
				</Ariakit.MenuItem>
			</Ariakit.Menu>
		</Ariakit.MenuProvider>
	)
}

interface UpcomingEventProps {
	noOfTokens?: number[][]
	timestamp: number
	event: Array<{
		description: string
		noOfTokens: number[]
		timestamp: number
		unlockType?: string
		rateDurationDays?: number
	}>
	price: number | null | undefined
	symbol: string | null | undefined
	mcap: number | null | undefined
	maxSupply: number | null | undefined
	name: string
	isProtocolPage?: boolean
}

interface UnlockBreakdown {
	name: string
	perDayAmount: number
	totalAmount: number
	displayUnit: string
	timestamp: number
	unlockType: string
	endTime: number | null
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

const formatDuration = (days: number) => {
	if (days >= 365) {
		const years = Math.floor(days / 365)
		const remainingMonths = Math.floor((days % 365) / 30)
		if (remainingMonths > 0) return `${years}y ${remainingMonths}m`
		return `${years}y`
	}
	if (days >= 30) {
		const months = Math.floor(days / 30)
		return `${months}m`
	}
	return `${days}d`
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

export const UpcomingEvent = ({
	noOfTokens = EMPTY_TOKENS,
	timestamp,
	event,
	price,
	symbol,
	mcap,
	maxSupply,
	name,
	isProtocolPage = false
}: UpcomingEventProps) => {
	const tokenSymbol = symbol ? symbol.toUpperCase() : ''
	const {
		currentUnlockBreakdown,
		totalAmount,
		tokenValue,
		unlockPercent,
		unlockPercentFloat,
		hasLinear,
		dailyValue,
		dailyTokenAmount,
		linearDurationDays
	} = useMemo(() => {
		const breakdown: UnlockBreakdown[] = event
			.map(({ description, noOfTokens: eventNoOfTokens, timestamp: eventTimestamp, unlockType, rateDurationDays }) => {
				const regex =
					/(?:of (.+?) tokens (?:will be|were) unlocked)|(?:will (?:increase|decrease) from \{tokens\[0\]\} to \{tokens\[1\]\} tokens per week from (.+?) on {timestamp})|(?:from (.+?) on {timestamp})|(?:was (?:increased|decreased) from \{tokens\[0\]\} to \{tokens\[1\]\} tokens per week from (.+?) on {timestamp})/
				const matches = (description || '').match(regex)
				const eventName = matches?.[1] || matches?.[2] || matches?.[3] || matches?.[4] || ''

				let perDayAmount: number, totalAmount: number, displayUnit: string
				if (unlockType === 'linear') {
					const isIncrease = (description || '').toLowerCase().includes('increase')
					perDayAmount = (isIncrease ? eventNoOfTokens[1] : eventNoOfTokens[0]) / 7
					totalAmount = perDayAmount * (rateDurationDays || 1)
					displayUnit = 'per day'
				} else {
					perDayAmount = totalAmount = eventNoOfTokens.reduce((sum: number, amount: number) => sum + amount, 0)
					displayUnit = ''
				}
				const isLinearPerDay = unlockType === 'linear' && displayUnit === 'per day'
				const usdValue = price ? (isLinearPerDay ? perDayAmount * price : totalAmount * price) : null
				const totalUsdValue = price ? totalAmount * price : null
				const percentage = maxSupply ? (totalAmount / maxSupply) * 100 : null
				const percentageFloat = totalUsdValue && mcap ? (totalUsdValue / mcap) * 100 : null
				const endTime = unlockType === 'linear' ? eventTimestamp + (rateDurationDays || 0) * 86400 : null

				return {
					name: eventName,
					perDayAmount,
					totalAmount,
					displayUnit,
					timestamp: eventTimestamp,
					unlockType: unlockType || 'cliff',
					endTime,
					usdValue,
					percentage,
					percentageFloat
				}
			})
			.sort((a: UnlockBreakdown, b: UnlockBreakdown) => b.totalAmount - a.totalAmount)

		const totalAmount = breakdown.reduce((sum: number, item: UnlockBreakdown) => sum + item.totalAmount, 0)
		const tokenValue = price ? totalAmount * price : null
		const unlockPercent = maxSupply ? (totalAmount / maxSupply) * 100 : null
		const unlockPercentFloat = tokenValue && mcap ? (tokenValue / mcap) * 100 : null

		const hasLinear = breakdown.some((item) => item.unlockType === 'linear')
		const dailyTokenAmount = breakdown.reduce(
			(sum, item) => sum + (item.unlockType === 'linear' ? item.perDayAmount : 0),
			0
		)
		const dailyValue = price ? dailyTokenAmount * price : null
		const linearItems = breakdown.filter((item) => item.endTime != null)
		const linearDurationDays =
			linearItems.length > 0
				? Math.max(...linearItems.map((item) => Math.round((item.endTime! - item.timestamp) / 86400)))
				: 0

		return {
			currentUnlockBreakdown: breakdown,
			totalAmount,
			tokenValue,
			unlockPercent,
			unlockPercentFloat,
			hasLinear,
			dailyValue,
			dailyTokenAmount,
			linearDurationDays
		}
	}, [event, price, maxSupply, mcap])

	const [nowMs, setNowMs] = useState(() => Date.now())
	const nowSec = nowMs / 1e3
	const timeLeft = Math.max(0, timestamp - nowMs / 1e3)
	const days = Math.floor(timeLeft / 86400)
	const hours = Math.floor((timeLeft - 86400 * days) / 3600)
	const minutes = Math.floor((timeLeft - 86400 * days - 3600 * hours) / 60)
	const seconds = Math.floor(timeLeft - 86400 * days - 3600 * hours - minutes * 60)

	const onCountdownTick = useEffectEvent(() => {
		setNowMs(Date.now())
	})

	const renderBreakdownRow = (item: UnlockBreakdown, variant: 'protocol' | 'hover', index: number) => {
		const RowTag = variant === 'protocol' ? 'div' : 'span'
		const LineTag = variant === 'protocol' ? 'div' : 'span'
		const iconSize = variant === 'protocol' ? 14 : 16
		const rowClass = variant === 'protocol' ? 'flex flex-col gap-0.5' : 'flex flex-col gap-1'
		const lineClass = variant === 'protocol' ? 'body-md text-primary' : 'text-sm'
		const subLineClass = variant === 'protocol' ? 'body-sm text-secondary' : 'text-xs text-secondary'
		const suffixClass = variant === 'protocol' ? 'body-sm text-tertiary' : 'text-xs text-tertiary'
		const valueClass = variant === 'protocol' ? '' : 'font-medium'
		const isLinearPerDay = item.unlockType === 'linear' && item.displayUnit === 'per day'
		const isOngoing = item.endTime != null && nowSec >= item.timestamp && nowSec <= item.endTime

		return (
			<RowTag className={rowClass} key={`${item.name}-${item.totalAmount}-${index}`}>
				<LineTag className={`flex items-center justify-between gap-2 ${lineClass}`}>
					<span className="flex items-center gap-1.5">
						{item.name}
						{isOngoing ? ' (Ongoing)' : null}
						<Tooltip content={item.unlockType === 'linear' ? 'Linear Unlock' : 'Cliff Unlock'}>
							<Icon
								name={item.unlockType === 'linear' ? 'linear-unlock' : 'cliff-unlock'}
								height={iconSize}
								width={iconSize}
								className="text-tertiary"
							/>
						</Tooltip>
					</span>
					<span className={`inline-flex items-baseline gap-1 ${valueClass}`.trim()}>
						{item.usdValue ? formattedNum(item.usdValue, true) : '-'}
						{isLinearPerDay ? <span className={suffixClass}>/ day</span> : null}
					</span>
				</LineTag>
				<LineTag className={`flex items-center justify-between gap-2 ${subLineClass}`}>
					<span>
						{item.percentage != null ? `${formattedNum(item.percentage)}%` : '-'}{' '}
						{item.percentageFloat ? <>({formattedNum(item.percentageFloat)}% of float)</> : null}
					</span>
					<span className="inline-flex items-baseline gap-1">
						{formattedNum(isLinearPerDay ? item.perDayAmount : item.totalAmount)} {tokenSymbol}
						{isLinearPerDay ? <span className={suffixClass}>/ day</span> : null}
					</span>
				</LineTag>
			</RowTag>
		)
	}

	useEffect(() => {
		const now = Date.now() / 1e3
		if (timestamp <= now) return
		const id = setInterval(() => {
			onCountdownTick()
		}, 1000)

		return () => clearInterval(id)
	}, [timestamp])

	if (isProtocolPage) {
		return (
			<Card as="article" padding="md" radius="large" className="flex flex-col gap-2.5">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 flex-col">
						<span className="body-md text-primary">{hasLinear ? 'Daily Unlock Rate' : 'Unlock Value'}</span>
						<span className="body-md text-primary">
							{hasLinear ? (
								dailyValue ? (
									<>
										{formattedNum(dailyValue, true)} <span className="body-sm text-secondary">/ day</span>
									</>
								) : (
									<span>{formattedNum(unlockPercent)}%</span>
								)
							) : tokenValue ? (
								formattedNum(tokenValue, true)
							) : (
								<span>{formattedNum(unlockPercent)}%</span>
							)}
						</span>
						{hasLinear && linearDurationDays > 0 ? (
							<span className="body-sm text-secondary">
								Linear over {formatDuration(linearDurationDays)}
								{tokenValue ? <> · Total: {formattedNum(tokenValue, true)}</> : null}
							</span>
						) : unlockPercent ? (
							<span className="body-sm text-secondary">
								{tokenValue ? formattedNum(unlockPercent) + '%' : null}
								{unlockPercentFloat ? <> ({formattedNum(unlockPercentFloat)}% of float)</> : null}
							</span>
						) : null}
					</div>
					<div className="flex shrink-0 flex-col items-end">
						<span className="body-md text-primary">
							{timestamp ? dayjs(timestamp * 1e3).format('MMM D, YYYY') : null}
						</span>
						<span className="body-sm text-secondary">
							{timestamp ? `${dayjs(timestamp * 1e3).format('h:mm A')} GMT${dayjs(timestamp * 1e3).format('Z')}` : ''}
						</span>
						{timeLeft > 0 ? (
							<span
								className="mt-1 rounded-md bg-surface-elevated-2 px-2 py-0.5 label-sm text-primary tabular-nums"
								suppressHydrationWarning
							>
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
						event={{ timestamp, noOfTokens, symbol: symbol || '', description: '' }}
						tokenName={name}
						tokenValue={tokenValue ? formattedNum(tokenValue, true) : null}
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
						<div className="flex min-w-0 items-center gap-3">
							<div className="flex min-w-[150px] items-center justify-between gap-4">
								<div className="flex flex-col items-start">
									<span className="mono-sm-bold text-primary">
										{hasLinear && dailyValue ? (
											<>
												{formattedNum(dailyValue, true)} <span className="label-sm text-tertiary">/ day</span>
											</>
										) : (
											formattedNum(tokenValue, true)
										)}
									</span>
									<span className="label-sm text-tertiary">{hasLinear ? 'Linear Unlock' : 'Unlock Value'}</span>
								</div>
								<div className="flex flex-col items-end">
									<span className="mono-sm-bold text-primary">{formattedNum(unlockPercentFloat)}%</span>
									<span className="label-sm text-tertiary">of float</span>
								</div>
							</div>

							<div className="flex items-center gap-1.5" suppressHydrationWarning>
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
					className="z-10 flex flex-col gap-2 rounded-xl border border-medium bg-overlay p-4 text-sm text-primary shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)]"
					unmountOnHide
					hideOnInteractOutside
					portal={true}
				>
					<span className="flex items-center justify-between gap-4">
						<span className="flex items-center gap-2 font-medium">
							<TokenLogo name={name} kind="token" size={30} alt={`Logo of ${name}`} />
							{tokenSymbol}
						</span>
						<span className="flex flex-col items-end">
							<span className="font-medium">{timestamp ? dayjs(timestamp * 1e3).format('MMM D, YYYY') : null}</span>
							<span className="text-xs text-tertiary">
								{timestamp
									? `${dayjs(timestamp * 1e3).format('HH:mm')} GMT${dayjs(timestamp * 1e3).format('Z')}`
									: null}
							</span>
						</span>
					</span>
					<hr className="border-medium" />
					<div className="flex flex-col gap-4">
						{currentUnlockBreakdown.map((item, i) => renderBreakdownRow(item, 'hover', i))}
					</div>
					<hr className="border-medium" />

					<span className="flex flex-col gap-1">
						<span className="flex items-center justify-between gap-2 font-semibold">
							<span>Total</span>
							<span className="inline-flex items-baseline gap-1">
								{hasLinear && dailyValue
									? formattedNum(dailyValue, true)
									: tokenValue
										? formattedNum(tokenValue, true)
										: '-'}
								{hasLinear ? <span className="text-xs font-normal text-tertiary">/ day</span> : null}
							</span>
						</span>
						{hasLinear && linearDurationDays > 0 ? (
							<span className="flex items-center justify-between gap-2 text-xs text-tertiary">
								<span>Linear over {formatDuration(linearDurationDays)}</span>
								<span>
									{formattedNum(dailyTokenAmount)} {tokenSymbol} / day
								</span>
							</span>
						) : null}
						<span className="flex items-center justify-between gap-2 text-xs text-tertiary">
							<span>
								{unlockPercent ? `${formattedNum(unlockPercent)}%` : null}
								{unlockPercentFloat ? ` (${formattedNum(unlockPercentFloat)}% of float)` : null}
							</span>
							<span>
								{formattedNum(totalAmount)} {tokenSymbol}
							</span>
						</span>
					</span>
				</Ariakit.Hovercard>
			</Ariakit.HovercardProvider>
			{timeLeft > 0 ? (
				<CalendarButton
					event={{ timestamp, noOfTokens, symbol: symbol || '', description: '' }}
					tokenName={name}
					tokenValue={tokenValue ? formattedNum(tokenValue, true) : null}
					isProtocolPage={isProtocolPage}
				/>
			) : null}
		</div>
	)
}
