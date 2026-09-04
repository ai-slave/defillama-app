import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchJsonMock = vi.hoisted(() => vi.fn())

vi.mock('~/constants', () => ({ SERVER_URL: 'https://pro-api.llama.fi/test-key/api' }))
vi.mock('~/utils/async', () => ({ fetchJson: fetchJsonMock }))

import { fetchChainAssetsChart, fetchChainAssetsDetail, fetchChainAssetsFlows1d } from './api'
import { normalizeChainsAssetTotalsResponse } from './normalizers'

const rawCategory = (total: string, breakdown: Record<string, string> = {}) => ({ total, breakdown })

describe('chain asset totals projection', () => {
	it('normalizes totals without carrying token breakdowns into list page data', () => {
		const response = {
			timestamp: 1_800_000_000,
			Ethereum: {
				total: rawCategory('12.5', { USDC: '10', USDT: '2.5' }),
				canonical: rawCategory('10', { USDC: '10' }),
				thirdParty: rawCategory('2.5', { USDT: '2.5' })
			}
		}

		expect(normalizeChainsAssetTotalsResponse(response)).toEqual({
			Ethereum: {
				total: { total: 12.5 },
				canonical: { total: 10 },
				thirdParty: { total: 2.5 }
			}
		})
	})
})

describe('eight-section producer payloads', () => {
	it('normalizes stablecoins, rwa and lst alongside the original five', () => {
		const response = {
			timestamp: 1_800_000_000,
			Ethereum: {
				total: rawCategory('100', { USDC: '60', ONDO: '40' }),
				canonical: rawCategory('10', { WETH: '10' }),
				thirdParty: rawCategory('20', { WBTC: '20' }),
				native: rawCategory('30', { LDO: '30' }),
				ownTokens: rawCategory('500', { ETH: '500' }),
				stablecoins: rawCategory('35', { USDC: '35' }),
				rwa: rawCategory('3', { ONDO: '3' }),
				lst: rawCategory('2', { STETH: '2' })
			}
		}

		expect(normalizeChainsAssetTotalsResponse(response)).toEqual({
			Ethereum: {
				total: { total: 100 },
				canonical: { total: 10 },
				thirdParty: { total: 20 },
				native: { total: 30 },
				ownTokens: { total: 500 },
				stablecoins: { total: 35 },
				rwa: { total: 3 },
				lst: { total: 2 }
			}
		})
	})
})

describe('fetchChainAssetsDetail', () => {
	beforeEach(() => {
		fetchJsonMock.mockReset()
	})

	it('normalizes the selected breakdown and projects navigation totals', async () => {
		const response = {
			timestamp: 1_800_000_000,
			Ethereum: {
				total: rawCategory('12.5', { USDC: '0', USDT: '2.5' }),
				canonical: rawCategory('10'),
				thirdParty: rawCategory('2.5')
			},
			Base: {
				total: rawCategory('0'),
				canonical: rawCategory('0'),
				thirdParty: rawCategory('0'),
				native: rawCategory('0')
			}
		}
		fetchJsonMock.mockResolvedValue(response)

		const { chainData, totals } = await fetchChainAssetsDetail('ethereum')

		expect(totals).not.toHaveProperty('timestamp')
		expect(totals.Ethereum?.total).toEqual({ total: 12.5 })
		expect(totals.Base?.total.total).toBe(0)
		expect(chainData?.total.breakdown.USDC).toBe(0)
		expect(chainData?.total.breakdown.USDT).toBe(2.5)
		expect(chainData?.native).toBeUndefined()
	})
})

describe('fetchChainAssetsFlows1d', () => {
	beforeEach(() => {
		fetchJsonMock.mockReset()
	})

	it('normalizes every represented flow category and preserves zero', async () => {
		fetchJsonMock.mockResolvedValue({
			Base: {
				total: { perc: '0', raw: '0' },
				stablecoins: { perc: '-1.5', raw: '25.25' },
				rwa: { perc: '2', raw: '3' }
			}
		})

		const flows = await fetchChainAssetsFlows1d()

		expect(flows?.Base).toEqual({
			total: { perc: 0, raw: 0 },
			stablecoins: { perc: -1.5, raw: 25.25 },
			rwa: { perc: 2, raw: 3 }
		})
	})
})

describe('fetchChainAssetsChart', () => {
	beforeEach(() => {
		fetchJsonMock.mockReset()
	})

	it('keeps producer timestamps in seconds and normalizes every string section including zero', async () => {
		fetchJsonMock.mockResolvedValue([
			{ timestamp: 1_700_000_000, data: { total: '42.5', ownTokens: '0', canonical: '30' } },
			{ timestamp: 1_700_086_400, data: { total: '0' } }
		])

		await expect(fetchChainAssetsChart('base')).resolves.toEqual([
			{ timestamp: 1_700_000_000, data: { total: 42.5, ownTokens: 0, canonical: 30 } },
			{ timestamp: 1_700_086_400, data: { total: 0 } }
		])
		expect(fetchJsonMock).toHaveBeenCalledWith('https://pro-api.llama.fi/test-key/api/chain-assets/chart/base')
	})
})
