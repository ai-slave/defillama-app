import type { InferGetStaticPropsType } from 'next'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { getRWAPlatformRoutes } from '~/containers/RWA/platformRoutes'
import { RWAPlatforms } from '~/containers/RWA/Platforms'
import { getRWAPlatformsOverview } from '~/containers/RWA/queries'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import { RWATabNav } from '~/containers/RWA/TabNav'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging(`rwa/platforms`, async () => {
	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const rwaList = metadataCache.rwaList
	const { rows: platforms, initialChartDataset } = await getRWAPlatformsOverview()

	if (!platforms) {
		throw new Error('platforms not found in RWA list')
	}

	const platformLinks = getRWAPlatformRoutes(rwaList).map((platform) => ({
		label: platform.name,
		to: `/rwa/platform/${platform.slug}`
	}))

	if (platformLinks.length === 0) {
		throw new Error('platforms not found in RWA list')
	}

	const platformsWithLogos = platforms.map((platform) => ({
		...platform,
		logo: metadataCache.rwaPlatformsIndex.platforms[rwaSlug(platform.platform)]?.logo ?? null
	}))

	return {
		props: {
			platforms: platformsWithLogos,
			initialChartDataset,
			platformLinks: [{ label: 'All', to: '/rwa/platforms' }, ...platformLinks]
		},
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['RWA']

export default function RWAPlatformsPage({
	platforms,
	platformLinks,
	initialChartDataset
}: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="RWA Platforms - Real World Asset Analytics - DefiLlama"
			description={`Discover RWA platforms that enable the issuance, custody, trading, or management of tokenized real-world assets across blockchains.`}
			pageName={pageName}
			canonicalUrl={`/rwa/platforms`}
		>
			<RWATabNav active="platforms" />
			<RowLinksWithDropdown links={platformLinks} activeLink={'All'} />
			<RWAPlatforms platforms={platforms} initialChartDataset={initialChartDataset} />
		</Layout>
	)
}
