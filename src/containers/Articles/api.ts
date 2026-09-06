import { FEATURES_SERVER } from '~/constants'
import type { EditorialTagOrderItem } from './editorialTagOrder'
import type {
	ArticleAuthorProfile,
	ArticlePublicAuthorProfile,
	ArticleCollaborator,
	ArticleDocument,
	ArticleEditorialTagMetadata,
	ArticleRevision,
	ArticleRevisionListResponse,
	ArticleSection,
	Banner,
	BannerLookupResult,
	BannerPayload,
	LocalArticleDocument,
	TrustedLogo,
	TrustedLogoPayload,
	SocialMention,
	SocialMentionPayload,
	TrustedByLookupResult,
	ResearchSponsorAdmin,
	ResearchSponsorArticleSearchResult,
	ResearchSponsorEntityType,
	ResearchSponsorLookupResult,
	ResearchSponsorPayload,
	ResearchSponsorSummary
} from './types'

type AuthorizedFetch = (url: string, options?: RequestInit) => Promise<Response | null>
type FetchLike = (url: string, options?: RequestInit) => Promise<Response>

export type ArticleApiValidationError = {
	field: string
	message: string
}

export class ArticleApiError extends Error {
	status: number
	validationErrors?: Array<ArticleApiValidationError>

	constructor(message: string, status: number, validationErrors?: Array<ArticleApiValidationError>) {
		super(message)
		this.name = 'ArticleApiError'
		this.status = status
		this.validationErrors = validationErrors
		Object.setPrototypeOf(this, ArticleApiError.prototype)
	}
}

export type ArticleListResponse = {
	items: Array<ArticleDocument>
	page: number
	perPage: number
	totalItems: number
	totalPages: number
}

export type ArticleAuthorResponse = {
	author: ArticlePublicAuthorProfile
	articles: Array<ArticleDocument>
}

export type ArticlePathItem = {
	slug: string
	section: ArticleSection
	updatedAt: string
}

export type ArticlePathsResponse = {
	items: Array<ArticlePathItem>
}

function articleUrl(path: string) {
	return `${FEATURES_SERVER.replace(/\/$/, '')}${path}`
}

/** Temporary CDN cache bust; remove when Cloudflare purge covers these routes. */
function articleUrlWithCacheNonce(path: string) {
	const url = articleUrl(path)
	const nonce = String(Date.now())
	return url.includes('?') ? `${url}&_n=${nonce}` : `${url}?_n=${nonce}`
}

function nullableText(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null
	const trimmed = value.trim()
	return trimmed === '' ? null : value
}

function buildSavePayload(article: LocalArticleDocument, options: { includeStatus?: boolean } = {}) {
	return {
		title: article.title,
		subtitle: nullableText(article.subtitle),
		slug: article.slug,
		...(options.includeStatus ? { status: article.status } : {}),
		seoTitle: nullableText(article.seoTitle),
		seoDescription: nullableText(article.seoDescription),
		excerpt: nullableText(article.excerpt),
		coverImage: article.coverImage ?? null,
		carouselImage: article.carouselImage ?? null,
		sponsorLogo: article.sponsorLogo ?? null,
		reportDescription: nullableText(article.reportDescription ?? null),
		reportPdf: article.reportPdf ?? null,
		contentJson: article.contentJson,
		tags: article.tags ?? [],
		section: article.section ?? null,
		displayDate: article.displayDate ?? null,
		goLiveAt: article.goLiveAt ?? null,
		brandByline: article.brandByline ?? false,
		featuredRank: typeof article.featuredRank === 'number' ? article.featuredRank : null,
		featuredUntil: article.featuredUntil ? article.featuredUntil : null,
		interviewees: article.interviewees ?? null,
		guestAuthors: article.guestAuthors ?? [],
		pageAssets: article.pageAssets ?? []
	}
}

async function parseResponse<T>(response: Response | null): Promise<T> {
	if (!response) throw new ArticleApiError('Please sign in to continue', 401)
	const text = await response.text()
	const data = text ? JSON.parse(text) : null
	if (!response.ok) {
		const message =
			data && typeof data === 'object' && typeof data.error === 'string'
				? data.error
				: response.statusText || 'Article request failed'
		const details = data && typeof data === 'object' ? data.details : null
		const validationErrors =
			details && typeof details === 'object' && Array.isArray(details.errors)
				? (details.errors as Array<ArticleApiValidationError>)
				: undefined
		throw new ArticleApiError(message, response.status, validationErrors)
	}
	return data as T
}

function appendSearchParam(params: URLSearchParams, key: string, value: string | number | undefined) {
	if (value === undefined || value === '') return
	params.set(key, String(value))
}

export async function listArticles(
	params: {
		page?: number
		limit?: number
		skip?: number
		query?: string
		tags?: Array<string>
		entityType?: string
		entitySlug?: string
		section?: ArticleSection
		sort?: 'featured' | 'newest' | 'displayDate'
	} = {},
	fetchFn: FetchLike = fetch
): Promise<ArticleListResponse> {
	const search = new URLSearchParams()
	appendSearchParam(search, 'page', params.page)
	appendSearchParam(search, 'limit', params.limit)
	appendSearchParam(search, 'skip', params.skip)
	appendSearchParam(search, 'query', params.query)
	appendSearchParam(search, 'tags', params.tags?.join(','))
	appendSearchParam(search, 'entityType', params.entityType)
	appendSearchParam(search, 'entitySlug', params.entitySlug)
	appendSearchParam(search, 'section', params.section)
	appendSearchParam(search, 'sort', params.sort)
	return parseResponse(await fetchFn(articleUrlWithCacheNonce(`/articles?${search}`)))
}

export type ArticleSectionListResponse = {
	sections: Array<{ section: ArticleSection; items: Array<ArticleDocument> }>
}

export type { EditorialTagOrderItem } from './editorialTagOrder'
export { applyEditorialTagOrderPayload, buildEditorialTagReorderPayload } from './editorialTagOrder'

export type ArticleByTagResponse = {
	items: Array<ArticleDocument>
}

export async function listArticleSections(
	perSection = 6,
	fetchFn: FetchLike = fetch
): Promise<ArticleSectionListResponse> {
	const search = new URLSearchParams()
	appendSearchParam(search, 'perSection', perSection)
	return parseResponse(await fetchFn(articleUrl(`/articles/sections?${search}`)))
}

export async function listArticlesByTag(
	tag: string,
	limit = 20,
	fetchFn: FetchLike = fetch
): Promise<ArticleByTagResponse> {
	const search = new URLSearchParams()
	appendSearchParam(search, 'limit', limit)
	return parseResponse(await fetchFn(articleUrlWithCacheNonce(`/articles/by-tag/${encodeURIComponent(tag)}?${search}`)))
}

export async function listArticlesByTopic(
	topic: string,
	params: Omit<NonNullable<Parameters<typeof listArticles>[0]>, 'tags'> = {},
	fetchFn: FetchLike = fetch
): Promise<ArticleListResponse> {
	return listArticles({ ...params, tags: [topic] }, fetchFn)
}

export type ResearchLandingBuckets = {
	heroReports: Array<ArticleDocument>
	latest: Array<ArticleDocument>
	spotlight: Array<ArticleDocument>
	interviews: Array<ArticleDocument>
	highlight: Array<ArticleDocument>
	insights: Array<ArticleDocument>
	moreReportsCandidates: Array<ArticleDocument>
	spotlightColumnCandidates: Array<ArticleDocument>
	collectionsCandidates: Array<ArticleDocument>
}

export async function getResearchLanding(
	limits: {
		hero: number
		latest: number
		spotlight: number
		interviews: number
		highlight: number
		insights: number
		reportsCandidates: number
		spotlightCandidates: number
		collectionsCandidates: number
	},
	fetchFn: FetchLike = fetch
): Promise<ResearchLandingBuckets> {
	const search = new URLSearchParams()
	for (const [key, value] of Object.entries(limits)) {
		appendSearchParam(search, key, value)
	}
	return parseResponse(await fetchFn(articleUrlWithCacheNonce(`/articles/landing?${search}`)))
}

export async function listArticlePaths(fetchFn: FetchLike = fetch): Promise<ArticlePathsResponse> {
	return parseResponse(await fetchFn(articleUrl('/articles/paths')))
}

export async function revalidateResearchLanding(authorizedFetch: AuthorizedFetch): Promise<void> {
	await parseResponse(
		await authorizedFetch(`/api/private/research/revalidate-landing?_n=${Date.now()}`, {
			method: 'GET'
		})
	)
}

export async function setEditorialTag(
	articleId: string,
	tag: string,
	authorizedFetch: AuthorizedFetch,
	options?: { order?: number }
): Promise<{ articleId: string; tag: string; order: number }> {
	const hasOrder = options?.order !== undefined
	return parseResponse(
		await authorizedFetch(
			articleUrl(`/articles/${encodeURIComponent(articleId)}/editorial-tags/${encodeURIComponent(tag)}`),
			hasOrder
				? {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ order: options.order })
					}
				: { method: 'POST' }
		)
	)
}

export async function reorderEditorialTag(
	tag: string,
	items: Array<EditorialTagOrderItem>,
	authorizedFetch: AuthorizedFetch
): Promise<{ tag: string; items: Array<EditorialTagOrderItem> }> {
	return parseResponse(
		await authorizedFetch(articleUrl(`/articles/editorial-tags/${encodeURIComponent(tag)}/order`), {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ items })
		})
	)
}

export async function updateEditorialTagMetadata(
	articleId: string,
	tag: string,
	metadata: ArticleEditorialTagMetadata,
	authorizedFetch: AuthorizedFetch
): Promise<{ articleId: string; tag: string; metadata: ArticleEditorialTagMetadata }> {
	return parseResponse(
		await authorizedFetch(
			articleUrl(`/articles/${encodeURIComponent(articleId)}/editorial-tags/${encodeURIComponent(tag)}`),
			{
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ metadata })
			}
		)
	)
}

export async function unsetEditorialTag(
	articleId: string,
	tag: string,
	authorizedFetch: AuthorizedFetch
): Promise<{ articleId: string; tag: string }> {
	return parseResponse(
		await authorizedFetch(
			articleUrl(`/articles/${encodeURIComponent(articleId)}/editorial-tags/${encodeURIComponent(tag)}`),
			{ method: 'DELETE' }
		)
	)
}

export async function getArticleBySlug(slug: string, fetchFn: FetchLike = fetch): Promise<ArticleDocument | null> {
	const response = await fetchFn(articleUrlWithCacheNonce(`/articles/${encodeURIComponent(slug)}`))
	if (response.status === 404) return null
	const data = await parseResponse<{ article: ArticleDocument }>(response)
	return data.article
}

export async function getAuthorBySlug(slug: string, fetchFn: FetchLike = fetch): Promise<ArticleAuthorResponse | null> {
	const response = await fetchFn(articleUrl(`/article-authors/${encodeURIComponent(slug)}`))
	if (response.status === 404) return null
	return parseResponse<ArticleAuthorResponse>(response)
}

export async function getOwnedArticle(id: string, authorizedFetch: AuthorizedFetch): Promise<ArticleDocument> {
	const data = await parseResponse<{ article: ArticleDocument }>(
		await authorizedFetch(articleUrl(`/articles/${encodeURIComponent(id)}/edit`))
	)
	return data.article
}

export async function createArticle(
	article: LocalArticleDocument,
	authorizedFetch: AuthorizedFetch
): Promise<ArticleDocument> {
	const data = await parseResponse<{ article: ArticleDocument }>(
		await authorizedFetch(articleUrl('/articles'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(buildSavePayload(article, { includeStatus: true }))
		})
	)
	return data.article
}

export async function updateArticle(
	id: string,
	article: LocalArticleDocument,
	authorizedFetch: AuthorizedFetch
): Promise<ArticleDocument> {
	const data = await parseResponse<{ article: ArticleDocument }>(
		await authorizedFetch(articleUrl(`/articles/${encodeURIComponent(id)}`), {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(buildSavePayload(article))
		})
	)
	return data.article
}

export type ReportFieldsPatch = {
	reportPdf?: LocalArticleDocument['reportPdf']
	carouselImage?: LocalArticleDocument['carouselImage']
	sponsorLogo?: LocalArticleDocument['sponsorLogo']
	reportDescription?: string | null
}

export async function updateArticleReportFields(
	id: string,
	patch: ReportFieldsPatch,
	authorizedFetch: AuthorizedFetch
): Promise<ArticleDocument> {
	const data = await parseResponse<{ article: ArticleDocument }>(
		await authorizedFetch(articleUrl(`/articles/${encodeURIComponent(id)}`), {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(patch)
		})
	)
	return data.article
}

export async function updateReportHighlightSponsorLogo(
	id: string,
	sponsorLogo: LocalArticleDocument['sponsorLogo'],
	authorizedFetch: AuthorizedFetch
): Promise<ArticleDocument> {
	const data = await parseResponse<{ article: ArticleDocument }>(
		await authorizedFetch(articleUrl(`/articles/${encodeURIComponent(id)}/report-highlight/sponsor-logo`), {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sponsorLogo })
		})
	)
	return data.article
}

export type PublishArticleOptions = {
	goLiveAt?: string | null
}

export async function publishArticle(
	id: string,
	authorizedFetch: AuthorizedFetch,
	options: PublishArticleOptions = {}
): Promise<ArticleDocument> {
	const body: { goLiveAt?: string | null } = {}
	if ('goLiveAt' in options) {
		body.goLiveAt = options.goLiveAt
	}
	const data = await parseResponse<{ article: ArticleDocument }>(
		await authorizedFetch(`/api/private/research/articles/${encodeURIComponent(id)}/publish`, {
			body: JSON.stringify(body),
			headers: { 'Content-Type': 'application/json' },
			method: 'POST'
		})
	)
	return data.article
}

export async function unpublishArticle(id: string, authorizedFetch: AuthorizedFetch): Promise<ArticleDocument> {
	const data = await parseResponse<{ article: ArticleDocument }>(
		await authorizedFetch(`/api/private/research/articles/${encodeURIComponent(id)}/unpublish`, { method: 'POST' })
	)
	return data.article
}

export async function discardPendingEdits(id: string, authorizedFetch: AuthorizedFetch): Promise<ArticleDocument> {
	const data = await parseResponse<{ article: ArticleDocument }>(
		await authorizedFetch(articleUrl(`/articles/${encodeURIComponent(id)}/discard-pending`), {
			method: 'POST'
		})
	)
	return data.article
}

export async function listArticleRevisions(
	id: string,
	params: { limit?: number; cursor?: string } = {},
	authorizedFetch: AuthorizedFetch
): Promise<ArticleRevisionListResponse> {
	const search = new URLSearchParams()
	appendSearchParam(search, 'limit', params.limit)
	appendSearchParam(search, 'cursor', params.cursor)
	const suffix = search.toString() ? `?${search.toString()}` : ''
	return parseResponse<ArticleRevisionListResponse>(
		await authorizedFetch(articleUrl(`/articles/${encodeURIComponent(id)}/revisions${suffix}`))
	)
}

export async function getArticleRevision(
	articleId: string,
	revisionId: string,
	authorizedFetch: AuthorizedFetch
): Promise<ArticleRevision> {
	const data = await parseResponse<{ revision: ArticleRevision }>(
		await authorizedFetch(
			articleUrl(`/articles/${encodeURIComponent(articleId)}/revisions/${encodeURIComponent(revisionId)}`)
		)
	)
	return data.revision
}

export async function restoreArticleRevisionToPending(
	articleId: string,
	revisionId: string,
	authorizedFetch: AuthorizedFetch
): Promise<ArticleDocument> {
	const data = await parseResponse<{ article: ArticleDocument }>(
		await authorizedFetch(
			articleUrl(
				`/articles/${encodeURIComponent(articleId)}/revisions/${encodeURIComponent(revisionId)}/restore-pending`
			),
			{ method: 'POST' }
		)
	)
	return data.article
}

export async function deleteArticleRevision(
	articleId: string,
	revisionId: string,
	authorizedFetch: AuthorizedFetch
): Promise<void> {
	await parseResponse(
		await authorizedFetch(
			articleUrl(`/articles/${encodeURIComponent(articleId)}/revisions/${encodeURIComponent(revisionId)}`),
			{ method: 'DELETE' }
		)
	)
}

export async function listMyArticles(
	params: { page?: number; limit?: number } = {},
	authorizedFetch: AuthorizedFetch
): Promise<ArticleListResponse> {
	const search = new URLSearchParams()
	appendSearchParam(search, 'page', params.page)
	appendSearchParam(search, 'limit', params.limit)
	return parseResponse(await authorizedFetch(articleUrl(`/articles/mine?${search}`)))
}

export async function deleteArticle(id: string, authorizedFetch: AuthorizedFetch): Promise<void> {
	await parseResponse(await authorizedFetch(articleUrl(`/articles/${encodeURIComponent(id)}`), { method: 'DELETE' }))
}

export type AuthorProfileUpdate = {
	displayName?: string
	slug?: string
	bio?: string | null
	avatarUrl?: string | null
	socials?: Record<string, string>
}

export async function getMyAuthorProfile(authorizedFetch: AuthorizedFetch): Promise<ArticleAuthorProfile> {
	const data = await parseResponse<{ author: ArticleAuthorProfile }>(
		await authorizedFetch(articleUrl('/article-authors/me'))
	)
	return data.author
}

export async function updateMyAuthorProfile(
	payload: AuthorProfileUpdate,
	authorizedFetch: AuthorizedFetch
): Promise<ArticleAuthorProfile> {
	const data = await parseResponse<{ author: ArticleAuthorProfile }>(
		await authorizedFetch(articleUrl('/article-authors/me'), {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		})
	)
	return data.author
}

export async function listCollaborators(
	articleId: string,
	authorizedFetch: AuthorizedFetch
): Promise<Array<ArticleCollaborator>> {
	const data = await parseResponse<{ collaborators: Array<ArticleCollaborator> }>(
		await authorizedFetch(articleUrl(`/articles/${encodeURIComponent(articleId)}/collaborators`))
	)
	return data.collaborators
}

export async function addCollaborator(
	articleId: string,
	email: string,
	authorizedFetch: AuthorizedFetch
): Promise<ArticleCollaborator> {
	const data = await parseResponse<{ collaborator: ArticleCollaborator }>(
		await authorizedFetch(articleUrl(`/articles/${encodeURIComponent(articleId)}/collaborators`), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email })
		})
	)
	return data.collaborator
}

export async function removeCollaborator(
	articleId: string,
	pbUserId: string,
	authorizedFetch: AuthorizedFetch
): Promise<void> {
	await parseResponse(
		await authorizedFetch(
			articleUrl(`/articles/${encodeURIComponent(articleId)}/collaborators/${encodeURIComponent(pbUserId)}`),
			{ method: 'DELETE' }
		)
	)
}

export async function updateCollaborator(
	articleId: string,
	pbUserId: string,
	patch: { hidden: boolean },
	authorizedFetch: AuthorizedFetch
): Promise<ArticleCollaborator> {
	const data = await parseResponse<{ collaborator: ArticleCollaborator }>(
		await authorizedFetch(
			articleUrl(`/articles/${encodeURIComponent(articleId)}/collaborators/${encodeURIComponent(pbUserId)}`),
			{
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(patch)
			}
		)
	)
	return data.collaborator
}

export async function transferOwnership(
	articleId: string,
	target: { email?: string; pbUserId?: string },
	authorizedFetch: AuthorizedFetch
): Promise<ArticleDocument> {
	const data = await parseResponse<{ article: ArticleDocument }>(
		await authorizedFetch(articleUrl(`/articles/${encodeURIComponent(articleId)}/transfer-owner`), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(target)
		})
	)
	return data.article
}

export async function listBanners(authorizedFetch: AuthorizedFetch): Promise<Array<Banner>> {
	const data = await parseResponse<{ banners: Array<Banner> }>(await authorizedFetch(articleUrl('/banners')))
	return data.banners.map(normalizeBannerTargeting)
}

export async function getBanner(id: string, authorizedFetch: AuthorizedFetch): Promise<Banner> {
	const data = await parseResponse<{ banner: Banner }>(
		await authorizedFetch(articleUrl(`/banners/${encodeURIComponent(id)}`))
	)
	return normalizeBannerTargeting(data.banner)
}

export async function createBanner(payload: BannerPayload, authorizedFetch: AuthorizedFetch): Promise<Banner> {
	const data = await parseResponse<{ banner: Banner }>(
		await authorizedFetch(articleUrl('/banners'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		})
	)
	return normalizeBannerTargeting(data.banner)
}

export async function updateBanner(
	id: string,
	payload: Partial<BannerPayload>,
	authorizedFetch: AuthorizedFetch
): Promise<Banner> {
	const data = await parseResponse<{ banner: Banner }>(
		await authorizedFetch(articleUrl(`/banners/${encodeURIComponent(id)}`), {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		})
	)
	return normalizeBannerTargeting(data.banner)
}

export async function deleteBanner(id: string, authorizedFetch: AuthorizedFetch): Promise<void> {
	await parseResponse(
		await authorizedFetch(articleUrl(`/banners/${encodeURIComponent(id)}`), {
			method: 'DELETE'
		})
	)
}

const EMPTY_BANNER_LOOKUP: BannerLookupResult = {
	text: null,
	image: null,
	imageHorizontal: null,
	promo: null,
	imageSquare: null
}

function sanitizePublicBanner(banner: Banner | null): Banner | null {
	if (!banner) return null
	const { createdByPbUserId: _createdByPbUserId, ...publicBanner } = normalizeBannerTargeting(banner)
	return publicBanner
}

function normalizeBannerTargeting(banner: Banner): Banner {
	const targetCountries: Array<string> = []
	const seenCountries = new Set<string>()
	if (Array.isArray(banner.targetCountries)) {
		for (const value of banner.targetCountries) {
			if (typeof value !== 'string') continue
			const country = value.trim().toUpperCase()
			if (!/^[A-Z]{2}$/.test(country) || country === 'XX' || seenCountries.has(country)) continue
			seenCountries.add(country)
			targetCountries.push(country)
		}
	}
	return {
		...banner,
		targetCountries
	}
}

function sanitizePublicBannerLookup(data: BannerLookupResult | null): BannerLookupResult {
	if (!data) return EMPTY_BANNER_LOOKUP
	return {
		text: sanitizePublicBanner(data.text),
		image: sanitizePublicBanner(data.image),
		imageHorizontal: sanitizePublicBanner(data.imageHorizontal),
		promo: sanitizePublicBanner(data.promo),
		imageSquare: sanitizePublicBanner(data.imageSquare)
	}
}

export async function getLandingBanner(fetchFn: FetchLike = fetch): Promise<BannerLookupResult> {
	const data = await parseResponse<BannerLookupResult | null>(
		await fetchFn(articleUrlWithCacheNonce('/banners/lookup/landing'))
	)
	return sanitizePublicBannerLookup(data)
}

export async function getAllArticlesBanner(fetchFn: FetchLike = fetch): Promise<BannerLookupResult> {
	const data = await parseResponse<BannerLookupResult | null>(
		await fetchFn(articleUrlWithCacheNonce('/banners/lookup/all-articles'))
	)
	return sanitizePublicBannerLookup(data)
}

export async function getSectionBanner(
	section: ArticleSection,
	fetchFn: FetchLike = fetch
): Promise<BannerLookupResult> {
	const data = await parseResponse<BannerLookupResult | null>(
		await fetchFn(articleUrlWithCacheNonce(`/banners/lookup/section/${encodeURIComponent(section)}`))
	)
	return sanitizePublicBannerLookup(data)
}

export async function getArticleBanner(articleId: string, fetchFn: FetchLike = fetch): Promise<BannerLookupResult> {
	const data = await parseResponse<BannerLookupResult | null>(
		await fetchFn(articleUrlWithCacheNonce(`/banners/lookup/article/${encodeURIComponent(articleId)}`))
	)
	return sanitizePublicBannerLookup(data)
}

const EMPTY_TRUSTED_BY: TrustedByLookupResult = { logos: [], mentions: [] }

function withoutPublicCreatorId<T extends object>(record: T): T {
	const { createdByPbUserId: _createdByPbUserId, ...publicRecord } = record as T & {
		createdByPbUserId?: string
	}
	return publicRecord as T
}

export async function getTrustedBySection(fetchFn: FetchLike = fetch): Promise<TrustedByLookupResult> {
	const data = await parseResponse<TrustedByLookupResult | null>(
		await fetchFn(articleUrlWithCacheNonce('/research/trusted-by/lookup'))
	)
	if (!data) return EMPTY_TRUSTED_BY
	return {
		logos: data.logos.map(withoutPublicCreatorId),
		mentions: data.mentions.map(withoutPublicCreatorId)
	}
}

export async function listTrustedLogos(authorizedFetch: AuthorizedFetch): Promise<Array<TrustedLogo>> {
	const data = await parseResponse<{ logos: Array<TrustedLogo> }>(
		await authorizedFetch(articleUrl('/research/trusted-by/logos'))
	)
	return data.logos
}

export async function createTrustedLogo(
	payload: TrustedLogoPayload,
	authorizedFetch: AuthorizedFetch
): Promise<TrustedLogo> {
	const data = await parseResponse<{ logo: TrustedLogo }>(
		await authorizedFetch(articleUrl('/research/trusted-by/logos'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		})
	)
	return data.logo
}

export async function updateTrustedLogo(
	id: string,
	payload: TrustedLogoPayload,
	authorizedFetch: AuthorizedFetch
): Promise<TrustedLogo> {
	const data = await parseResponse<{ logo: TrustedLogo }>(
		await authorizedFetch(articleUrl(`/research/trusted-by/logos/${encodeURIComponent(id)}`), {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		})
	)
	return data.logo
}

export async function deleteTrustedLogo(id: string, authorizedFetch: AuthorizedFetch): Promise<void> {
	await parseResponse(
		await authorizedFetch(articleUrl(`/research/trusted-by/logos/${encodeURIComponent(id)}`), { method: 'DELETE' })
	)
}

export async function reorderTrustedLogos(
	ids: Array<string>,
	authorizedFetch: AuthorizedFetch
): Promise<Array<TrustedLogo>> {
	const data = await parseResponse<{ logos: Array<TrustedLogo> }>(
		await authorizedFetch(articleUrl('/research/trusted-by/logos/order'), {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids })
		})
	)
	return data.logos
}

export async function listSocialMentions(authorizedFetch: AuthorizedFetch): Promise<Array<SocialMention>> {
	const data = await parseResponse<{ mentions: Array<SocialMention> }>(
		await authorizedFetch(articleUrl('/research/trusted-by/mentions'))
	)
	return data.mentions
}

export async function createSocialMention(
	payload: SocialMentionPayload,
	authorizedFetch: AuthorizedFetch
): Promise<SocialMention> {
	const data = await parseResponse<{ mention: SocialMention }>(
		await authorizedFetch(articleUrl('/research/trusted-by/mentions'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		})
	)
	return data.mention
}

export async function updateSocialMention(
	id: string,
	payload: SocialMentionPayload,
	authorizedFetch: AuthorizedFetch
): Promise<SocialMention> {
	const data = await parseResponse<{ mention: SocialMention }>(
		await authorizedFetch(articleUrl(`/research/trusted-by/mentions/${encodeURIComponent(id)}`), {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		})
	)
	return data.mention
}

export async function deleteSocialMention(id: string, authorizedFetch: AuthorizedFetch): Promise<void> {
	await parseResponse(
		await authorizedFetch(articleUrl(`/research/trusted-by/mentions/${encodeURIComponent(id)}`), { method: 'DELETE' })
	)
}

export async function reorderSocialMentions(
	ids: Array<string>,
	authorizedFetch: AuthorizedFetch
): Promise<Array<SocialMention>> {
	const data = await parseResponse<{ mentions: Array<SocialMention> }>(
		await authorizedFetch(articleUrl('/research/trusted-by/mentions/order'), {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids })
		})
	)
	return data.mentions
}

export async function getSponsoredResearchReports(
	entityType: ResearchSponsorEntityType,
	entitySlug: string,
	options: { limit?: number; fetchFn?: FetchLike } = {}
): Promise<ResearchSponsorLookupResult> {
	const search = new URLSearchParams()
	appendSearchParam(search, 'limit', options.limit)
	const suffix = search.toString() ? `?${search}` : ''
	const path = `/research/sponsors/lookup/${encodeURIComponent(entityType)}/${encodeURIComponent(entitySlug)}${suffix}`
	return parseResponse(await (options.fetchFn ?? fetch)(articleUrlWithCacheNonce(path)))
}

export async function listResearchSponsors(authorizedFetch: AuthorizedFetch): Promise<Array<ResearchSponsorAdmin>> {
	const data = await parseResponse<{ sponsors: Array<ResearchSponsorAdmin> }>(
		await authorizedFetch(articleUrl('/research/sponsors'))
	)
	return data.sponsors
}

export async function searchResearchSponsorArticles(
	query: string,
	authorizedFetch: AuthorizedFetch,
	limit = 20
): Promise<Array<ResearchSponsorArticleSearchResult>> {
	const search = new URLSearchParams()
	appendSearchParam(search, 'q', query)
	appendSearchParam(search, 'limit', limit)
	const data = await parseResponse<{ articles: Array<ResearchSponsorArticleSearchResult> }>(
		await authorizedFetch(articleUrl(`/research/sponsors/articles?${search}`))
	)
	return data.articles
}

export async function createResearchSponsor(
	payload: ResearchSponsorPayload,
	authorizedFetch: AuthorizedFetch
): Promise<ResearchSponsorAdmin> {
	const data = await parseResponse<{ sponsor: ResearchSponsorAdmin }>(
		await authorizedFetch(articleUrl('/research/sponsors'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		})
	)
	return data.sponsor
}

export async function updateResearchSponsor(
	id: string,
	payload: Partial<ResearchSponsorPayload>,
	authorizedFetch: AuthorizedFetch
): Promise<ResearchSponsorSummary> {
	const data = await parseResponse<{ sponsor: ResearchSponsorSummary }>(
		await authorizedFetch(articleUrl(`/research/sponsors/${encodeURIComponent(id)}`), {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		})
	)
	return data.sponsor
}

export async function deleteResearchSponsor(id: string, authorizedFetch: AuthorizedFetch): Promise<void> {
	await parseResponse(
		await authorizedFetch(articleUrl(`/research/sponsors/${encodeURIComponent(id)}`), { method: 'DELETE' })
	)
}

export async function linkResearchSponsorReport(
	sponsorId: string,
	articleId: string,
	authorizedFetch: AuthorizedFetch
): Promise<void> {
	await parseResponse(
		await authorizedFetch(
			articleUrl(`/research/sponsors/${encodeURIComponent(sponsorId)}/reports/${encodeURIComponent(articleId)}`),
			{ method: 'PUT' }
		)
	)
}

export async function unlinkResearchSponsorReport(
	sponsorId: string,
	articleId: string,
	authorizedFetch: AuthorizedFetch
): Promise<void> {
	await parseResponse(
		await authorizedFetch(
			articleUrl(`/research/sponsors/${encodeURIComponent(sponsorId)}/reports/${encodeURIComponent(articleId)}`),
			{ method: 'DELETE' }
		)
	)
}
