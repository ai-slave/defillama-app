import type { ProtocolEmission } from '~/containers/Unlocks/api.types'
import { isUnknownEmissionEvent } from '~/containers/Unlocks/eventAmount'

export type UnlockHistoricalPriceProtocol = Pick<ProtocolEmission, 'gecko_id' | 'events'>

export function buildUnlocksHistoricalPriceRequests(
	protocols: UnlockHistoricalPriceProtocol[],
	nowSec: number = Date.now() / 1000
): {
	priceReqs: Record<string, number[]>
	hasPriceRequests: boolean
	lastPastTimestampByCoinKey: Map<string, number>
} {
	const weekAgoSec = nowSec - 7 * 24 * 60 * 60
	const priceReqs: Record<string, number[]> = {}
	let hasPriceRequests = false
	const lastPastTimestampByCoinKey = new Map<string, number>()

	for (const protocol of protocols) {
		const geckoId = protocol.gecko_id
		if (!geckoId) continue

		const coinKey = `coingecko:${geckoId}`

		let earliestEvent: number | undefined
		let lastPastEvent: number | undefined

		for (const event of protocol.events) {
			if (isUnknownEmissionEvent(event)) continue
			const ts = event.timestamp
			if (earliestEvent === undefined || ts < earliestEvent) earliestEvent = ts

			const cat = event.category
			if (cat === 'noncirculating' || cat === 'farming') continue

			if (ts < weekAgoSec && (lastPastEvent === undefined || ts > lastPastEvent)) {
				lastPastEvent = ts
			}
		}

		if (lastPastEvent === undefined) continue

		lastPastTimestampByCoinKey.set(coinKey, lastPastEvent)
		if (earliestEvent !== undefined && lastPastEvent === earliestEvent) continue

		const anchor = Math.floor(lastPastEvent / 86400) * 86400
		const timestamps: number[] = []
		for (let d = 7; d >= 1; d--) timestamps.push(anchor - d * 86400)
		timestamps.push(anchor)
		for (let d = 1; d <= 7; d++) timestamps.push(anchor + d * 86400)
		priceReqs[coinKey] = timestamps
		hasPriceRequests = true
	}

	return { priceReqs, hasPriceRequests, lastPastTimestampByCoinKey }
}
