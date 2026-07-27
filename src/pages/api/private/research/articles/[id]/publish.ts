import type { NextApiRequest, NextApiResponse } from 'next'
import { FEATURES_SERVER } from '~/constants'
import type { ArticleDocument } from '~/containers/Articles/types'
import { ARTICLE_SECTION_SLUGS } from '~/containers/Articles/types'
import { normalizeResearchCachePaths } from '~/server/cloudflarePurge'
import { scheduleResearchCacheUpdate, type ScheduledResearchCacheUpdate } from '~/server/researchCacheInvalidation'
import { withApiRouteTelemetry } from '~/utils/telemetry'

type BackendArticleResponse = {
	article: ArticleDocument
}

type ResponseData = (BackendArticleResponse & { cache?: ScheduledResearchCacheUpdate }) | { error: string }

type ResearchInvalidationTargets = {
	purgePaths: string[]
	revalidatePaths: string[]
}

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

function articlePublicPath(
	article: Pick<ArticleDocument, 'section' | 'slug' | 'status'> | null | undefined
): string | null {
	if (!article || article.status !== 'published' || !article.section || !article.slug) return null
	const sectionSlug = ARTICLE_SECTION_SLUGS[article.section]
	return sectionSlug ? `/research/${sectionSlug}/${article.slug}` : null
}

function sectionPathForArticlePath(articlePath: string): string {
	return articlePath.split('/').slice(0, 3).join('/')
}

function publishInvalidationTargets(
	before: ArticleDocument | null,
	after: ArticleDocument
): ResearchInvalidationTargets {
	const beforePath = articlePublicPath(before)
	const afterPath = articlePublicPath(after)
	const purgePaths = new Set<string>()
	const nextPaths = new Set<string>()
	if (beforePath || afterPath) {
		purgePaths.add('/research')
		purgePaths.add('/research/feed.xml')
		nextPaths.add('/research')
	}
	for (const articlePath of [beforePath, afterPath]) {
		if (!articlePath) continue
		purgePaths.add(articlePath)
		const sectionPath = sectionPathForArticlePath(articlePath)
		if (sectionPath !== articlePath) {
			purgePaths.add(sectionPath)
			nextPaths.add(sectionPath)
		}
	}
	return {
		purgePaths: normalizeResearchCachePaths(Array.from(purgePaths)),
		revalidatePaths: normalizeResearchCachePaths(Array.from(nextPaths))
	}
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

function publishGoLiveAt(req: NextApiRequest): unknown {
	if (typeof req.body === 'string') {
		try {
			return (JSON.parse(req.body) as { goLiveAt?: unknown })?.goLiveAt
		} catch {
			return undefined
		}
	}
	return (req.body as { goLiveAt?: unknown } | null | undefined)?.goLiveAt
}

function publishRequestBody(req: NextApiRequest): string {
	const raw = publishGoLiveAt(req)
	if (raw === undefined) return JSON.stringify({})
	if (raw === null || raw === '' || raw === 'null') return JSON.stringify({ goLiveAt: null })
	return JSON.stringify({ goLiveAt: String(raw) })
}

export async function researchPublishHandler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
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
	const headers = {
		...authorizationHeader(req),
		'Content-Type': 'application/json'
	}
	const beforeResponse = await fetch(articleUrl(`/articles/${encodedArticleId}/edit`), {
		headers: authorizationHeader(req)
	})
	if (!beforeResponse.ok) {
		return sendBackendResponse(beforeResponse, res)
	}

	const before = (await readJson<BackendArticleResponse>(beforeResponse))?.article ?? null

	const publishBody = publishRequestBody(req)
	const publishResponse = await fetch(articleUrl(`/articles/${encodedArticleId}/publish`), {
		headers,
		method: 'POST',
		body: publishBody
	})
	if (!publishResponse.ok) {
		return sendBackendResponse(publishResponse, res)
	}

	const data = await readJson<BackendArticleResponse>(publishResponse)
	if (!data?.article) {
		return res.status(500).json({ error: 'Publish response did not include an article' })
	}

	const cache = scheduleResearchCacheUpdate(publishInvalidationTargets(before, data.article), (path) =>
		res.revalidate(path)
	)

	return res.status(publishResponse.status).json({ ...data, cache })
}

export default withApiRouteTelemetry('/api/private/research/articles/[id]/publish', researchPublishHandler)
