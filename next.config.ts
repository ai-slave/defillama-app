import type { NextConfig } from 'next'
import { getDatasetCacheTraceIncludes, type DatasetDomain } from './src/server/datasetCache/registry'
import { legacyRedirects } from './src/server/routeRegistry/legacyRedirects'

const datasetCacheIncludes = (...domains: DatasetDomain[]) => getDatasetCacheTraceIncludes(...domains)
const buildIdEnvKeys = [
	'SOURCE_COMMIT',
	'VERCEL_GIT_COMMIT_SHA',
	'NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA',
	'GITHUB_SHA'
] as const

function resolveBuildIdFromEnv(): string | null {
	for (const key of buildIdEnvKeys) {
		const value = process.env[key]?.trim()
		if (value) return value
	}
	return null
}

const nextConfig: NextConfig = {
	output: 'standalone',
	generateBuildId: resolveBuildIdFromEnv,
	outputFileTracingIncludes: {
		'/*': ['./.cache/app-metadata/**/*'],
		'/cex/*': datasetCacheIncludes('markets'),
		'/cex/markets/*': datasetCacheIncludes('markets'),
		'/token/*': datasetCacheIncludes(
			'markets',
			'liquidations',
			'raises',
			'treasuries',
			'yields',
			'liquidity',
			'token-rights',
			'risk'
		),
		'/tokens': datasetCacheIncludes('markets', 'token-rights'),
		'/token-rights': datasetCacheIncludes('token-rights'),
		'/protocol/token-rights/*': datasetCacheIncludes('token-rights'),
		'/protocol/yields/*': datasetCacheIncludes('yields'),
		'/yields/pool/*': datasetCacheIncludes('yields'),
		'/api/public/yields/borrow': datasetCacheIncludes('yields'),
		'/api/public/yields/borrow-advanced': datasetCacheIncludes('yields'),
		'/api/public/yields': datasetCacheIncludes('yields'),
		'/api/public/yields/pools': datasetCacheIncludes('yields'),
		'/api/public/yields/token-borrow-routes': datasetCacheIncludes('yields'),
		'/api/public/tokens': datasetCacheIncludes('markets', 'token-rights'),
		'/api/private/token-liquidations/*': datasetCacheIncludes('liquidations'),
		'/api/private/liquidations': datasetCacheIncludes('liquidations'),
		'/api/private/liquidations/*': datasetCacheIncludes('liquidations'),
		'/api/private/liquidations/*/*': datasetCacheIncludes('liquidations')
	},
	reactStrictMode: true,
	reactCompiler: true,
	// Increase timeout for static page generation (default is 60 seconds)
	staticPageGenerationTimeout: 300, // 5 minutes
	redirects() {
		return legacyRedirects
	},
	headers() {
		return [
			{
				source: '/.well-known/apple-app-site-association',
				headers: [{ key: 'Content-Type', value: 'application/json' }]
			},
			{
				source: '/.well-known/assetlinks.json',
				headers: [{ key: 'Content-Type', value: 'application/json' }]
			},
			{
				source: '/chart/:slug*', // Matches all /chart pages
				headers: [
					{
						key: 'X-Frame-Options',
						value: 'SAMEORIGIN'
					},
					{ key: 'Content-Security-Policy', value: 'frame-ancestors *' }
				]
			},
			{
				source: '/assets/llamaai/llamaai.mp4',
				headers: [
					{
						key: 'Accept-Ranges',
						value: 'bytes'
					},
					{
						key: 'Content-Type',
						value: 'video/mp4'
					},
					// Disable compression - video files are already compressed and compression breaks range requests
					{
						key: 'Content-Encoding',
						value: 'identity'
					}
				]
			}
		]
	},
	allowedDevOrigins: ['127.0.0.1']
}

export default nextConfig
