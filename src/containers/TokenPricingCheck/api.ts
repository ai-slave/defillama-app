import { sha256 } from 'viem'
import type { PriceObject } from '~/api/types'
import { fetchJson } from '~/utils/async'

const BASE_URL = 'https://coins.llama.fi'
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const NON_CHAINS = new Set(['borrowed', 'pool2', 'staking'])

type Lookup<T> = { status: 'available'; value: T } | { status: 'missing' | 'error' }

function lookup<T>(result: PromiseSettledResult<T | null>): Lookup<T> {
	if (result.status === 'rejected') return { status: 'error' }
	return result.value == null ? { status: 'missing' } : { status: 'available', value: result.value }
}

async function fetchCoin<T>(path: string, key: string, query = ''): Promise<T | null> {
	const response = await fetchJson<{ coins?: Record<string, T> }>(
		`${BASE_URL}/${path}/${encodeURIComponent(key)}${query}`
	)
	if (!response?.coins || typeof response.coins !== 'object') {
		throw new Error('The pricing service returned an unexpected response.')
	}
	return response.coins[key] ?? null
}

export async function fetchPricingChains(): Promise<Array<string>> {
	const chains = await fetchJson<unknown>(`${BASE_URL}/chains`)
	if (
		!Array.isArray(chains) ||
		chains.length === 0 ||
		!chains.every((chain) => typeof chain === 'string' && /^[a-z0-9_-]+$/.test(chain))
	) {
		throw new Error('The pricing service returned an unexpected chain list.')
	}
	return chains.filter((chain) => !NON_CHAINS.has(chain))
}

function tronBase58(hex: string): string {
	const bytes = Uint8Array.from((hex.length === 42 ? hex : `41${hex}`).match(/../g)!, (byte) => parseInt(byte, 16))
	const checksum = sha256(sha256(bytes, 'bytes'), 'bytes').slice(0, 4)
	let value = BigInt(`0x${Array.from([...bytes, ...checksum], (byte) => byte.toString(16).padStart(2, '0')).join('')}`)
	let result = ''
	while (value > 0n) {
		result = BASE58[Number(value % 58n)] + result
		value /= 58n
	}
	return result
}

function tonChecksum(bytes: Uint8Array): number {
	let checksum = 0
	for (const byte of bytes.slice(0, 34)) {
		checksum ^= byte << 8
		for (let bit = 0; bit < 8; bit++) {
			checksum = checksum & 0x80_00 ? ((checksum << 1) ^ 0x10_21) & 0xff_ff : (checksum << 1) & 0xff_ff
		}
	}
	return checksum
}

function tonFriendly(address: string): string {
	if (!/^[A-Za-z0-9_+/-]{48}$/.test(address)) return address
	const bytes = Uint8Array.from(atob(address.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0))
	if (bytes.length !== 36 || ![0x11, 0x51, 0x91, 0xd1].includes(bytes[0])) return address
	let checksum = tonChecksum(bytes)
	if (bytes[34] !== checksum >> 8 || bytes[35] !== (checksum & 255)) return address
	if (bytes[0] === 0x51) {
		bytes[0] = 0x11
		checksum = tonChecksum(bytes)
		bytes[34] = checksum >> 8
		bytes[35] = checksum & 255
	}
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
}

export function tokenPriceKey(chain: string, address: string): string {
	const normalizedChain = chain.trim().toLowerCase()
	const trimmedAddress = address.trim()
	if (!/^[a-z0-9_-]+$/.test(normalizedChain)) {
		throw new Error('Enter a valid chain identifier, such as ethereum or solana.')
	}
	if (!trimmedAddress || trimmedAddress.length > 256 || /[^\x21-\x7e]|[,?#]/.test(trimmedAddress)) {
		throw new Error('Enter a valid token address.')
	}
	if (normalizedChain === 'xrp' && trimmedAddress === 'XRP') return 'ripple:XRP'
	if (normalizedChain === 'tron') {
		const hex = trimmedAddress.replace(/^0x/i, '').toLowerCase()
		if (/^(?:[0-9a-f]{40}|41[0-9a-f]{40})$/.test(hex) && !/^0{40}$/.test(hex)) {
			return `tron:${tronBase58(hex)}`
		}
	}
	if (normalizedChain === 'ton') return `ton:${tonFriendly(trimmedAddress)}`
	const normalizedAddress = trimmedAddress
		.replace(/^0x[0-9a-f]+(?=$|::)/i, (account) => account.toLowerCase())
		.replace(/^0x0+([0-9a-f]+)(?=::)/, (account, digits: string) =>
			['sui', 'aptos'].includes(normalizedChain) && (account.length < 66 || BigInt(account) < 256n)
				? `0x${digits}`
				: account
		)
	return `${normalizedChain}:${normalizedAddress}`
}

export async function checkTokenPricing(key: string): Promise<PriceObject | null> {
	const price = await fetchCoin<PriceObject>('prices/current', key)
	if (price && (!Number.isFinite(price.price) || !Number.isFinite(price.timestamp))) {
		throw new Error('The pricing service returned invalid current-price data.')
	}
	return price
}

async function fetchFirstPriceTimestamp(key: string): Promise<number | null> {
	const firstPrice = await fetchCoin<{ timestamp: number }>('prices/first', key)
	if (!firstPrice) return null
	if (!Number.isFinite(firstPrice.timestamp)) {
		throw new Error('The pricing service returned an invalid first-price timestamp.')
	}
	return firstPrice.timestamp
}

export async function checkTokenPricingDetails(key: string): Promise<{
	currentPrice: PriceObject | null
	firstPrice: Lookup<number>
}> {
	const [currentResult, firstResult] = await Promise.allSettled([checkTokenPricing(key), fetchFirstPriceTimestamp(key)])
	if (currentResult.status === 'rejected') throw currentResult.reason
	return {
		currentPrice: currentResult.value,
		firstPrice: lookup(firstResult)
	}
}
