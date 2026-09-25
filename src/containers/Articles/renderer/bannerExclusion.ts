import type { Banner, BannerLookupResult } from '~/containers/Articles/types'

export function allArticlesBannerForArticle(
	banner: Banner | null,
	articleId: string | null | undefined
): Banner | null {
	if (!banner) return null
	if (articleId && banner.excludedArticleIds?.includes(articleId)) return null
	return banner
}

/** Article placements prefer the article's own banner, then its section's, then the all-articles banner unless this article is excluded. */
export function articleBannerCandidates(
	kind: 'text' | 'image',
	lookups: { article?: BannerLookupResult; section?: BannerLookupResult; allArticles?: BannerLookupResult },
	articleId: string | null | undefined
): Array<Banner | null> {
	return [
		lookups.article?.[kind] ?? null,
		lookups.section?.[kind] ?? null,
		allArticlesBannerForArticle(lookups.allArticles?.[kind] ?? null, articleId)
	]
}
