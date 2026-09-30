import { describe, expect, test } from 'vitest'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import { getCryptoCardDetailsHrefs, stampCryptoCardIssuers } from '../issuers'

const cards = [
	{ id: 'kast', defillama_id: '7480' },
	{ id: 'crypto-com-card', parent_id: 'crypto-com', defillama_id: '2270' },
	{ id: 'etherfi', defillama_id: '6373', defillama_parent_id: 'parent#ether-fi' }
]

function protocolMetadata(): Record<string, IProtocolMetadata> {
	return {
		'7480': { name: 'kast-card', displayName: 'Kast Card' },
		'parent#ether-fi': { name: 'ether.fi', displayName: 'ether.fi' },
		'6373': { name: 'etherfi-cash-liquid', displayName: 'EtherFi Cash Liquid' },
		'2270': { name: 'crypto-com', displayName: 'Crypto-com', cex: true },
		'parent#aave': { name: 'aave', displayName: 'Aave' }
	}
}

describe('stampCryptoCardIssuers', () => {
	test('marks each mapped protocol and exchange with its cards issuer', () => {
		const protocols = protocolMetadata()
		stampCryptoCardIssuers(protocols, cards)

		expect(protocols['7480']?.cryptoCardIssuer).toBe('kast')
		expect(protocols['2270']?.cryptoCardIssuer).toBe('crypto-com')
		expect(protocols['parent#aave']?.cryptoCardIssuer).toBeUndefined()
	})

	test("hosts a child card protocol's cards on its parent and points the child there", () => {
		const protocols = protocolMetadata()
		stampCryptoCardIssuers(protocols, cards)

		expect(protocols['parent#ether-fi']?.cryptoCardIssuer).toBe('etherfi')
		expect(protocols['6373']?.cryptoCardIssuer).toBeUndefined()
		expect(protocols['6373']?.cryptoCardRedirectSlug).toBe('ether.fi')
	})
})

describe('getCryptoCardDetailsHrefs', () => {
	test('links protocol issuers under /protocol and exchanges under /cex', () => {
		const hrefs = getCryptoCardDetailsHrefs(protocolMetadata(), cards)

		expect(hrefs.kast).toBe('/protocol/card-details/kast-card')
		expect(hrefs.etherfi).toBe('/protocol/card-details/ether.fi')
		expect(hrefs['crypto-com']).toBe('/cex/card-details/crypto-com')
	})

	test('gives no card page when the API omits the protocol id or metadata lacks it', () => {
		const incompleteCards = [
			...cards,
			{ id: 'missing-id' },
			{ id: 'missing-metadata', defillama_id: '9999' },
			null,
			undefined
		]
		const protocols = protocolMetadata()
		const hrefs = getCryptoCardDetailsHrefs(protocols, incompleteCards)
		stampCryptoCardIssuers(protocols, incompleteCards)

		expect(hrefs['missing-id']).toBeUndefined()
		expect(hrefs['missing-metadata']).toBeUndefined()
		expect(protocols['7480']?.cryptoCardIssuer).toBe('kast')
	})
})
