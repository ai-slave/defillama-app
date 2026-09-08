import type { NextConfig } from 'next'
import { getStaticGenerationConfig } from './scripts/command/buildConfig'
import { resolveBuildCommitSha } from './scripts/command/buildIdentity'
import { getDatasetSnapshotTraceIncludes } from './src/server/datasetSnapshots/traceIncludes'
import { legacyRedirects } from './src/server/routeRegistry/legacyRedirects'

function resolveBuildId(): string | null {
	return resolveBuildCommitSha({ env: process.env, projectDir: process.cwd() }) || null
}

const nextConfig: NextConfig = {
	// Standalone output is for the Docker image. Vercel's adapter traces functions itself, and with
	// Turbopack the standalone writer needs a next-server trace that the adapter path never emits.
	output: process.env.VERCEL ? undefined : 'standalone',
	// Stop `next dev` (16.3+) from injecting its agent-rules block into AGENTS.md.
	agentRules: false,
	generateBuildId: resolveBuildId,
	outputFileTracingIncludes: {
		'/*': ['./.cache/app-metadata/**/*'],
		...getDatasetSnapshotTraceIncludes(),
		'/api/private/pro-dashboard/sql-run': [
			'./node_modules/@duckdb/node-api/**',
			'./node_modules/@duckdb/node-bindings/**',
			'./node_modules/@duckdb/node-bindings-*/**'
		]
	},
	experimental: { ...getStaticGenerationConfig(process.env.VERCEL), proxyPrefetch: 'strict' },
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
