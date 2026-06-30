import type { ExchangeMetadataListEntry } from '~/containers/Markets/api.types'
import { MicaFinder } from '~/containers/Markets/MicaFinder'
import { fetchExchangeMetadataListFromNetwork } from '~/containers/Markets/server/upstream'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

type MicaPageProps = {
	exchanges: ExchangeMetadataListEntry[]
}

export const getStaticProps = withPerformanceLogging<MicaPageProps>('mica', async () => {
	let exchanges: ExchangeMetadataListEntry[] = []
	try {
		const res = await fetchExchangeMetadataListFromNetwork()
		exchanges = res?.exchanges ?? []
	} catch (e) {
		// The metadata origin may be unavailable at build time — never fail the
		// build over the directory; render the empty state instead.
		console.warn('[mica] metadata-list fetch failed, rendering empty state:', (e as Error).message)
	}

	return {
		props: { exchanges },
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['MiCA-regulated exchanges']

export default function MicaPage({ exchanges }: MicaPageProps) {
	return (
		<Layout
			title="MiCA-regulated exchanges - DefiLlama"
			description="Compare MiCA-licensed crypto exchanges available in the EU: regulatory status, supported products, KYC requirements, and trading fees — targeted to each exchange's EU entity."
			canonicalUrl="/mica"
			pageName={pageName}
		>
			{exchanges.length ? (
				<MicaFinder exchanges={exchanges} />
			) : (
				<p className="rounded-md border border-(--cards-border) bg-(--cards-bg) p-12 text-center text-sm text-(--text-label)">
					Exchange directory is being updated. Please check back shortly.
				</p>
			)}
		</Layout>
	)
}
