import * as React from 'react'
import { Tooltip } from '~/ui/Tooltip'
import { formatUsd } from '~/utils/numberFormat'
import { getCliffEmissionAmount } from './eventAmount'
import type { EnrichedProtocolEmission } from './queries'
import { TopThreeRow } from './TopThreeRow'

interface TopUnlocksProps {
	data: EnrichedProtocolEmission[]
	period: number
	title?: string
	className?: string
	initialNowSec?: number
}

export const TopUnlocks: React.FC<TopUnlocksProps> = ({ data, period, title, className, initialNowSec }) => {
	const [now] = React.useState(() => Math.floor(initialNowSec ?? Date.now() / 1000))
	const { topUnlocks } = React.useMemo(() => {
		const protocolUnlocks = new Map<
			string,
			{
				name: string
				symbol: string | null
				geckoId?: string | null
				value: number
			}
		>()
		const startTime = now - period * 24 * 60 * 60

		for (const protocol of data) {
			const price = protocol.tPrice
			if (price == null || price <= 0) continue
			let totalUnlockValue = 0
			for (const event of protocol.events) {
				if (event.timestamp < startTime || event.timestamp > now) continue
				const amount = getCliffEmissionAmount(event)
				if (amount === null || amount <= 0) continue
				totalUnlockValue += amount * price
			}

			if (totalUnlockValue > 0) {
				protocolUnlocks.set(protocol.name, {
					name: protocol.name,
					symbol: protocol.tSymbol,
					...(protocol.gecko_id !== undefined ? { geckoId: protocol.gecko_id } : {}),
					value: totalUnlockValue
				})
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
				content={`List of top one-time cliff unlocks in the last ${period} ${period === 1 ? 'day' : 'days'}`}
			>
				{title}
			</Tooltip>

			{topUnlocks.map((unlock) => (
				<TopThreeRow
					key={unlock.name}
					name={unlock.name}
					symbol={unlock.symbol}
					{...(unlock.geckoId !== undefined ? { geckoId: unlock.geckoId } : {})}
					value={
						<span className="mono-md-bold text-primary">
							{formatUsd(unlock.value, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</span>
					}
				/>
			))}
		</div>
	)
}
