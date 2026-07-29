import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchJsonMock = vi.hoisted(() => vi.fn())

vi.mock('~/constants', () => ({ SERVER_URL: 'https://pro-api.llama.fi/test-key/api' }))
vi.mock('~/utils/async', () => ({ fetchJson: fetchJsonMock }))

import { fetchChainAssetsChart, fetchChainAssetsFlows1d, fetchChainsAssets } from './api'
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

describe('fetchChainsAssets', () => {
	beforeEach(() => {
		fetchJsonMock.mockReset()
	})

	it('normalizes numeric strings once and excludes the transport timestamp', async () => {
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

		const assets = await fetchChainsAssets()

		expect(assets).not.toHaveProperty('timestamp')
		expect(assets.Ethereum?.total.total).toBe(12.5)
		expect(assets.Ethereum?.total.breakdown.USDC).toBe(0)
		expect(assets.Ethereum?.total.breakdown.USDT).toBe(2.5)
		expect(assets.Ethereum?.native).toBeUndefined()
		expect(assets.Base?.total.total).toBe(0)
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
