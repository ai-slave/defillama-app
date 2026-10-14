import { tvlOptions } from '~/components/Filters/options'
import { datasetNode, jsonLdDocument } from '~/components/SEO'
import { isProtocolListTvlKey } from '~/containers/ProtocolLists/api.types'
import { ProtocolsCategoriesPage } from '~/containers/ProtocolTaxonomy/CategoriesPage'
import { getProtocolsCategoriesPageData } from '~/containers/ProtocolTaxonomy/queries'
import type { IProtocolsCategoriesPageData } from '~/containers/ProtocolTaxonomy/types'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const description =
	'Explore DeFi protocol categories: DEXs, Lending, Yield, Derivatives, and more. Compare sector TVL, revenue, and growth metrics. Category rankings and market share analytics for DeFi sectors.'

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
	return (
		<Layout
			title="Protocol Categories - DeFi TVL & Revenue Sectors - DefiLlama"
			description={description}
			canonicalUrl="/categories"
			tvlOptions={finalTvlOptions}
			pageName={pageName}
			jsonLd={jsonLdDocument([
				datasetNode({
					name: 'Protocol categories',
					description,
					url: 'https://defillama.com/categories'
				})
			])}
		>
			<ProtocolsCategoriesPage {...props} />
		</Layout>
	)
}
