import { beforeEach, describe, expect, test } from 'vitest'
import { CARDS_SERVER_URL, V2_SERVER_URL } from '~/constants'
import type { IProtocolMetricsV2Api } from '~/containers/ProtocolOverview/api.types'
import { getStaticProps as getCexCardDetailsStaticProps } from '~/pages/cex/card-details/[cex]'
import { getStaticProps as getProtocolCardDetailsStaticProps } from '~/pages/protocol/card-details/[protocol]'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { stampCryptoCardIssuers } from '../issuers'
import { cardDetail, cardsIndexCard, cardsIndexResponse } from './fixtures'

const metadata = installMetadataSeeder()
const http = installFixtureFetch()

function protocolMetrics(id: string, name: string): IProtocolMetricsV2Api {
	return {
		id,
		name,
		symbol: '-',
		url: 'https://example.com',
		description: null,
		logo: null,
		gecko_id: null,
		cmcId: null,
		chains: [],
		currentChainTvls: {},
		mcap: null,
		category: 'Crypto Card Issuer',
		tags: [],
		chain: 'Ethereum',
		module: 'dummy.js',
		hacks: [],
		raises: []
	}
}

const kastCard = cardsIndexCard('kast')
const cryptoComCard = cardsIndexCard('crypto-com-card', 'crypto-com')

describe('card detail routes', () => {
	beforeEach(() => {
		// Built through the metadata step's own stamp, so the routes read what it writes.
		const protocolMetadata: Record<string, IProtocolMetadata> = {
			'7480': { name: 'kast-card', displayName: 'Kast Card' },
			'parent#ether-fi': { name: 'ether.fi', displayName: 'ether.fi', tvl: true },
			'6373': { name: 'etherfi-cash-liquid', displayName: 'EtherFi Cash Liquid', tvl: true },
			'2270': { name: 'crypto-com', displayName: 'Crypto-com', tvl: true, cex: true },
			'parent#aave': { name: 'aave', displayName: 'Aave', tvl: true }
		}
		stampCryptoCardIssuers(protocolMetadata)
		metadata.seed({
			protocolMetadata,
			protocolRouteIdBySlug: {
				'kast-card': '7480',
				'ether.fi': 'parent#ether-fi',
				'etherfi-cash-liquid': '6373',
				aave: 'parent#aave'
			},
			cexRouteIdBySlug: { 'crypto-com': '2270', 'crypto.com': '2270' },
			cexMetadataBySlug: {}
		})
		http.serve({
			[`${CARDS_SERVER_URL}/index`]: cardsIndexResponse([kastCard, cryptoComCard]),
			[`${CARDS_SERVER_URL}/cards/kast`]: cardDetail(kastCard),
			[`${CARDS_SERVER_URL}/cards/crypto-com-card`]: cardDetail(cryptoComCard),
			[`${V2_SERVER_URL}/metrics/tvl/protocol/kast-card`]: protocolMetrics('7480', 'Kast Card'),
			[`${V2_SERVER_URL}/metrics/tvl/protocol/crypto-com`]: protocolMetrics('2270', 'Crypto-com')
		})
	})

	test("renders a protocol's own cards with the Card Details tab on", async () => {
		const result = await getProtocolCardDetailsStaticProps({ params: { protocol: 'kast-card' } } as never)

		expect(result).toMatchObject({ props: { name: 'Kast Card', isCEX: false, metrics: { cryptoCards: true } } })
		expect('props' in result && result.props.cards.map(({ card }) => card.id)).toEqual(['kast'])
	})

	test("sends a child card protocol to its parent's card page", async () => {
		await expect(
			getProtocolCardDetailsStaticProps({ params: { protocol: 'etherfi-cash-liquid' } } as never)
		).resolves.toEqual({ redirect: { destination: '/protocol/card-details/ether.fi', permanent: false } })
	})

	test('sends an exchange to its card page under /cex', async () => {
		await expect(getProtocolCardDetailsStaticProps({ params: { protocol: 'crypto-com' } } as never)).resolves.toEqual({
			redirect: { destination: '/cex/card-details/crypto-com', permanent: false }
		})
	})

	test("renders an exchange's cards in the exchange layout", async () => {
		const result = await getCexCardDetailsStaticProps({ params: { cex: 'crypto-com' } } as never)

		expect(result).toMatchObject({ props: { name: 'Crypto-com', isCEX: true, metrics: { cryptoCards: true } } })
		expect('props' in result && result.props.cards.map(({ card }) => card.id)).toEqual(['crypto-com-card'])
	})

	test('redirects an exchange alias to the canonical card page', async () => {
		await expect(getCexCardDetailsStaticProps({ params: { cex: 'crypto.com' } } as never)).resolves.toEqual({
			redirect: { destination: '/cex/card-details/crypto-com', permanent: true }
		})
	})

	test('fails instead of mixing card data from two dataset versions', async () => {
		http.serve({ [`${CARDS_SERVER_URL}/cards/kast`]: { ...cardDetail(kastCard), version: 'run-2' } })

		await expect(getProtocolCardDetailsStaticProps({ params: { protocol: 'kast-card' } } as never)).rejects.toThrow(
			'Crypto card kast is at dataset run-2, index is at run-1'
		)
	})

	test('returns 404 for a protocol that issues no card', async () => {
		await expect(getProtocolCardDetailsStaticProps({ params: { protocol: 'aave' } } as never)).resolves.toEqual({
			notFound: true
		})
	})
})
