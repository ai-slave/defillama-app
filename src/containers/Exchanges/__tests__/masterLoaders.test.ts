import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	chart: vi.fn(),
	directory: vi.fn(),
	directoryOverview: vi.fn(),
	exchangeSeries: vi.fn(),
	index: vi.fn(),
	metadata: vi.fn(),
	executionQuality: vi.fn(),
	qualityRanks: vi.fn(),
	rankMethodology: vi.fn(),
	mapMetadataOnlyProfile: vi.fn(),
	mapDirectory: vi.fn(),
	mapProfile: vi.fn(),
	mapResearch: vi.fn()
}))

vi.mock('../server/master.upstream', () => ({
	fetchMasterChartFromNetwork: mocks.chart,
	fetchMasterDirectoryFromNetwork: mocks.directory,
	fetchMasterExchangeSeriesFromNetwork: mocks.exchangeSeries,
	fetchMasterExchangeIndexFromNetwork: mocks.index,
	fetchMasterExchangeMetadataFromNetwork: mocks.metadata,
	// fail-soft profile extras — resolved to null in these tests so the loader's
	// core metadata/index behavior stays the thing under test
	fetchMasterExecutionQualityFromNetwork: mocks.executionQuality,
	fetchMasterQualityRanksFromNetwork: mocks.qualityRanks,
	fetchMasterRankMethodologyFromNetwork: mocks.rankMethodology
}))

vi.mock('../master.mappers', () => ({
	mapMasterDirectoryOverview: mocks.directoryOverview,
	mapMasterDirectory: mocks.mapDirectory,
	mapMasterMetadataOnlyProfile: mocks.mapMetadataOnlyProfile,
	mapMasterProfile: mocks.mapProfile,
	mapMasterResearchReport: mocks.mapResearch
}))

beforeEach(() => {
	vi.clearAllMocks()
	// extras default to unavailable — they are fail-soft and must never gate a profile
	mocks.executionQuality.mockRejectedValue(new Error('unavailable'))
	mocks.qualityRanks.mockRejectedValue(new Error('unavailable'))
	mocks.rankMethodology.mockRejectedValue(new Error('unavailable'))
	// the profile's directory read (venue-level nvol) is fail-soft too; directory tests override this
	mocks.directory.mockRejectedValue(new Error('unavailable'))
})

describe('master page loaders', () => {
	test('hides execution data when the optional directory source fails', async () => {
		const directory = { venues: [] }
		mocks.directory.mockResolvedValue(directory)
		mocks.mapDirectory.mockReturnValue({ rows: [], executionAvailable: false })

		const { loadMasterExchangeDirectory } = await import('../server/master.loaders')
		await expect(loadMasterExchangeDirectory()).resolves.toEqual({ rows: [], executionAvailable: false })
		expect(mocks.mapDirectory).toHaveBeenCalledWith(directory, null)
	})

	test('preserves a successful execution source with no measured venues', async () => {
		const directory = { venues: [] }
		const execution = { basket: ['BTC'], unit: 'bps', unit_note: 'Basis points.', venues: {} }
		mocks.directory.mockResolvedValue(directory)
		mocks.executionQuality.mockResolvedValue(execution)
		mocks.mapDirectory.mockReturnValue({ rows: [], executionAvailable: true })

		const { loadMasterExchangeDirectory } = await import('../server/master.loaders')
		await expect(loadMasterExchangeDirectory()).resolves.toEqual({ rows: [], executionAvailable: true })
		expect(mocks.mapDirectory).toHaveBeenCalledWith(directory, execution)
	})

	test('loads and maps an exchange overview range', async () => {
		const payload = { days: [1], key: ['cex_spot_volume'], series: [[100]] }
		mocks.exchangeSeries.mockResolvedValue(payload)
		mocks.directoryOverview.mockReturnValue({ days: [1], series: { cex_spot_volume: [100] } })

		const { loadMasterExchangeOverview } = await import('../server/master.loaders')
		await expect(loadMasterExchangeOverview('all')).resolves.toEqual({
			days: [1],
			series: { cex_spot_volume: [100] }
		})
		expect(mocks.exchangeSeries).toHaveBeenCalledWith('all')
		expect(mocks.directoryOverview).toHaveBeenCalledWith(payload)
	})

	test('loads and maps all four research payloads concurrently', async () => {
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

	test('rejects research generation when one primary payload fails', async () => {
		const failure = new Error('depth unavailable')
		mocks.chart.mockImplementation(async (part: string) => {
			if (part === 'depth') throw failure
			return { built_at: part }
		})

		const { loadMasterResearchReports } = await import('../server/master.loaders')
		await expect(loadMasterResearchReports()).rejects.toBe(failure)
	})

	test('loads metadata before the required index for a markets profile', async () => {
		mocks.metadata.mockResolvedValue({ display_name: 'Venue', profile_mode: 'markets' })
		mocks.index.mockResolvedValue({ exchange: 'venue' })
		mocks.mapProfile.mockReturnValue({ slug: 'venue' })

		const { loadMasterExchangeProfile } = await import('../server/master.loaders')
		await expect(loadMasterExchangeProfile('venue')).resolves.toEqual({ slug: 'venue' })

		expect(mocks.metadata).toHaveBeenCalledWith('venue')
		expect(mocks.index).toHaveBeenCalledWith('venue')
		expect(mocks.mapProfile).toHaveBeenCalledWith(
			{ exchange: 'venue' },
			{ display_name: 'Venue', profile_mode: 'markets' },
			{ execution: null, ranks: null, methodology: null, directory: null }
		)
	})

	test('keeps execution available when only ranking methodology fails', async () => {
		const metadata = { display_name: 'Venue', profile_mode: 'markets' }
		const index = { exchange: 'venue' }
		const execution = { basket: ['BTC'], unit: 'bps', unit_note: 'Basis points.', venues: {} }
		const ranks = { generated_at: '2026-08-24', last_updated: '2026-08-24', venues: {} }
		mocks.metadata.mockResolvedValue(metadata)
		mocks.index.mockResolvedValue(index)
		mocks.executionQuality.mockResolvedValue(execution)
		mocks.qualityRanks.mockResolvedValue(ranks)
		mocks.mapProfile.mockReturnValue({ slug: 'venue' })

		const { loadMasterExchangeProfile } = await import('../server/master.loaders')
		await loadMasterExchangeProfile('venue')

		expect(mocks.mapProfile).toHaveBeenCalledWith(index, metadata, {
			execution,
			ranks,
			methodology: null,
			directory: null
		})
	})

	test('keeps ranking available when only execution fails', async () => {
		const metadata = { display_name: 'Venue', profile_mode: 'markets' }
		const index = { exchange: 'venue' }
		const ranks = { generated_at: '2026-08-24', last_updated: '2026-08-24', venues: {} }
		const methodology = { components: [], exec_subs: [], flags: [], ranks_generated_at: '2026-08-24' }
		mocks.metadata.mockResolvedValue(metadata)
		mocks.index.mockResolvedValue(index)
		mocks.qualityRanks.mockResolvedValue(ranks)
		mocks.rankMethodology.mockResolvedValue(methodology)
		mocks.mapProfile.mockReturnValue({ slug: 'venue' })

		const { loadMasterExchangeProfile } = await import('../server/master.loaders')
		await loadMasterExchangeProfile('venue')

		expect(mocks.mapProfile).toHaveBeenCalledWith(index, metadata, {
			execution: null,
			ranks,
			methodology,
			directory: null
		})
	})

	test('maps a metadata-only profile without requesting its index', async () => {
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

	test('keeps non-404 metadata failures fatal', async () => {
		const failure = new Error('[500] Unavailable')
		mocks.metadata.mockRejectedValue(failure)
		const { loadMasterExchangeProfile } = await import('../server/master.loaders')

		await expect(loadMasterExchangeProfile('dex')).rejects.toBe(failure)
		expect(mocks.index).not.toHaveBeenCalled()
		expect(mocks.mapProfile).not.toHaveBeenCalled()
	})

	test('classifies a metadata 404 as an unknown venue', async () => {
		mocks.metadata.mockRejectedValue(new Error('[404] Not Found'))
		const { loadMasterExchangeProfile, MasterExchangeNotFoundError } = await import('../server/master.loaders')

		await expect(loadMasterExchangeProfile('unknown')).rejects.toBeInstanceOf(MasterExchangeNotFoundError)
		expect(mocks.index).not.toHaveBeenCalled()
		expect(mocks.mapProfile).not.toHaveBeenCalled()
	})

	test('keeps a missing required markets index fatal', async () => {
		mocks.metadata.mockResolvedValue({ display_name: 'Venue', profile_mode: 'markets' })
		const failure = new Error('[404] Not Found')
		mocks.index.mockRejectedValue(failure)
		const { loadMasterExchangeProfile } = await import('../server/master.loaders')

		await expect(loadMasterExchangeProfile('venue')).rejects.toBe(failure)
		expect(mocks.mapProfile).not.toHaveBeenCalled()
	})
})
