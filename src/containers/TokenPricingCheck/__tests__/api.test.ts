import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchJson } from '~/utils/async'
import { checkTokenPricing, checkTokenPricingDetails, fetchPricingChains, tokenPriceKey } from '../api'
import { pricingChainName } from '../chains'

vi.mock('~/utils/async', () => ({ fetchJson: vi.fn() }))

const fetchJsonMock = vi.mocked(fetchJson)
const usdc = 'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

describe('token pricing check', () => {
	beforeEach(() => {
		fetchJsonMock.mockReset()
	})

	test('normalizes chain and EVM address without changing a case-sensitive Solana address', () => {
		expect(tokenPriceKey(' Ethereum ', ' 0xA0b86991C6218b36c1d19d4a2e9eb0ce3606eb48 ')).toBe(usdc)
		expect(tokenPriceKey(' Solana ', 'So11111111111111111111111111111111111111112')).toBe(
			'solana:So11111111111111111111111111111111111111112'
		)
	})

	test('accepts Sui and Aptos Move token identifiers without changing type case', () => {
		expect(tokenPriceKey('Sui', ' 0x2::sui::SUI ')).toBe('sui:0x2::sui::SUI')
		expect(tokenPriceKey('Sui', '0x0002::sui::SUI')).toBe('sui:0x2::sui::SUI')
		expect(tokenPriceKey('Sui', `0x${'0'.repeat(63)}2::sui::SUI`)).toBe('sui:0x2::sui::SUI')
		expect(tokenPriceKey('Aptos', '0x1::aptos_coin::AptosCoin')).toBe('aptos:0x1::aptos_coin::AptosCoin')
		expect(tokenPriceKey('Aptos', '0x01::aptos_coin::AptosCoin')).toBe('aptos:0x1::aptos_coin::AptosCoin')
		expect(tokenPriceKey('sui', '0xABCD::module::MyCoin')).toBe('sui:0xabcd::module::MyCoin')
		expect(tokenPriceKey('aptos', '0xABCD')).toBe('aptos:0xabcd')
		const fullLength = `0x0${'a'.repeat(63)}`
		expect(tokenPriceKey('sui', `${fullLength}::coin::COIN`)).toBe(`sui:${fullLength}::coin::COIN`)
	})

	test('does not impose EVM address length on other chains', () => {
		const starknetEth = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
		expect(tokenPriceKey('starknet', starknetEth)).toBe(`starknet:${starknetEth}`)
		expect(tokenPriceKey('cosmos', 'ibc/ABC123')).toBe('cosmos:ibc/ABC123')
	})

	test('preserves Tron and TON address forms and encodes non-EVM identifiers in lookup URLs', async () => {
		const addresses = [
			[
				'Tron',
				'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
				'tron:TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
				'https://coins.llama.fi/prices/current/tron%3ATR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
			],
			[
				'TON',
				'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
				'ton:EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
				'https://coins.llama.fi/prices/current/ton%3AEQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'
			],
			[
				'ton',
				'0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe',
				'ton:0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe',
				'https://coins.llama.fi/prices/current/ton%3A0%3Ab113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe'
			],
			['cosmos', 'ibc/ABC123', 'cosmos:ibc/ABC123', 'https://coins.llama.fi/prices/current/cosmos%3Aibc%2FABC123']
		] as const
		for (const [chain, address, key, url] of addresses) {
			expect(tokenPriceKey(chain, address)).toBe(key)
			const price = { price: 1, symbol: 'TEST', timestamp: 1_789_325_550, confidence: 1 }
			fetchJsonMock.mockResolvedValueOnce({ coins: { [key]: price } })
			await expect(checkTokenPricing(key)).resolves.toEqual(price)
			expect(fetchJsonMock).toHaveBeenLastCalledWith(url)
		}
	})

	test('resolves equivalent Tron hex addresses to the priced Base58 contract', () => {
		const base58 = 'tron:TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
		const hex = 'a614f803b6fd780986a42c78ec9c7f77e6ded13c'
		for (const address of [`41${hex}`, `0x41${hex}`, `0x${hex}`]) {
			expect(tokenPriceKey('tron', address)).toBe(base58)
		}
		const startsWith41 = `41${'a'.repeat(38)}`
		expect(tokenPriceKey('tron', `0x${startsWith41}`)).toBe(tokenPriceKey('tron', `41${startsWith41}`))
		expect(tokenPriceKey('tron', '0x0000000000000000000000000000000000000000')).toBe(
			'tron:0x0000000000000000000000000000000000000000'
		)
	})

	test('resolves TON non-bounceable and standard-base64 forms to the priced friendly address', () => {
		const bounceable = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'
		expect(tokenPriceKey('ton', 'UQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_p0p')).toBe(`ton:${bounceable}`)
		expect(tokenPriceKey('ton', 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id/sDs')).toBe(`ton:${bounceable}`)
		expect(tokenPriceKey('ton', 'UQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_p0x')).toBe(
			'ton:UQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_p0x'
		)
	})

	test('uses the priced Ripple key for native XRP', () => {
		expect(tokenPriceKey('xrp', 'XRP')).toBe('ripple:XRP')
	})

	test('names chains from the site display names before title-casing an unmapped key', () => {
		expect(pricingChainName('avax', { avax: 'Avalanche C-Chain' })).toBe('Avalanche C-Chain')
		expect(pricingChainName('base_sepolia', {})).toBe('Base Sepolia')
	})

	test('does not list aggregate categories as chains', async () => {
		fetchJsonMock.mockResolvedValueOnce(['ethereum', 'borrowed', 'pool2', 'staking', 'solana'])
		await expect(fetchPricingChains()).resolves.toEqual(['ethereum', 'solana'])
	})

	test('rejects an invalid pricing-service chain list', async () => {
		fetchJsonMock.mockResolvedValueOnce(['ethereum', 'not/a/chain'])
		await expect(fetchPricingChains()).rejects.toThrow('unexpected chain list')
	})

	test('rejects empty or unsafe identifiers before constructing a URL', () => {
		expect(() => tokenPriceKey('ethereum/other', '0x123')).toThrow('chain identifier')
		expect(() => tokenPriceKey('ethereum', ' ')).toThrow('token address')
		expect(() => tokenPriceKey('ethereum', 'abc def')).toThrow('token address')
		expect(() => tokenPriceKey('ethereum', 'abc,def')).toThrow('token address')
		expect(() => tokenPriceKey('ethereum', 'address?searchWidth=1d')).toThrow('token address')
		expect(() => tokenPriceKey('sui', '0x2::sui::SUI?searchWidth=1d')).toThrow('token address')
		expect(() => tokenPriceKey('aptos', 'x'.repeat(257))).toThrow('token address')
	})

	test('reports coverage only when the requested token is present', async () => {
		const price = { price: 1, symbol: 'USDC', timestamp: 1_789_325_550, confidence: 0.99 }
		fetchJsonMock.mockResolvedValueOnce({ coins: { [usdc]: price } }).mockResolvedValueOnce({ coins: {} })

		await expect(checkTokenPricing(usdc)).resolves.toEqual(price)
		await expect(checkTokenPricing(usdc)).resolves.toBeNull()
	})

	test('does not confuse a failed or malformed response with missing coverage', async () => {
		fetchJsonMock.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({})
		await expect(checkTokenPricing(usdc)).rejects.toThrow('unavailable')
		await expect(checkTokenPricing(usdc)).rejects.toThrow('unexpected response')
	})

	test('does not show an invalid current quote as pricing coverage', async () => {
		fetchJsonMock.mockResolvedValueOnce({ coins: { [usdc]: { price: null, timestamp: 1_789_325_550 } } })
		await expect(checkTokenPricing(usdc)).rejects.toThrow('invalid current-price data')
	})

	test('includes the first recorded price alongside current coverage', async () => {
		const current = { price: 1, symbol: 'USDC', timestamp: 1_789_325_550, confidence: 0.99 }
		fetchJsonMock
			.mockResolvedValueOnce({ coins: { [usdc]: current } })
			.mockResolvedValueOnce({ coins: { [usdc]: { timestamp: 1_538_667_082 } } })

		await expect(checkTokenPricingDetails(usdc)).resolves.toEqual({
			currentPrice: current,
			firstPrice: { status: 'available', value: 1_538_667_082 }
		})
	})

	test('can report historical coverage without a current price', async () => {
		fetchJsonMock
			.mockResolvedValueOnce({ coins: {} })
			.mockResolvedValueOnce({ coins: { [usdc]: { timestamp: 1_538_667_082 } } })
		await expect(checkTokenPricingDetails(usdc)).resolves.toEqual({
			currentPrice: null,
			firstPrice: { status: 'available', value: 1_538_667_082 }
		})
	})

	test('keeps the current result when the first-price lookup fails', async () => {
		const current = { price: 1, symbol: 'USDC', timestamp: 1_789_325_550, confidence: 0.99 }
		fetchJsonMock.mockResolvedValueOnce({ coins: { [usdc]: current } }).mockRejectedValueOnce(new Error('unavailable'))
		await expect(checkTokenPricingDetails(usdc)).resolves.toEqual({
			currentPrice: current,
			firstPrice: { status: 'error' }
		})
	})
})
