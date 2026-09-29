import { formatUsd } from '~/utils/numberFormat'

// Yearly plans cost 10 monthly payments ("2 months free").
const SEAT_PRICE = {
	api: { month: 300, year: 3000 },
	llamafeed: { month: 49, year: 490 }
} as const

// Team subscription types are strings on the wire; anything but API is Pro.
export const seatPrice = (type: string, interval: 'month' | 'year') =>
	(type === 'api' ? SEAT_PRICE.api : SEAT_PRICE.llamafeed)[interval]

export function formatSeatTotal(type: 'api' | 'llamafeed', interval: 'month' | 'year', seatCount: number) {
	return `${formatUsd(seatPrice(type, interval) * seatCount)}/${interval}`
}
