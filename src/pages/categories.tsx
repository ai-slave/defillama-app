import { tvlOptions } from '~/components/Filters/options'
import { datasetNode, jsonLdDocument } from '~/components/SEO/jsonLd'
import { isProtocolListTvlKey } from '~/containers/ProtocolLists/api.types'
import { ProtocolsCategoriesPage } from '~/containers/ProtocolTaxonomy/CategoriesPage'
import { categoryIntro } from '~/containers/ProtocolTaxonomy/categoryLead'
import { getProtocolsCategoriesPageData } from '~/containers/ProtocolTaxonomy/queries'
import type { IProtocolsCategoriesPageData } from '~/containers/ProtocolTaxonomy/types'
import { usePageClockSec } from '~/hooks/usePageClock'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const pageName = ['Protocol Categories']
const finalTvlOptions = tvlOptions.filter((option) => isProtocolListTvlKey(option.key))

export const getStaticProps = withPerformanceLogging('categories', async () => {
	const pageData = await getProtocolsCategoriesPageData()

	return {
		props: pageData,
		revalidate: maxAgeForNext([22])
	}
})

export default function CategoriesPage(props: IProtocolsCategoriesPageData) {
	const intro = categoryIntro(usePageClockSec(), props.tableData)
	return (
		<Layout
			title="Protocol Categories - DeFi TVL & Revenue Sectors - DefiLlama"
			description="Explore DeFi protocol categories: DEXs, Lending, Yield, Derivatives, and more. Compare sector TVL, revenue, and growth metrics. Category rankings and market share analytics for DeFi sectors."
			canonicalUrl="/categories"
			tvlOptions={finalTvlOptions}
			pageName={pageName}
			jsonLd={jsonLdDocument([
				datasetNode({
					name: 'Protocol categories by TVL and revenue',
					description: intro,
					url: 'https://defillama.com/categories'
				})
			])}
		>
			<ProtocolsCategoriesPage {...props} />
		</Layout>
	)
}
