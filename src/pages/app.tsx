import type { InferGetStaticPropsType } from 'next'
import { SEO } from '~/components/SEO'
import { APP_STORE_URL, MobileAppLanding, PLAY_STORE_URL } from '~/containers/MobileApp'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('app', async () => {
	const { protocolMetadata, chainMetadata } = await import('~/utils/metadata').then((m) => m.default)

	let protocols = 0
	for (const protocolId in protocolMetadata) {
		// parent# entries are groupings of protocols already counted individually
		if (protocolId.startsWith('parent#')) continue
		protocols++
	}

	let chains = 0
	for (const _chain in chainMetadata) {
		chains++
	}

	return {
		props: { protocols, chains },
		revalidate: maxAgeForNext([22])
	}
})

const DESCRIPTION =
	'Download the DefiLlama mobile app for iOS and Android and ask LlamaAI, your AI research analyst for crypto — full investment theses, charts, Monte Carlo forecasts, backtests and scheduled alerts, backed by DefiLlama data.'

const jsonLd = ['iOS', 'Android'].map((operatingSystem) => ({
	'@context': 'https://schema.org',
	'@type': 'MobileApplication',
	name: 'DefiLlama: DeFi Tracker',
	operatingSystem,
	applicationCategory: 'FinanceApplication',
	description: DESCRIPTION,
	url: 'https://defillama.com/app',
	downloadUrl: operatingSystem === 'iOS' ? APP_STORE_URL : PLAY_STORE_URL,
	offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
	publisher: { '@type': 'Organization', name: 'DefiLlama', url: 'https://defillama.com' }
}))

export default function AppPage({ protocols, chains }: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<>
			<SEO
				title="DefiLlama Mobile App - LlamaAI for iOS and Android"
				description={DESCRIPTION}
				canonicalUrl="/app"
				jsonLd={jsonLd}
			/>
			<MobileAppLanding protocols={protocols} chains={chains} />
		</>
	)
}
