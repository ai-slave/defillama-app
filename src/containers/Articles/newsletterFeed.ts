export const RESEARCH_NEWSLETTER_ARCHIVE_URL = 'https://defillama-research.beehiiv.com/'

export type ResearchNewsletterItem = {
	id: string
	title: string
	description: string | null
	href: string
	imageUrl: string | null
	publishedAt: string | null
}
