import { slug } from '~/utils'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import type { CardsIndexCard } from './api.types'

type CryptoCardProtocolReference = Pick<CardsIndexCard, 'id' | 'parent_id' | 'defillama_id' | 'defillama_parent_id'>

interface CryptoCardIssuerProtocolIds {
	hostId: string
	childIds: Set<string>
}

function getCryptoCardIssuerProtocolIds(
	cards: ReadonlyArray<CryptoCardProtocolReference | null | undefined> | null | undefined
): Map<string, CryptoCardIssuerProtocolIds> {
	const issuers = new Map<string, CryptoCardIssuerProtocolIds>()
	for (const card of cards ?? []) {
		if (!card) continue
		const issuer = card.parent_id || card.id
		const hostId = card.defillama_parent_id || card.defillama_id
		if (!issuer || !hostId) continue

		const existing = issuers.get(issuer)
		// Keep the first complete issuer mapping if an inconsistent upstream record slips through.
		if (existing && existing.hostId !== hostId) continue
		const protocolIds = existing ?? { hostId, childIds: new Set<string>() }
		if (card.defillama_id && card.defillama_id !== hostId) protocolIds.childIds.add(card.defillama_id)
		issuers.set(issuer, protocolIds)
	}
	return issuers
}

/** Runs at metadata-build time so every protocol and exchange page can offer the Card Details
 *  tab from its own metadata. */
export function stampCryptoCardIssuers(
	protocols: Record<string, IProtocolMetadata>,
	cards: ReadonlyArray<CryptoCardProtocolReference | null | undefined> | null | undefined
): void {
	for (const [issuer, { hostId, childIds }] of getCryptoCardIssuerProtocolIds(cards)) {
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

/** The card page of each API-declared issuer whose host protocol exists. Exchanges keep their
 *  card page under /cex, beside the exchange's other tabs. */
export function getCryptoCardDetailsHrefs(
	protocols: Record<string, IProtocolMetadata>,
	cards: ReadonlyArray<CryptoCardProtocolReference | null | undefined> | null | undefined
): Record<string, string> {
	const hrefs: Record<string, string> = {}
	for (const [issuer, { hostId }] of getCryptoCardIssuerProtocolIds(cards)) {
		const host = protocols[hostId]
		if (!host) continue
		hrefs[issuer] = host.cex
			? `/cex/card-details/${slug(host.name)}`
			: `/protocol/card-details/${slug(host.displayName || host.name)}`
	}
	return hrefs
}
