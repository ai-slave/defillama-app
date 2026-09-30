import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { METADATA_ARTIFACT_FILES, type CoreMetadataPayload } from '../../../src/utils/metadata/artifactContract'
import { loadMetadataArtifactsFromDisk } from '../../../src/utils/metadata/artifacts'
import { readMetadataArtifactManifest, writeMetadataArtifacts } from '../../../src/utils/metadata/artifactWriter'
import { getMetadataCacheDir } from '../../../src/utils/metadata/config'
import { METADATA_MANIFEST_FILE, createMetadataArtifactManifest } from '../../../src/utils/metadata/manifest'
import { EMPTY_TOKEN_FILTER_METADATA } from '../../../src/utils/metadata/tokenFilters'
import { runPullMetadataCommand } from '../pullCommand'

const tempDirs: Array<string> = []

const tokenEntry = {
	symbol: 'AAVE',
	current_price: null,
	price_change_24h: null,
	price_change_percentage_24h: null,
	ath: null,
	ath_date: null,
	atl: null,
	atl_date: null,
	market_cap: null,
	fully_diluted_valuation: null,
	total_volume: null,
	total_supply: null,
	circulating_supply: null,
	max_supply: null
}

function createPayload(): CoreMetadataPayload {
	return {
		protocols: { 'parent#aave': { name: 'aave', displayName: 'Aave', tvl: true } },
		chains: { Ethereum: { name: 'Ethereum', id: 'ethereum' } },
		categoriesAndTags: { categories: [], tags: [], tagCategoryMap: {}, configs: {} },
		cexs: [],
		rwaList: { canonicalMarketIds: [], platforms: [], chains: [], categories: [], assetGroups: [], idMap: {} },
		rwaPlatformsIndex: { generatedAt: 0, byPid: {}, platforms: {} },
		rwaPerpsList: { contracts: [], venues: [], categories: [], assets: [], assetGroups: [], total: 0 },
		tokenlist: { aave: tokenEntry },
		tokenDirectory: {},
		protocolDisplayNames: { aave: 'Aave' },
		chainDisplayNames: { ethereum: 'Ethereum' },
		chainCategories: ['EVM'],
		liquidationsTokenSymbols: [],
		emissionsProtocolsList: [],
		emissionsSupplyMetrics: {},
		emissionsHistoricalPrices: {},
		cgExchangeIdentifiers: [],
		bridgeProtocolSlugs: [],
		bridgeChainSlugs: [],
		bridgeChainSlugToName: {},
		narrativeCategories: { ids: [], nameById: {} },
		oracleRoutes: { oracleNameBySlug: {}, chainNameBySlug: {}, chainSlugsByOracleSlug: {} },
		digitalAssetTreasuryRoutes: { assetSlugs: [], companySlugs: [] },
		stablecoinPeggedAssetSlugs: [],
		equitiesCompanyRoutes: [],
		preIpoCompanyIds: [],
		tokenFilterMetadata: EMPTY_TOKEN_FILTER_METADATA
	}
}

async function createRepoRoot(): Promise<string> {
	const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'metadata-command-test-'))
	tempDirs.push(repoRoot)
	await fs.mkdir(path.join(repoRoot, 'public'), { recursive: true })
	await fs.writeFile(path.join(repoRoot, 'public', 'pages.json'), JSON.stringify({ Metrics: [], Tools: [] }))
	return repoRoot
}

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { recursive: true, force: true })))
})

describe('pull metadata command', () => {
	test('skips pulls when the metadata manifest is fresh', async () => {
		const repoRoot = await createRepoRoot()
		const cacheDir = getMetadataCacheDir(repoRoot)
		await writeMetadataArtifacts(cacheDir, createPayload(), 'ready', 1000)
		const fetchMetadata = vi.fn()

		const result = await runPullMetadataCommand({
			env: { NODE_ENV: 'production' } as NodeJS.ProcessEnv,
			fetchMetadata,
			logger: { log: vi.fn() },
			now: 1100,
			repoRoot
		})

		expect(result.exitCode).toBe(0)
		expect(fetchMetadata).not.toHaveBeenCalled()
	})

	test('pulls again when a fresh ready manifest has missing artifacts', async () => {
		const repoRoot = await createRepoRoot()
		const cacheDir = getMetadataCacheDir(repoRoot)
		await writeMetadataArtifacts(cacheDir, createPayload(), 'ready', 1000)
		await fs.rm(path.join(cacheDir, METADATA_ARTIFACT_FILES.cexs))
		const fetchMetadata = vi.fn().mockResolvedValue(createPayload())

		const result = await runPullMetadataCommand({
			env: { NODE_ENV: 'production' } as NodeJS.ProcessEnv,
			fetchMetadata,
			logger: { log: vi.fn() },
			now: 1100,
			repoRoot
		})

		expect(result.exitCode).toBe(0)
		expect(fetchMetadata).toHaveBeenCalledTimes(1)
		expect(JSON.parse(await fs.readFile(path.join(cacheDir, METADATA_ARTIFACT_FILES.cexs), 'utf8'))).toEqual([])
	})

	test('pulls stale or missing metadata and writes ready artifacts', async () => {
		const repoRoot = await createRepoRoot()
		const result = await runPullMetadataCommand({
			env: { NODE_ENV: 'production' } as NodeJS.ProcessEnv,
			fetchMetadata: vi.fn().mockResolvedValue(createPayload()),
			logger: { log: vi.fn() },
			now: 2000,
			repoRoot
		})

		const cacheDir = getMetadataCacheDir(repoRoot)
		expect(result.exitCode).toBe(0)
		expect((await readMetadataArtifactManifest(cacheDir))?.status).toBe('ready')
		expect(JSON.parse(await fs.readFile(path.join(cacheDir, METADATA_ARTIFACT_FILES.tokenlist), 'utf8'))).toEqual({
			aave: tokenEntry
		})
	})

	test('provides ready card metadata to a stale artifact pull', async () => {
		const repoRoot = await createRepoRoot()
		const cacheDir = getMetadataCacheDir(repoRoot)
		const previous = createPayload()
		previous.protocols['7480'] = { name: 'kast-card', displayName: 'Kast Card', cryptoCardIssuer: 'kast' }
		await writeMetadataArtifacts(cacheDir, previous, 'ready', 1000)

		const result = await runPullMetadataCommand({
			env: { NODE_ENV: 'production' } as NodeJS.ProcessEnv,
			fetchMetadata: async (previousProtocolMetadata) => {
				const next = createPayload()
				next.protocols['7480'] = {
					name: 'kast-card',
					displayName: 'Kast Card',
					cryptoCardIssuer: previousProtocolMetadata?.['7480']?.cryptoCardIssuer
				}
				return next
			},
			logger: { log: vi.fn() },
			now: 1000 + 60 * 60 * 1000,
			repoRoot
		})

		expect(result.exitCode).toBe(0)
		expect(loadMetadataArtifactsFromDisk(cacheDir).payload.protocols['7480'].cryptoCardIssuer).toBe('kast')
	})

	test('treats old-version manifests as invalid and publishes a fresh ready cache', async () => {
		const repoRoot = await createRepoRoot()
		const cacheDir = getMetadataCacheDir(repoRoot)
		await writeMetadataArtifacts(cacheDir, createPayload(), 'ready', 1000)
		await fs.writeFile(
			path.join(cacheDir, METADATA_MANIFEST_FILE),
			JSON.stringify({
				...createMetadataArtifactManifest('ready', 1000),
				artifactVersion: 1
			})
		)
		const fetchMetadata = vi.fn().mockResolvedValue(createPayload())

		const result = await runPullMetadataCommand({
			env: { NODE_ENV: 'production' } as NodeJS.ProcessEnv,
			fetchMetadata,
			logger: { log: vi.fn() },
			now: 2000,
			repoRoot
		})

		expect(result.exitCode).toBe(0)
		expect(fetchMetadata).toHaveBeenCalledTimes(1)
		expect((await readMetadataArtifactManifest(cacheDir))?.pulledAt).toBe(2000)
	})

	test('pulls metadata in local development with a direct URL and no API key', async () => {
		const repoRoot = await createRepoRoot()
		const fetchMetadata = vi.fn().mockResolvedValue(createPayload())

		const result = await runPullMetadataCommand({
			env: { API_KEY: '', NODE_ENV: 'development', SERVER_URL: 'https://core.example.com' },
			fetchMetadata,
			logger: { log: vi.fn() },
			now: 3000,
			repoRoot
		})

		expect(result.exitCode).toBe(0)
		expect(fetchMetadata).toHaveBeenCalledTimes(1)
		expect((await readMetadataArtifactManifest(getMetadataCacheDir(repoRoot)))?.status).toBe('ready')
	})

	test('writes stubs and exits successfully for local development without an API key', async () => {
		const repoRoot = await createRepoRoot()
		const fetchMetadata = vi.fn()

		const result = await runPullMetadataCommand({
			env: { API_KEY: '', NODE_ENV: 'development' } as NodeJS.ProcessEnv,
			fetchMetadata,
			logger: { log: vi.fn() },
			now: 3000,
			repoRoot
		})

		const cacheDir = getMetadataCacheDir(repoRoot)
		expect(result.exitCode).toBe(0)
		expect(fetchMetadata).not.toHaveBeenCalled()
		expect((await readMetadataArtifactManifest(cacheDir))?.status).toBe('stub')
		expect(JSON.parse(await fs.readFile(path.join(cacheDir, METADATA_ARTIFACT_FILES.protocols), 'utf8'))).toEqual({})
	})

	test('keeps an existing ready manifest in local development without an API key', async () => {
		const repoRoot = await createRepoRoot()
		const cacheDir = getMetadataCacheDir(repoRoot)
		await writeMetadataArtifacts(cacheDir, createPayload(), 'ready', 3000)
		const fetchMetadata = vi.fn()

		const result = await runPullMetadataCommand({
			env: { API_KEY: '', NODE_ENV: 'development' } as NodeJS.ProcessEnv,
			fetchMetadata,
			logger: { log: vi.fn() },
			now: 4000,
			repoRoot
		})

		expect(result.exitCode).toBe(0)
		expect(fetchMetadata).not.toHaveBeenCalled()
		expect((await readMetadataArtifactManifest(cacheDir))?.status).toBe('ready')
	})

	test('exits non-zero after production CI pull failures', async () => {
		const repoRoot = await createRepoRoot()

		const result = await runPullMetadataCommand({
			env: { CI: 'true', NODE_ENV: 'production' } as NodeJS.ProcessEnv,
			fetchMetadata: vi.fn().mockRejectedValue(new Error('upstream failed')),
			logger: { log: vi.fn() },
			now: 4000,
			repoRoot
		})

		expect(result.exitCode).toBe(1)
		await expect(readMetadataArtifactManifest(getMetadataCacheDir(repoRoot))).resolves.toBeNull()
	})

	test('writes stubs and exits successfully after development pull failures', async () => {
		const repoRoot = await createRepoRoot()

		const result = await runPullMetadataCommand({
			env: { API_KEY: 'dev-key', NODE_ENV: 'development' } as NodeJS.ProcessEnv,
			fetchMetadata: vi.fn().mockRejectedValue(new Error('upstream failed')),
			logger: { log: vi.fn() },
			now: 4000,
			repoRoot
		})

		expect(result.exitCode).toBe(0)
		expect((await readMetadataArtifactManifest(getMetadataCacheDir(repoRoot)))?.status).toBe('stub')
	})

	test('leaves an existing ready artifact set intact after production pull failures', async () => {
		const repoRoot = await createRepoRoot()
		const cacheDir = getMetadataCacheDir(repoRoot)
		await fs.mkdir(cacheDir, { recursive: true })
		await fs.writeFile(
			path.join(cacheDir, METADATA_MANIFEST_FILE),
			JSON.stringify(createMetadataArtifactManifest('ready', 1000), null, 2)
		)
		await fs.writeFile(
			path.join(cacheDir, METADATA_ARTIFACT_FILES.protocols),
			JSON.stringify({ aave: { name: 'Aave' } })
		)

		const result = await runPullMetadataCommand({
			env: { NODE_ENV: 'production' } as NodeJS.ProcessEnv,
			fetchMetadata: vi.fn().mockRejectedValue(new Error('upstream failed')),
			logger: { log: vi.fn() },
			now: 400_000,
			repoRoot
		})

		expect(result.exitCode).toBe(1)
		expect((await readMetadataArtifactManifest(cacheDir))?.status).toBe('ready')
		expect(JSON.parse(await fs.readFile(path.join(cacheDir, METADATA_ARTIFACT_FILES.protocols), 'utf8'))).toEqual({
			aave: { name: 'Aave' }
		})
	})
})
