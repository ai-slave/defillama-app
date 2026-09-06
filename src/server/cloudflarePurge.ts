import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type FetchLike = typeof fetch

type PurgeCloudflareOptions = {
	env?: NodeJS.ProcessEnv
	fetchImpl?: FetchLike
	logger?: Pick<Console, 'log'>
	buildId?: string | null
}

let cachedNextBuildId: string | null | undefined

function resolveNextBuildId(env: NodeJS.ProcessEnv): string | null {
	if (env.NEXT_BUILD_ID) return env.NEXT_BUILD_ID
	if (cachedNextBuildId !== undefined) return cachedNextBuildId
	try {
		cachedNextBuildId = readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim() || null
	} catch {
		cachedNextBuildId = null
	}
	return cachedNextBuildId
}

export type CloudflarePurgeResult =
	| { reason: string; status: 'skipped' }
	| { status: 'purged'; urls: Array<string> }
	| { reason: string; status: 'failed' }

function siteUrlFromEnv(env: NodeJS.ProcessEnv): string {
	return env.NEXT_PUBLIC_SITE_URL || env.SITE_URL || 'https://defillama.com'
}

export function normalizeResearchCachePath(value: unknown): string | null {
	if (typeof value !== 'string') return null
	const trimmed = value.trim()
	if (!trimmed || trimmed.startsWith('//') || trimmed.includes('://')) return null
	const path = trimmed.split('#')[0]?.split('?')[0] ?? ''
	if (path !== '/research' && !path.startsWith('/research/')) return null
	return path
}

export function normalizeResearchCachePaths(values: unknown): Array<string> {
	const input = Array.isArray(values) ? values : []
	const paths = new Set<string>()
	for (const value of input) {
		const path = normalizeResearchCachePath(value)
		if (path) paths.add(path)
	}
	return Array.from(paths).slice(0, 50)
}

export function researchPathsToUrls(paths: Array<string>, env: NodeJS.ProcessEnv = process.env): Array<string> {
	const siteUrl = siteUrlFromEnv(env)
	const urls = new Set<string>()
	for (const path of paths) {
		urls.add(new URL(path, siteUrl).toString())
	}
	return Array.from(urls)
}

export type DashboardPurgeKeys = {
	id: string
	slug?: string | null
	previousSlug?: string | null
}

export function dashboardPathsToUrls(
	keys: DashboardPurgeKeys,
	env: NodeJS.ProcessEnv = process.env,
	buildId: string | null = null
): Array<string> {
	const siteUrl = siteUrlFromEnv(env)
	const distinctKeys = new Set([keys.id, keys.slug, keys.previousSlug].filter((key): key is string => !!key))
	const urls = new Set<string>()
	for (const key of distinctKeys) {
		urls.add(new URL(`/pro/${key}`, siteUrl).toString())
		urls.add(new URL(`/api/dynamic/pro-dashboard/${key}/stream`, siteUrl).toString())
		if (buildId) {
			urls.add(new URL(`/_next/data/${buildId}/pro/${key}.json`, siteUrl).toString())
		}
	}
	return Array.from(urls)
}

async function purgeCloudflareUrls(
	urls: Array<string>,
	label: string,
	{ env = process.env, fetchImpl = fetch, logger = console }: PurgeCloudflareOptions = {}
): Promise<CloudflarePurgeResult> {
	if (!env.CF_ZONE || !env.CF_PURGE_CACHE_AUTH) {
		logger.log(`CF_ZONE or CF_PURGE_CACHE_AUTH is not set, skipping ${label} cache purge`)
		return { reason: 'missing Cloudflare env', status: 'skipped' }
	}

	if (urls.length === 0) {
		return { reason: 'no urls to purge', status: 'skipped' }
	}

	let response: Response
	try {
		response = await fetchImpl(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE}/purge_cache`, {
			body: JSON.stringify({ files: urls }),
			headers: {
				Authorization: `Bearer ${env.CF_PURGE_CACHE_AUTH}`,
				'Content-Type': 'application/json'
			},
			method: 'POST'
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		logger.log(`Cloudflare ${label} cache purge failed: ${message}`)
		return { reason: message, status: 'failed' }
	}

	if (!response.ok) {
		const body = await response.text()
		logger.log(`Cloudflare ${label} cache purge failed: ${body}`)
		return { reason: body, status: 'failed' }
	}

	return { status: 'purged', urls }
}

export async function purgeCloudflareResearchUrls(
	paths: Array<string>,
	{ env = process.env, fetchImpl = fetch, logger = console }: PurgeCloudflareOptions = {}
): Promise<CloudflarePurgeResult> {
	const urls = researchPathsToUrls(paths, env)
	return purgeCloudflareUrls(urls, 'research', { env, fetchImpl, logger })
}

export async function purgeCloudflareDashboardUrls(
	keys: DashboardPurgeKeys,
	options: PurgeCloudflareOptions = {}
): Promise<CloudflarePurgeResult> {
	const buildId = options.buildId !== undefined ? options.buildId : resolveNextBuildId(options.env ?? process.env)
	return purgeCloudflareUrls(dashboardPathsToUrls(keys, options.env, buildId), 'dashboard', options)
}
