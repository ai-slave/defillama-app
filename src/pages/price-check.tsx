import type { InferGetStaticPropsType } from 'next'
import { TokenPricingCheck } from '~/containers/TokenPricingCheck'
import Layout from '~/layout'

export async function getStaticProps() {
	const metadataCache = await import('~/utils/metadata').then((module) => module.default)
	return {
		props: { chainDisplayNames: Object.fromEntries(metadataCache.chainDisplayNames) }
	}
}

export default function TokenPricingCheckPage({ chainDisplayNames }: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Token Pricing Coverage Checker - DefiLlama"
			description="Check whether DefiLlama has a current price for a token by entering its chain and address."
			canonicalUrl="/price-check"
		>
			<TokenPricingCheck chainDisplayNames={chainDisplayNames} />
		</Layout>
	)
}
