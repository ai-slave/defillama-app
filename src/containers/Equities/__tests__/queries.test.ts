import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
	EquitiesPriceHistory,
	IEquitiesDimensionsResponse,
	IEquitiesFilingApiItem,
	IEquitiesMetadataResponse,
	IEquitiesOnchainResponse,
	IEquitiesStatementsResponse,
	IEquitiesSummaryResponse
} from '../api.types'
import { getEquitiesTickerPageData } from '../queries'

const mocks = vi.hoisted(() => ({
	fetchEquitiesCompanies: vi.fn(),
	fetchEquitiesCompaniesList: vi.fn(),
	fetchEquitiesDimensions: vi.fn<() => Promise<IEquitiesDimensionsResponse>>(),
	fetchEquitiesFilings: vi.fn<() => Promise<IEquitiesFilingApiItem[]>>(),
	fetchEquitiesMetadata: vi.fn<() => Promise<IEquitiesMetadataResponse>>(),
	fetchEquitiesOnchain: vi.fn<() => Promise<IEquitiesOnchainResponse>>(),
	fetchEquitiesPriceHistory: vi.fn<() => Promise<EquitiesPriceHistory>>(),
	fetchEquitiesStatements: vi.fn<() => Promise<IEquitiesStatementsResponse>>(),
	fetchEquitiesSummary: vi.fn<() => Promise<IEquitiesSummaryResponse>>()
}))

vi.mock('../api', () => mocks)

const emptyDimensions: IEquitiesDimensionsResponse = {
	revenue: { annual: [], quarterly: [] },
	holdersRevenue: { annual: [], quarterly: [] },
	earnings: { annual: [], quarterly: [] }
}

beforeEach(() => {
	vi.clearAllMocks()
	mocks.fetchEquitiesSummary.mockResolvedValue({} as IEquitiesSummaryResponse)
	mocks.fetchEquitiesMetadata.mockResolvedValue({
		ticker: 'NVDA',
		name: 'NVIDIA Corporation',
		country: 'US',
		sector: 'Technology',
		industry: 'Semiconductors',
		employeeCount: null,
		website: 'https://www.nvidia.com',
		description: '',
		startDate: ''
	})
	mocks.fetchEquitiesPriceHistory.mockResolvedValue([])
	mocks.fetchEquitiesStatements.mockResolvedValue({} as IEquitiesStatementsResponse)
	mocks.fetchEquitiesFilings.mockResolvedValue([])
	mocks.fetchEquitiesDimensions.mockResolvedValue(emptyDimensions)
	mocks.fetchEquitiesOnchain.mockResolvedValue({ perps: [], tokens: [] })
})

describe('getEquitiesTickerPageData', () => {
	it('derives an unlocks slug from a lowercased ticker present in emissions metadata', async () => {
		const result = await getEquitiesTickerPageData('NVDA', 'US', {
			protocolDisplayNames: new Map(),
			rwaPlatforms: [],
			emissionsProtocolBySlug: { nvda: 'nvda' }
		})

		expect(result?.unlocksSlug).toBe('nvda')
	})

	it('omits the unlocks slug when the ticker is absent from emissions metadata', async () => {
		const result = await getEquitiesTickerPageData('NVDA', 'US', {
			protocolDisplayNames: new Map(),
			rwaPlatforms: [],
			emissionsProtocolBySlug: {}
		})

		expect(result?.unlocksSlug).toBeNull()
	})
})
