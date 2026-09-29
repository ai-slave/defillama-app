import { slug } from '~/utils'
import type { IProtocolMetadata } from '~/utils/metadata/types'

/** Cards issuer (`parent_id ?? id` in the cards index) → DefiLlama protocol ids that show the
 *  Card Details tab. The first id hosts the card page; any others are its children, which show
 *  the tab and redirect to the host. Protocol metadata does not carry parent links, so the
 *  children are listed here. Ids, not slugs, so a rename keeps the tab. An issuer missing from
 *  this map has no card page, and the /crypto-cards table links to its website instead. */
export const CRYPTO_CARD_ISSUER_PROTOCOL_IDS: Record<string, [string, ...Array<string>]> = {
	'avalanche-card': ['8779'],
	avici: ['8034'],
	'bitget-wallet': ['7379'],
	bybit: ['2286'],
	coinbase: ['8780'],
	'crypto-com': ['2270'],
	'ethena-pay': ['parent#ethena', '8804'],
	etherfi: ['parent#ether-fi', '6373'],
	exa: ['7378'],
	'gnosis-pay': ['7364'],
	hyperbeat: ['parent#hyperbeat'],
	karta: ['8180'],
	kast: ['7480'],
	kolo: ['8131'],
	kraken: ['8781'],
	metamask: ['7363'],
	mexc: ['3075'],
	'nexo-card': ['7522'],
	'phantom-cash': ['parent#phantom'],
	'plasma-one': ['7789'],
	redotpay: ['7519'],
	revolut: ['8782'],
	'robinhood-gold': ['3732'],
	safepal: ['8104'],
	solayer: ['parent#solayer', '7375'],
	tria: ['parent#tria', '7362'],
	tuyo: ['8179'],
	vaultleap: ['8783'],
	'wirex-one': ['8784']
}

/** Runs at metadata-build time so every protocol and exchange page can offer the Card Details
 *  tab from its own metadata. */
export function stampCryptoCardIssuers(protocols: Record<string, IProtocolMetadata>): void {
	for (const [issuer, [hostId, ...childIds]] of Object.entries(CRYPTO_CARD_ISSUER_PROTOCOL_IDS)) {
		const host = protocols[hostId]
		if (!host) continue
		host.cryptoCardIssuer = issuer
		const hostSlug = slug(host.displayName || host.name)
		for (const childId of childIds) {
			const child = protocols[childId]
			if (child) child.cryptoCardRedirectSlug = hostSlug
		}
	}
}

/** The card page of each mapped issuer whose host protocol exists. Exchanges keep their card
 *  page under /cex, beside the exchange's other tabs. */
export function getCryptoCardDetailsHrefs(protocols: Record<string, IProtocolMetadata>): Record<string, string> {
	const hrefs: Record<string, string> = {}
	for (const [issuer, [hostId]] of Object.entries(CRYPTO_CARD_ISSUER_PROTOCOL_IDS)) {
		const host = protocols[hostId]
		if (!host) continue
		hrefs[issuer] = host.cex
			? `/cex/card-details/${slug(host.name)}`
			: `/protocol/card-details/${slug(host.displayName || host.name)}`
	}
	return hrefs
}
