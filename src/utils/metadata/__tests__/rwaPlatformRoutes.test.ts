import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import { RWA_PERPS_SERVER_URL, RWA_SERVER_URL } from '~/constants'
import { getRWASitemapRoutes } from '~/containers/RWA/server/routes'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { hydrateMetadataCache } from '../artifactContract'
import { loadMetadataArtifactsFromDisk } from '../artifacts'
import { writeMetadataArtifacts } from '../artifactWriter'
import { fetchCoreMetadata } from '../fetch'
import { serveCoreMetadata } from './sourceFixture'

// These tests read page data; the page chrome has no role in the route contract.
vi.mock('~/layout', () => ({ default: () => null }))
vi.mock('~/containers/RWA', () => ({ RWAOverview: () => null }))

const http = installFixtureFetch()
const metadata = installMetadataSeeder()

describe('published RWA platform routes', () => {
	test('omits an inactive platform from the sitemap and switcher while retaining spot, AUM and perps platforms', async () => {
		serveCoreMetadata(http, {
			rwaList: {
				canonicalMarketIds: ['OUSG'],
				idMap: { OUSG: 'ousg' },
				// After the backend rollout, configured-only platforms are absent from this list.
				platforms: ['Ondo'],
				chains: [],
				categories: [],
				assetGroups: []
			},
			rwaPlatformsIndex: {
				generatedAt: 1,
				byPid: {},
				platforms: {
					ondo: { name: 'Ondo', slug: 'ondo', onchainAum: 0, activeAum: 0 },
					avantis: { name: 'Avantis', slug: 'avantis', onchainAum: 0, activeAum: 0 },
					sivo: { name: 'Sivo', slug: 'sivo', onchainAum: 0, activeAum: 12_500_000 },
					'trade-xyz': { name: 'trade[XYZ]', slug: 'trade-xyz', onchainAum: 0, activeAum: 0 }
				}
			},
			rwaPerpsList: {
				contracts: ['xyz:GOLD'],
				venues: ['trade[XYZ]'],
				categories: [],
				assets: [],
				assetGroups: [],
				total: 1
			}
		})
		http.serve({
			[`${RWA_SERVER_URL}/current?lite=true`]: [
				{
					id: 'ousg',
					canonicalMarketId: 'OUSG',
					ticker: 'OUSG',
					assetName: 'Ondo Short-Term US Government Treasuries',
					parentPlatform: 'Ondo',
					category: ['Treasuries'],
					onChainMcap: { Ethereum: 100 },
					activeMcap: { Ethereum: 90 },
					defiActiveTvl: {}
				}
			],
			[`${RWA_PERPS_SERVER_URL}/current`]: [],
			[`${RWA_SERVER_URL}/chart/platform/ondo/asset-breakdown`]: {
				onChainMcap: [],
				activeMcap: [],
				defiActiveTvl: []
			}
		})

		const cacheDir = await mkdtemp(join(tmpdir(), 'rwa-platform-routes-'))
		try {
			await writeMetadataArtifacts(cacheDir, await fetchCoreMetadata())
			const cache = hydrateMetadataCache(loadMetadataArtifactsFromDisk(cacheDir).payload)
			metadata.seed(cache)
			const page = await import('~/pages/rwa/platform/[platform]')

			expect(getRWASitemapRoutes(cache)).toEqual([
				'rwa/perps/forex',
				'rwa/asset/OUSG',
				'rwa/platform/ondo',
				'rwa/platform/sivo',
				'rwa/platform/trade-xyz',
				'rwa/perps/contract/xyz%3AGOLD',
				'rwa/perps/venue/trade-xyz'
			])
			await expect(page.getStaticProps({ params: { platform: 'ondo' } })).resolves.toMatchObject({
				props: {
					platformLinks: [
						{ label: 'All', to: '/rwa/platforms' },
						{ label: 'Ondo', to: '/rwa/platform/ondo' },
						{ label: 'Sivo', to: '/rwa/platform/sivo' },
						{ label: 'trade[XYZ]', to: '/rwa/platform/trade-xyz' }
					]
				}
			})
		} finally {
			await rm(cacheDir, { recursive: true, force: true })
		}
	})
})
