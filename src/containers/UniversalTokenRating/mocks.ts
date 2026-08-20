import { DISCLOSURE_RUBRICS, PERFORMANCE_RUBRICS, UTR_SCORED_COUNT, UTR_SECTORS, UTR_TOTAL_COUNT } from './constants'
import type { UtrLeaderboardRow, UtrRubricScore, UtrTopMover, UtrUniverse } from './types'

// Deterministic LCG so SSG output is stable between builds.
function makeRng(seed: number) {
	let state = seed
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296
		return state / 4294967296
	}
}

const MOCK_NAMES = [
	'Fableborne',
	'Gunzilla',
	'Hivello',
	'HimidiFi',
	'Marinade',
	'Metaplex',
	'Mezo Finance',
	'Moonwalk',
	'Access Protocol',
	'Abeezee',
	'Beamable',
	'Corretto',
	'Driftwood',
	'Eventide',
	'Fondant',
	'Glimmer',
	'Halcyon',
	'Ironwood',
	'Juniper',
	'Kelvin'
]

function mockRubrics(rng: () => number, rubrics: readonly string[]): UtrRubricScore[] {
	return rubrics.map((rubric) => {
		const percentage = Math.round(rng() * 10000) / 100
		return {
			rubric,
			weighted: Math.round(rng() * 250) / 100,
			percentage,
			percentile: Math.round(rng() * 10000) / 100
		}
	})
}

export function getMockUniverse(): UtrUniverse {
	const rng = makeRng(42)
	const rows: UtrLeaderboardRow[] = []
	for (let i = 0; i < 60; i++) {
		const name = MOCK_NAMES[i % MOCK_NAMES.length]
		const disclosure = Math.round(rng() * 1000) / 100
		const performance = Math.round(rng() * 1000) / 100
		const overall = Math.round((disclosure + performance) * 500) / 100
		rows.push({
			asset: `${name.toLowerCase().replace(/\s+/g, '-')}-${i}`,
			name: i === 8 ? name : `${name} ${i + 1}`,
			symbol: name.slice(0, 3).toUpperCase(),
			sector: UTR_SECTORS[i % UTR_SECTORS.length],
			listingStatus: i % 7 === 3 ? 'pre-tge' : i % 11 === 5 ? 'unlisted' : 'listed',
			disclosureLevel: i % 5 === 0 ? 'partial' : i % 9 === 4 ? 'none' : 'full',
			claimed: i % 3 !== 0,
			fdvUsd: Math.round(rng() * 3_000_000_000),
			scores: {
				overall,
				overallMomChangePct: Math.round((rng() * 200 - 100) * 100) / 100,
				disclosure,
				performance,
				rank: 0,
				disclosureRubrics: mockRubrics(rng, DISCLOSURE_RUBRICS),
				performanceRubrics: mockRubrics(rng, PERFORMANCE_RUBRICS)
			}
		})
	}
	rows.sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0))
	rows.forEach((row, index) => {
		row.scores.rank = index + 1
	})
	return { rows, scoredCount: UTR_SCORED_COUNT, totalCount: UTR_TOTAL_COUNT }
}

export function getMockTopMovers(): UtrTopMover[] {
	return [
		{ asset: 'fableborne', name: 'Fableborne', momChangePct: 22 },
		{ asset: 'gunzilla', name: 'Gunzilla', momChangePct: -55 },
		{ asset: 'hivello', name: 'Hivello', momChangePct: 32 },
		{ asset: 'himidifi', name: 'HimidiFi', momChangePct: 58 },
		{ asset: 'marinade', name: 'Marinade', momChangePct: -6 },
		{ asset: 'metaplex', name: 'Metaplex', momChangePct: 67 },
		{ asset: 'mezo-finance', name: 'Mezo Finance', momChangePct: 65 },
		{ asset: 'moonwalk', name: 'Moonwalk', momChangePct: -47 }
	]
}

export type MockSeriesPoint = [number, number]

export function getMockSeries(seed: number, days = 30, base = 50_000_000, spread = 0.5): MockSeriesPoint[] {
	const rng = makeRng(seed)
	const start = Date.UTC(2026, 8, 1)
	const points: MockSeriesPoint[] = []
	let value = base
	for (let i = 0; i < days; i++) {
		value = Math.max(base * 0.2, value * (1 + (rng() - 0.5) * spread))
		points.push([start + i * 86_400_000, Math.round(value)])
	}
	return points
}

export type MockCandle = {
	time: number
	open: number
	close: number
	low: number
	high: number
}

export function getMockCandles(seed: number, days = 30): MockCandle[] {
	const rng = makeRng(seed)
	const start = Date.UTC(2026, 8, 1)
	const candles: MockCandle[] = []
	let price = 45
	for (let i = 0; i < days; i++) {
		const open = price
		const close = Math.max(20, open * (1 + (rng() - 0.48) * 0.12))
		const low = Math.min(open, close) * (1 - rng() * 0.05)
		const high = Math.max(open, close) * (1 + rng() * 0.05)
		candles.push({ time: start + i * 86_400_000, open, close, low, high })
		price = close
	}
	return candles
}

export type MockDisclosureItem = { label: string; score: number | null }

export const MOCK_DISCLOSURE_SECTIONS: {
	title: string
	items: MockDisclosureItem[]
}[] = [
	{
		title: 'Core Contributors',
		items: [
			{ label: 'Insider Identities Disclosed', score: 7.8 },
			{ label: 'Role descriptions & org structure', score: 7.2 },
			{ label: 'Anonymized insider wallet disclosures', score: null }
		]
	},
	{
		title: 'Legal & Financial',
		items: [
			{ label: 'Treasury reporting', score: 9.6 },
			{ label: 'Cash flow disclosures', score: 6.5 },
			{ label: 'Legal entities, licenses & patents', score: 3.1 }
		]
	},
	{
		title: 'Tokenomics',
		items: [
			{ label: 'Vesting schedules fully published', score: 9.7 },
			{ label: 'Distribution schedules fully published', score: 6.4 },
			{ label: 'External allocation disclosures', score: null },
			{ label: 'Multisig disclosures', score: 4.0 }
		]
	},
	{
		title: 'Service Providers',
		items: [
			{ label: 'Market maker engagement transparency', score: 9.8 },
			{ label: 'Auditor disclosures (smart contract)', score: 8.6 },
			{ label: 'Exchange engagement disclosures', score: 9.1 }
		]
	}
]

export const MOCK_MARKET_MAKERS = ['Market Maker 1', 'Tophash', 'Market Maker 2', 'Market Maker 3'].map(
	(name, index) => ({
		name,
		engagement: index === 0 ? 'Retainer + Working Capital' : 'Loan + Call Option',
		avgSpreadPct: 1 + index * 0.25,
		avgDepth50: 492_030 - index * 38_450,
		avgDepth100: 492_030 - index * 21_760,
		avgDepth200: 492_030 - index * 12_980,
		combinedUptimePct: index === 0 ? 60.99 : 90 + index * 2.5,
		uptimeObligationPct: 90,
		uptimeStatus: index === 0 ? ('Lagging' as const) : ('Achieved' as const)
	})
)

export type MockMarketMaker = (typeof MOCK_MARKET_MAKERS)[number]
