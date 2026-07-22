import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	chart: vi.fn(),
	index: vi.fn(),
	metadata: vi.fn(),
	mapMetadataOnlyProfile: vi.fn(),
	mapProfile: vi.fn(),
	mapResearch: vi.fn()
}))

vi.mock('../server/master.upstream', () => ({
	fetchMasterChartFromNetwork: mocks.chart,
	fetchMasterExchangeIndexFromNetwork: mocks.index,
	fetchMasterExchangeMetadataFromNetwork: mocks.metadata
}))

vi.mock('../master.mappers', () => ({
	mapMasterMetadataOnlyProfile: mocks.mapMetadataOnlyProfile,
	mapMasterProfile: mocks.mapProfile,
	mapMasterResearchReport: mocks.mapResearch
}))

beforeEach(() => vi.clearAllMocks())

describe('master page loaders', () => {
	it('loads and maps all four research payloads concurrently', async () => {
		const payloads = new Map([
			['volume', { built_at: 'volume' }],
			['oi', { built_at: 'oi' }],
			['depth', { built_at: 'depth' }],
			['nvol', { built_at: 'nvol' }]
		])
		mocks.chart.mockImplementation(async (part: string) => payloads.get(part))
		mocks.mapResearch.mockImplementation((part: string) => ({ views: [{ id: part }] }))

		const { loadMasterResearchReports } = await import('../server/master.loaders')
		await expect(loadMasterResearchReports()).resolves.toEqual({
			volume: { views: [{ id: 'volume' }] },
			oi: { views: [{ id: 'oi' }] },
			depth: { views: [{ id: 'depth' }] },
			nvol: { views: [{ id: 'nvol' }] }
		})
		expect(mocks.chart.mock.calls.map(([part]) => part)).toEqual(['volume', 'oi', 'depth', 'nvol'])
		for (const [part, payload] of payloads) expect(mocks.mapResearch).toHaveBeenCalledWith(part, payload)
	})

	it('rejects research generation when one primary payload fails', async () => {
		const failure = new Error('depth unavailable')
		mocks.chart.mockImplementation(async (part: string) => {
			if (part === 'depth') throw failure
			return { built_at: part }
		})

		const { loadMasterResearchReports } = await import('../server/master.loaders')
		await expect(loadMasterResearchReports()).rejects.toBe(failure)
	})

	it('loads metadata before the required index for a markets profile', async () => {
		mocks.metadata.mockResolvedValue({ display_name: 'Venue', profile_mode: 'markets' })
		mocks.index.mockResolvedValue({ exchange: 'venue' })
		mocks.mapProfile.mockReturnValue({ slug: 'venue' })

		const { loadMasterExchangeProfile } = await import('../server/master.loaders')
		await expect(loadMasterExchangeProfile('venue')).resolves.toEqual({ slug: 'venue' })

		expect(mocks.metadata).toHaveBeenCalledWith('venue')
		expect(mocks.index).toHaveBeenCalledWith('venue')
		expect(mocks.mapProfile).toHaveBeenCalledWith(
			{ exchange: 'venue' },
			{ display_name: 'Venue', profile_mode: 'markets' }
		)
	})

	it('maps a metadata-only profile without requesting its index', async () => {
		const metadata = { display_name: 'Bitpanda', profile_mode: 'metadata-only' }
		mocks.metadata.mockResolvedValue(metadata)
		mocks.mapMetadataOnlyProfile.mockReturnValue({ slug: 'bitpanda', profileMode: 'metadata-only' })
		const { loadMasterExchangeProfile } = await import('../server/master.loaders')

		await expect(loadMasterExchangeProfile('bitpanda')).resolves.toEqual({
			slug: 'bitpanda',
			profileMode: 'metadata-only'
		})
		expect(mocks.mapMetadataOnlyProfile).toHaveBeenCalledWith(metadata)
		expect(mocks.index).not.toHaveBeenCalled()
		expect(mocks.mapProfile).not.toHaveBeenCalled()
	})

	it('keeps non-404 metadata failures fatal', async () => {
		const failure = new Error('[500] Unavailable')
		mocks.metadata.mockRejectedValue(failure)
		const { loadMasterExchangeProfile } = await import('../server/master.loaders')

		await expect(loadMasterExchangeProfile('dex')).rejects.toBe(failure)
		expect(mocks.index).not.toHaveBeenCalled()
		expect(mocks.mapProfile).not.toHaveBeenCalled()
	})

	it('classifies a metadata 404 as an unknown venue', async () => {
		mocks.metadata.mockRejectedValue(new Error('[404] Not Found'))
		const { loadMasterExchangeProfile, MasterExchangeNotFoundError } = await import('../server/master.loaders')

		await expect(loadMasterExchangeProfile('unknown')).rejects.toBeInstanceOf(MasterExchangeNotFoundError)
		expect(mocks.index).not.toHaveBeenCalled()
		expect(mocks.mapProfile).not.toHaveBeenCalled()
	})

	it('keeps a missing required markets index fatal', async () => {
		mocks.metadata.mockResolvedValue({ display_name: 'Venue', profile_mode: 'markets' })
		const failure = new Error('[404] Not Found')
		mocks.index.mockRejectedValue(failure)
		const { loadMasterExchangeProfile } = await import('../server/master.loaders')

		await expect(loadMasterExchangeProfile('venue')).rejects.toBe(failure)
		expect(mocks.mapProfile).not.toHaveBeenCalled()
	})
})
