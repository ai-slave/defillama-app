import type { NextApiRequest, NextApiResponse } from 'next'
import { FEATURES_SERVER } from '~/constants'
import type { ArticleDocument } from '~/containers/Articles/types'
import { ARTICLE_SECTION_SLUGS } from '~/containers/Articles/types'
import { normalizeResearchCachePaths } from '~/server/cloudflarePurge'
import { scheduleResearchCachePurge, type ScheduledResearchCacheUpdate } from '~/server/researchCacheInvalidation'
import { withApiRouteTelemetry } from '~/utils/telemetry'

type BackendArticleResponse = {
	article: ArticleDocument
}

type ResponseData = (BackendArticleResponse & { cache?: ScheduledResearchCacheUpdate }) | { error: string }

function articleUrl(path: string) {
	return `${FEATURES_SERVER.replace(/\/$/, '')}${path}`
}

function articleIdFromRequest(req: NextApiRequest): string | null {
	const { id } = req.query
	if (Array.isArray(id)) return id[0] || null
	return typeof id === 'string' && id ? id : null
}

function authorizationHeader(req: NextApiRequest): Record<string, string> {
	const header = req.headers.authorization
	if (Array.isArray(header)) {
		const first = header.find(Boolean)
		return first ? { Authorization: first } : {}
	}
	return header ? { Authorization: header } : {}
}

function articlePublicPath(article: Pick<ArticleDocument, 'section' | 'slug'> | null | undefined): string | null {
	if (!article || !article.section || !article.slug) return null
	const sectionSlug = ARTICLE_SECTION_SLUGS[article.section]
	return sectionSlug ? `/research/${sectionSlug}/${article.slug}` : null
}

function sectionPathForArticlePath(articlePath: string): string {
	return articlePath.split('/').slice(0, 3).join('/')
}

function unpublishPurgePaths(before: ArticleDocument | null): string[] {
	const beforePath = articlePublicPath(before)
	const purgePaths = new Set<string>()
	if (beforePath) {
		purgePaths.add('/research')
		purgePaths.add('/research/feed.xml')
		purgePaths.add(beforePath)
		const sectionPath = sectionPathForArticlePath(beforePath)
		if (sectionPath !== beforePath) {
			purgePaths.add(sectionPath)
		}
	}
	return normalizeResearchCachePaths(Array.from(purgePaths))
}

async function readJson<T>(response: Response): Promise<T | null> {
	const text = await response.text()
	return text ? (JSON.parse(text) as T) : null
}

function parseJsonObject(body: string): ResponseData | null {
	try {
		const payload = JSON.parse(body)
		return payload && typeof payload === 'object' ? (payload as ResponseData) : null
	} catch {
		return null
	}
}

async function sendBackendResponse(response: Response, res: NextApiResponse<ResponseData>) {
	const body = await response.text()
	if (body) {
		const payload = parseJsonObject(body)
		if (payload) return res.status(response.status).json(payload)
	}

	return res.status(response.status).json({ error: body || response.statusText || 'Article request failed' })
}

export async function researchUnpublishHandler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	res.setHeader('Cache-Control', 'private, no-store, max-age=0')

	if (req.method !== 'POST') {
		res.setHeader('Allow', ['POST'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const articleId = articleIdFromRequest(req)
	if (!articleId) {
		return res.status(400).json({ error: 'Article ID is required' })
	}

	const encodedArticleId = encodeURIComponent(articleId)
	const beforeResponse = await fetch(articleUrl(`/articles/${encodedArticleId}/edit`), {
		headers: authorizationHeader(req)
	})
	if (!beforeResponse.ok) {
		return sendBackendResponse(beforeResponse, res)
	}

	const before = (await readJson<BackendArticleResponse>(beforeResponse))?.article ?? null
	const purgePaths = unpublishPurgePaths(before)

	const unpublishResponse = await fetch(articleUrl(`/articles/${encodedArticleId}/unpublish`), {
		headers: authorizationHeader(req),
		method: 'POST'
	})
	if (!unpublishResponse.ok) {
		return sendBackendResponse(unpublishResponse, res)
	}

	const data = await readJson<BackendArticleResponse>(unpublishResponse)
	if (!data?.article) {
		return res.status(500).json({ error: 'Unpublish response did not include an article' })
	}

	const cache = scheduleResearchCachePurge(purgePaths)

	return res.status(unpublishResponse.status).json({ ...data, cache })
}

export default withApiRouteTelemetry('/api/private/research/articles/[id]/unpublish', researchUnpublishHandler)
