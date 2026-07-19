import type { NextApiRequest, NextApiResponse } from 'next'
import { annualizeFunding, postInfo } from '~/utils/hyperliquid'

interface HlVenueFunding {
	fundingRate: string
	// Unix milliseconds.
	nextFundingTime: number
	// Present in the current API and venue-specific (for example 1h or 4h).
	fundingIntervalHours?: number
}

type HlVenueEntry = [string, HlVenueFunding | null]
type HlPredictedRow = [string, HlVenueEntry[]]

export interface PredictedFunding {
	coin: string
	hlRate: number | null
	binanceRate: number | null
	bybitRate: number | null
	spread: number | null
	// Unix milliseconds from the HlPerp venue entry.
	nextFundingTime: number | null
	venueRates: Record<string, number | null>
	bestCexRate: number | null
	spreadToBestCex: number | null
}

const CEX_VENUES = ['BinPerp', 'BybitPerp', 'OkxPerp']

export function buildPredictedFundings(raw: HlPredictedRow[]): PredictedFunding[] {
	return raw.map(([coin, venues]) => {
		const venueMap = new Map(venues.filter(([, info]) => info != null) as [string, HlVenueFunding][])
		const venueRates: Record<string, number | null> = {}

		for (const [name, info] of venueMap.entries()) {
			const fallbackIntervalHours = name === 'HlPerp' ? 1 : 8
			venueRates[name] = annualizeFunding(info.fundingRate, info.fundingIntervalHours ?? fallbackIntervalHours)
		}

		const hlRate = venueRates.HlPerp ?? null
		const binanceRate = venueRates.BinPerp ?? null
		const bybitRate = venueRates.BybitPerp ?? null
		const nextFundingTime = venueMap.get('HlPerp')?.nextFundingTime ?? null

		const cexRates = CEX_VENUES.map((name) => venueRates[name]).filter(
			(value): value is number => typeof value === 'number'
		)
		const bestCexRate = cexRates.length > 0 ? Math.min(...cexRates) : null

		return {
			coin,
			hlRate,
			binanceRate,
			bybitRate,
			spread: hlRate != null && binanceRate != null ? hlRate - binanceRate : null,
			nextFundingTime,
			venueRates,
			bestCexRate,
			spreadToBestCex: hlRate != null && bestCexRate != null ? hlRate - bestCexRate : null
		}
	})
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<PredictedFunding[] | { error: string }>
) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	try {
		const raw = await postInfo<HlPredictedRow[]>({ type: 'predictedFundings' })

		const result = buildPredictedFundings(raw)

		res.setHeader('Cache-Control', 'public, max-age=60')
		return res.status(200).json(result)
	} catch (error) {
		console.log('Failed to fetch predicted fundings', error)
		return res.status(500).json({ error: 'Failed to fetch predicted fundings' })
	}
}
