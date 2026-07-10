import * as React from 'react'
import { Tooltip } from '~/ui/Tooltip'
import { formattedNum } from '~/utils'
import { TopThreeRow } from './TopThreeRow'
import type { ProtocolEmissionWithHistory } from './types'

interface TopUnlocksProps {
	data: ProtocolEmissionWithHistory[]
	period: number
	title?: string
	className?: string
	initialNowSec?: number
}

export const TopUnlocks: React.FC<TopUnlocksProps> = ({ data, period, title, className, initialNowSec }) => {
	const [now] = React.useState(() =>
		typeof initialNowSec === 'number' && Number.isFinite(initialNowSec)
			? Math.floor(initialNowSec)
			: Math.floor(Date.now() / 1000)
	)
	const { topUnlocks } = React.useMemo(() => {
		const protocolUnlocks = new Map<
			string,
			{
				name: string
				symbol: string
				value: number
			}
		>()
		const startTime = now - period * 24 * 60 * 60

		if (data) {
			for (const protocol of data) {
				const timestampGroups = new Map<number, number>()

				if (protocol.events) {
					for (const event of protocol.events) {
						if (event.timestamp >= startTime && event.timestamp <= now) {
							const totalTokens = event.noOfTokens?.reduce((sum: number, amount: number) => sum + amount, 0) || 0
							const existing = timestampGroups.get(event.timestamp) || 0
							timestampGroups.set(event.timestamp, existing + totalTokens)
						}
					}
				}

				const totalUnlockValue = Array.from(timestampGroups.values()).reduce(
					(sum, tokens) => sum + tokens * (protocol.tPrice ?? 0),
					0
				)

				if (totalUnlockValue > 0) {
					protocolUnlocks.set(protocol.name, {
						name: protocol.name,
						symbol: protocol.tSymbol ?? '',
						value: totalUnlockValue
					})
				}
			}
		}

		return {
			topUnlocks: Array.from(protocolUnlocks.values())
				.sort((a, b) => b.value - a.value)
				.slice(0, 3)
		}
	}, [data, period, now])

	return (
		<div className={`flex flex-col gap-3 text-primary ${className ?? ''}`}>
			<Tooltip
				className="heading-xs text-primary"
				content={`List of top unlocks in the last ${period} ${period === 1 ? 'day' : 'days'}`}
			>
				{title}
			</Tooltip>

			{topUnlocks.map((unlock) => (
				<TopThreeRow
					key={unlock.name}
					name={unlock.name}
					symbol={unlock.symbol}
					value={<span className="mono-md-bold text-primary">{formattedNum(unlock.value, true)}</span>}
				/>
			))}
		</div>
	)
}
