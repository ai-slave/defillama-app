import type { ExchangePromotionModel } from './models'

interface ExchangePromotionLink {
	label: 'Campaign page' | 'Terms' | 'Source'
	href: string
}

export function promotionLinks(promotion: ExchangePromotionModel): ExchangePromotionLink[] {
	const links: ExchangePromotionLink[] = []
	if (promotion.url) links.push({ label: 'Campaign page', href: promotion.url })
	if (promotion.termsUrl && promotion.termsUrl !== promotion.url) {
		links.push({ label: 'Terms', href: promotion.termsUrl })
	}
	if (promotion.sourceUrl !== promotion.url && promotion.sourceUrl !== promotion.termsUrl) {
		links.push({ label: 'Source', href: promotion.sourceUrl })
	}
	return links
}

export function activePromotions(promotions: ExchangePromotionModel[], asOfDate: string): ExchangePromotionModel[] {
	return promotions
		.filter((promotion) => {
			if (promotion.startsAt && promotion.startsAt > asOfDate) return false
			if (promotion.endsAt && promotion.endsAt < asOfDate) return false
			return true
		})
		.sort((a, b) => {
			if (a.priority !== null && b.priority !== null) return b.priority - a.priority || a.label.localeCompare(b.label)
			if (a.priority !== null) return -1
			if (b.priority !== null) return 1
			return a.label.localeCompare(b.label)
		})
}

export function selectActivePromotion(
	promotions: ExchangePromotionModel[],
	asOfDate: string
): ExchangePromotionModel | null {
	return activePromotions(promotions, asOfDate)[0] ?? null
}
