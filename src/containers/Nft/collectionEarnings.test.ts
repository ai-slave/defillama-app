import { beforeEach, describe, expect, test, vi } from 'vitest'

const { fetchNftCollectionsMock, fetchNftRoyaltiesMock, fetchParentCompaniesMock } = vi.hoisted(() => ({
	fetchNftCollectionsMock: vi.fn(),
	fetchNftRoyaltiesMock: vi.fn(),
	fetchParentCompaniesMock: vi.fn()
}))

vi.mock('./api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./api')>()),
	fetchNftCollections: fetchNftCollectionsMock,
	fetchNftRoyalties: fetchNftRoyaltiesMock,
	fetchParentCompanies: fetchParentCompaniesMock
}))

import { getNFTCollectionEarnings } from './queries'

describe('NFT collection earnings behavior fixture', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		fetchNftCollectionsMock.mockResolvedValue([
			{ collectionId: '0xbbb', name: 'Alpha Two', image: 'b' },
			{ collectionId: '0xaaa', name: 'Alpha One', image: 'a' },
			{ collectionId: '0xccc', name: 'Independent', image: 'c' }
		])
		fetchNftRoyaltiesMock.mockResolvedValue([
			{ collection: 'aaa', usd1D: 1, usd7D: 10, usd30D: 100, usdLifetime: 1000 },
			{ collection: 'bbb', usd1D: 2, usd7D: 20, usd30D: 200, usdLifetime: 2000 },
			{ collection: 'ccc', usd1D: 4, usd7D: 40, usd30D: 400, usdLifetime: 4000 }
		])
		fetchParentCompaniesMock.mockResolvedValue([
			{
				name: 'Alpha Parent',
				url: '',
				nftCollections: [
					['0xAAA', 'Alpha One'],
					['0xBBB', 'Alpha Two']
				]
			}
		])
	})

	test('aggregates parent members in declared order and excludes their duplicate top-level rows', async () => {
		const result = await getNFTCollectionEarnings()
		const parent = result.earnings.find((row) => row.name === 'Alpha Parent')

		expect(parent).toMatchObject({
			defillamaId: '0xaaa+0xbbb',
			total24h: 3,
			total7d: 30,
			total30d: 300,
			totalRoyaltyEarnings: 3000,
			totalEarnings: 3000
		})
		expect(parent && 'subRows' in parent ? parent.subRows.map((row) => row.name) : null).toEqual([
			'Alpha One',
			'Alpha Two'
		])
		expect(result.earnings.map((row) => row.name)).toEqual(['Independent', 'Alpha Parent'])
	})

	test('normalizes identifiers, keeps first royalty data, and skips duplicate or missing parent members', async () => {
		const collections = [
			{ collectionId: '0XBBB', name: 'Shared', image: 'b' },
			{ collectionId: 'aaa', name: 'Royalty Only', image: 'a' },
			{
				collectionId: '0xBC4CA0EDA7647A8AB7C2061C2E118A18A936F13D',
				name: 'Mint And Royalty',
				image: 'mint'
			},
			{ collectionId: '34d85c9cdeb23fa97cb08333b511ac86e1c4e258', name: 'Mint Only', image: 'mint-only' },
			{ collectionId: '0xddd', name: 'No Earnings', image: 'none' }
		]
		const royalties = [
			{ collection: '0xAAA', usd1D: 1, usd7D: 2, usd30D: 3, usdLifetime: 4 },
			{ collection: 'aaa', usd1D: 100, usd7D: 200, usd30D: 300, usdLifetime: 400 },
			{ collection: 'bbb', usd1D: 5, usd7D: 6, usd30D: 7, usdLifetime: 8 },
			{
				collection: 'bc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
				usd1D: 9,
				usd7D: 10,
				usd30D: 11,
				usdLifetime: 12
			}
		]
		const parents = [
			{
				name: 'First Parent',
				url: '',
				nftCollections: [
					['AAA', 'Royalty Only'],
					['0xbbb', 'Shared'],
					['0XAAA', 'Royalty Only Again'],
					['0xmissing', 'Missing']
				]
			},
			{ name: 'Second Parent', url: '', nftCollections: [['BBB', 'Shared']] }
		]
		const originalInputs = structuredClone({ collections, royalties, parents })
		fetchNftCollectionsMock.mockResolvedValue(collections)
		fetchNftRoyaltiesMock.mockResolvedValue(royalties)
		fetchParentCompaniesMock.mockResolvedValue(parents)

		const result = await getNFTCollectionEarnings()
		const firstParent = result.earnings.find((row) => row.name === 'First Parent')
		const secondParent = result.earnings.find((row) => row.name === 'Second Parent')
		const mintRow = result.earnings.find((row) => row.name === 'Mint And Royalty')
		const mintOnlyRow = result.earnings.find((row) => row.name === 'Mint Only')

		expect(firstParent).toMatchObject({
			defillamaId: '0xaaa+0xbbb+0xaaa+0xmissing',
			total24h: 6,
			totalRoyaltyEarnings: 12,
			totalEarnings: 12
		})
		expect(firstParent && 'subRows' in firstParent ? firstParent.subRows.map((row) => row.name) : null).toEqual([
			'Royalty Only',
			'Shared'
		])
		expect(secondParent && 'subRows' in secondParent ? secondParent.subRows.map((row) => row.name) : null).toEqual([
			'Shared'
		])
		expect(mintRow).toMatchObject({
			defillamaId: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
			totalRoyaltyEarnings: 12,
			totalMintEarnings: 1_864_857.028,
			totalEarnings: 1_864_869.028
		})
		expect(mintOnlyRow).toMatchObject({ totalMintEarnings: 316_775_940.5, totalEarnings: 316_775_940.5 })
		expect(result.earnings.some((row) => row.name === 'No Earnings')).toBe(false)
		expect(result.earnings.some((row) => row.name === 'Royalty Only' || row.name === 'Shared')).toBe(false)
		expect({ collections, royalties, parents }).toEqual(originalInputs)
	})

	test('preserves encounter order when top-level earnings totals tie', async () => {
		fetchNftCollectionsMock.mockResolvedValue([
			{ collectionId: '0xaaa', name: 'First', image: 'a' },
			{ collectionId: '0xbbb', name: 'Second', image: 'b' }
		])
		fetchNftRoyaltiesMock.mockResolvedValue([
			{ collection: 'aaa', usd1D: null, usd7D: null, usd30D: null, usdLifetime: 10 },
			{ collection: 'bbb', usd1D: null, usd7D: null, usd30D: null, usdLifetime: 10 }
		])
		fetchParentCompaniesMock.mockResolvedValue([])

		expect((await getNFTCollectionEarnings()).earnings.map((row) => row.name)).toEqual(['First', 'Second'])
	})

	test('returns an empty result when the required earnings request fails', async () => {
		fetchNftRoyaltiesMock.mockRejectedValue(new Error('unavailable'))
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

		expect(await getNFTCollectionEarnings()).toEqual({ earnings: [] })
		log.mockRestore()
	})
})
