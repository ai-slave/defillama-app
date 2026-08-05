import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { RWAAssetPage } from '~/containers/RWA/Asset'
import { getRWAAssetData } from '~/containers/RWA/queries'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import type { IRWAList } from '~/utils/metadata/types'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect, safeDecodeURIComponent } from '~/utils/route'

type RWAAssetRoute = {
	assetId: string
	canonicalMarketId: string
}

function resolveRWAAssetRoute(assetParam: string, rwaList: IRWAList): RWAAssetRoute | null {
	const normalizedAssetParam = assetParam.toLowerCase()

	for (const canonicalMarketId of rwaList.canonicalMarketIds) {
		if (canonicalMarketId.toLowerCase() === normalizedAssetParam) {
			const assetId = getRWAAssetId(canonicalMarketId, rwaList.idMap)
			return assetId ? { assetId, canonicalMarketId } : null
		}
	}

	return null
}

function getRWAAssetId(canonicalMarketId: string, idMap: Record<string, string>): string | null {
	const exactAssetId = idMap[canonicalMarketId]
	if (exactAssetId) return exactAssetId

	const normalizedMarketId = canonicalMarketId.toLowerCase()
	for (const marketId in idMap) {
		if (marketId.toLowerCase() === normalizedMarketId) return idMap[marketId] ?? null
	}

	return null
}

export async function getStaticPaths() {
	// When this is true (in preview environments) don't
	// prerender any static pages
	// (faster builds, but slower initial page load)
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const rwaList = metadataCache.rwaList
	return {
		paths: rwaList.canonicalMarketIds
			.slice(0, 10)
			.map((canonicalMarketId) => ({ params: { asset: canonicalMarketId } })),
		fallback: 'blocking'
	}
}

export const getStaticProps = withPerformanceLogging(
	`rwa/asset/[asset]`,
	async ({ params }: GetStaticPropsContext<{ asset: string }>) => {
		if (!params?.asset) {
			return { notFound: true }
		}

		const assetParam = safeDecodeURIComponent(params.asset)

		const metadataCache = await import('~/utils/metadata').then((m) => m.default)
		const rwaList = metadataCache.rwaList
		const assetRoute = resolveRWAAssetRoute(assetParam, rwaList)
		if (!assetRoute) {
			return { notFound: true }
		}

		if (assetParam !== assetRoute.canonicalMarketId) {
			return canonicalRouteRedirect(`/rwa/asset/${encodeURIComponent(assetRoute.canonicalMarketId)}`)
		}

		const { acquireOptionalYieldsSnapshot } = await import('~/containers/Yields/server/dataset.server')
		const asset = await getRWAAssetData({
			assetId: assetRoute.assetId,
			yieldsSnapshot: await acquireOptionalYieldsSnapshot()
		})

		if (!asset) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		return {
			props: { asset, canonicalMarketId: assetRoute.canonicalMarketId },
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['RWA']

export default function RWAAssetDetailPage({
	asset,
	canonicalMarketId
}: InferGetStaticPropsType<typeof getStaticProps>) {
	const displayName =
		asset.assetName && asset.ticker
			? `${asset.assetName} (${asset.ticker})`
			: (asset.ticker ?? asset.slug ?? 'RWA Asset')

	return (
		<Layout
			title={`${displayName} - RWA Dashboard & Analytics - DefiLlama`}
			description={`Overview of the tokenized real-world asset ${displayName}, including supply, blockchain distribution, and platform data. DefiLlama provides transparent, ad-free RWA analytics.`}
			pageName={pageName}
			canonicalUrl={`/rwa/asset/${encodeURIComponent(canonicalMarketId)}`}
		>
			<RWAAssetPage asset={asset} />
		</Layout>
	)
}
