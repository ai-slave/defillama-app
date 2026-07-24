import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchJson } from '~/utils/async'
import { formatUsd } from '~/utils/numberFormat'

const BASE = process.env.IR_SERVER_URL
const TIMEOUT = { timeout: 30_000 }

function fmt(v: number): string {
	const fractionDigits = v >= 1e6 || v < 1e3 ? 2 : 1
	return formatUsd(v, {
		compact: true,
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	})
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	try {
		const [metadata, projections, returns, treasury, sllAssets, supply, tvl] = await Promise.all([
			fetchJson(`${BASE}/api/spark/metadata`, TIMEOUT),
			fetchJson(`${BASE}/api/spark/projections`, TIMEOUT),
			fetchJson(`${BASE}/api/spark/returns`, TIMEOUT),
			fetchJson(`${BASE}/api/spark/treasury`, TIMEOUT),
			fetchJson(`${BASE}/api/spark/sll-assets`, TIMEOUT),
			fetchJson(`${BASE}/api/spark/supply`, TIMEOUT),
			fetchJson(`${BASE}/api/spark/tvl`, TIMEOUT)
		])

		const projRev = projections.kpis?.projectedRevenue?.value ?? 0
		const projExp = projections.kpis?.projectedExpenses?.value ?? 0
		const projSur = projections.kpis?.projectedSurplus?.value ?? 0
		const totalGross = returns.totalGross ?? 0

		const data = {
			meta: metadata,
			kpis: [
				{ label: 'Gross Returns', value: totalGross, formatted: fmt(totalGross) },
				{ label: 'Total Projected Annual Revenue', value: projRev, formatted: fmt(projRev) },
				{ label: 'Projected Yearly OpEx', value: projExp, formatted: fmt(projExp) },
				{ label: 'Projected Yearly Surplus', value: projSur, formatted: fmt(projSur) }
			],
			treasuryKpis: treasury.treasuryKpis,
			buybackKpis: treasury.buybackKpis,
			charts: {
				projectedBreakdown: projections.breakdown,
				monthlyGross: returns.monthlyGross,
				monthlyNet: returns.monthlyNet,
				allocatedAssets: sllAssets,
				tvl: tvl.tvl,
				sparklendDeposits: tvl.sparklendDeposits,
				sparklendBorrows: tvl.sparklendBorrows,
				sllTvl: tvl.sllTvl,
				savingsTvl: tvl.savingsTvl,
				supplyTotal: supply.supplyTotal,
				supplyByChain: supply.supplyByChain,
				treasury: treasury.treasuryChart,
				buybacks: treasury.buybacksChart
			}
		}

		res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
		return res.status(200).json(data)
	} catch (error) {
		console.error('Spark financials proxy error:', error)
		return res.status(502).json({ error: 'Failed to fetch upstream data' })
	}
}
