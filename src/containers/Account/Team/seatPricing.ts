import { formatUsd } from '~/utils/numberFormat'

// Yearly plans cost 10 monthly payments ("2 months free").
const SEAT_PRICE = {
	api: { month: 300, year: 3000 },
	llamafeed: { month: 49, year: 490 }
} as const

export function formatSeatTotal(type: 'api' | 'llamafeed', interval: 'month' | 'year', seatCount: number) {
	return `${formatUsd(SEAT_PRICE[type][interval] * seatCount)}/${interval}`
}
