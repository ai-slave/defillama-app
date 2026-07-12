import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'

const mocks = vi.hoisted(() => ({ readJson: vi.fn() }))

vi.mock('~/server/datasetSnapshots/errors', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/server/datasetSnapshots/errors')>()),
	isMissingDatasetSnapshotArtifact: (error: unknown) =>
		typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}))

const snapshot = {
	handle: {
		ref: { domain: 'yields', snapshotId: 'test', formatVersion: 2, schemaVersion: 1, createdAt: 1 },
		readJson: mocks.readJson
	}
} as any

const btcRow: IYieldTableRow = {
	pool: 'WBTC-ETH',
	projectslug: 'maker',
	project: 'Maker',
	chains: ['Ethereum'],
	tvl: 100,
	apy: 1,
	apyBase: 1,
	apyReward: 0,
	rewardTokensSymbols: [],
	rewards: [],
	change1d: null,
	change7d: null,
	confidence: null,
	url: 'https://example.com',
	category: 'Lending',
	configID: 'pool-1'
}

const ethRow: IYieldTableRow = {
	...btcRow,
	pool: 'USDC-ETH',
	tvl: 200,
	apy: 2,
	configID: 'pool-2'
}

beforeEach(() => {
	vi.clearAllMocks()
	vi.resetModules()
})

describe('Yields dataset snapshot adapter', () => {
	it('uses immutable token indexes when the optional shard exists', async () => {
		mocks.readJson.mockImplementation((relativePath: string) => {
			if (relativePath === 'rows.json') return Promise.resolve([ethRow, btcRow])
			if (relativePath.startsWith('by-token/')) return Promise.resolve([btcRow.configID])
			throw new Error(`Unexpected artifact ${relativePath}`)
		})

		const { getTokenYieldsRows } = await import('~/containers/Yields/server/snapshot.reader.server')

		await expect(getTokenYieldsRows(snapshot, 'BTC')).resolves.toEqual([btcRow])
	})

	it('falls back to filtering required rows only when optional token shards are absent', async () => {
		mocks.readJson.mockImplementation((relativePath: string) => {
			if (relativePath === 'rows.json') return Promise.resolve([ethRow, btcRow])
			if (relativePath.startsWith('by-token/')) return Promise.reject({ code: 'ENOENT' })
			throw new Error(`Unexpected artifact ${relativePath}`)
		})

		const { getTokenYieldsRows } = await import('~/containers/Yields/server/snapshot.reader.server')

		await expect(getTokenYieldsRows(snapshot, 'BTC')).resolves.toEqual([btcRow])
	})

	it('returns pool page data from rows and configuration snapshots', async () => {
		mocks.readJson.mockImplementation((relativePath: string) => {
			if (relativePath === 'rows.json') return Promise.resolve([btcRow])
			if (relativePath === 'config.json') return Promise.resolve({ protocols: { maker: { name: 'Maker' } } })
			throw new Error(`Unexpected artifact ${relativePath}`)
		})

		const { getYieldPoolPageData } = await import('~/containers/Yields/server/snapshot.reader.server')

		await expect(getYieldPoolPageData(snapshot, 'pool-1')).resolves.toEqual({
			source: 'snapshot',
			data: {
				pool: btcRow,
				config: { name: 'Maker' },
				poolId: 'pool-1'
			}
		})
	})
})
