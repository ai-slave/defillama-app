import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import type { CryptoCardDetailsPageProps } from '../CardDetails'
import { fetchCardDetailFromNetwork, fetchCardsIndexFromNetwork } from './upstream'

/** Page data for a protocol or exchange that hosts a card issuer's page. Null when the issuer
 *  has no cards in the current dataset. */
export async function getCryptoCardDetailsPageProps({
	issuer,
	canonicalSlug,
	metadata,
	isCEX
}: {
	issuer: string
	canonicalSlug: string
	metadata: IProtocolMetadata
	isCEX: boolean
}): Promise<CryptoCardDetailsPageProps | null> {
	const [cardsIndex, protocolData] = await Promise.all([
		fetchCardsIndexFromNetwork(),
		fetchProtocolOverviewMetrics(canonicalSlug)
	])
	const issuerCards = cardsIndex.cards.filter((card) => (card.parent_id ?? card.id) === issuer)
	if (issuerCards.length === 0) return null

	const details = await Promise.all(issuerCards.map((card) => fetchCardDetailFromNetwork(card.id)))
	// The publisher replaces detail files before the index, so a refresh can pair old terms with
	// new disclosures. Failing keeps the last good page cached, and Next does not cache the error.
	for (const detail of details) {
		if (detail.version !== cardsIndex.version) {
			throw new Error(`Crypto card ${detail.id} is at dataset ${detail.version}, index is at ${cardsIndex.version}`)
		}
	}
	return {
		name: protocolData.name,
		isCEX,
		category: protocolData.category ?? null,
		otherProtocols: protocolData.otherProtocols ?? [],
		metrics: getProtocolMetricFlags({ protocolData, metadata }),
		warningBanners: getProtocolWarningBanners(protocolData),
		cards: issuerCards.map((card, index) => ({ card, detail: details[index]! })),
		countries: cardsIndex.countries
	}
}
