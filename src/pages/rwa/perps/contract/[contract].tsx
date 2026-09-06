import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { RWAPerpsContractPage } from '~/containers/RWA/Perps/Contract'
import { getRWAPerpsContractData } from '~/containers/RWA/Perps/queries'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect, safeDecodeURIComponent } from '~/utils/route'

function resolveCanonicalContract(contractParam: string, contracts: Array<string>): string | null {
	const normalizedContractParam = contractParam.toLowerCase()

	for (const contract of contracts) {
		if (contract.toLowerCase() === normalizedContractParam) {
			return contract
		}
	}

	const contractParamSlug = rwaSlug(contractParam)
	let slugMatch = null
	for (const contract of contracts) {
		if (rwaSlug(contract) !== contractParamSlug) continue
		if (slugMatch !== null) return null
		slugMatch = contract
	}

	return slugMatch
}

export async function getStaticPaths() {
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	return {
		paths: metadataCache.rwaPerpsList.contracts.slice(0, 10).map((contract) => ({ params: { contract } })),
		fallback: 'blocking'
	}
}

export const getStaticProps = withPerformanceLogging(
	'rwa/perps/contract/[contract]',
	async ({ params }: GetStaticPropsContext<{ contract: string }>) => {
		if (!params?.contract) {
			return { notFound: true }
		}

		const metadataCache = await import('~/utils/metadata').then((m) => m.default)
		const contractParam = safeDecodeURIComponent(params.contract)
		const canonicalContract = resolveCanonicalContract(contractParam, metadataCache.rwaPerpsList.contracts)
		if (!canonicalContract) {
			return { notFound: true }
		}

		if (contractParam !== canonicalContract) {
			return canonicalRouteRedirect(`/rwa/perps/contract/${encodeURIComponent(canonicalContract)}`)
		}

		const contract = await getRWAPerpsContractData({ contract: canonicalContract })
		if (!contract) {
			throw new Error(`Missing page data for route=/rwa/perps/contract/[contract] contract=${canonicalContract}`)
		}

		return {
			props: { contract, canonicalContract },
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['RWA Perps']

export default function RWAPerpsContractDetailPage({
	contract,
	canonicalContract
}: InferGetStaticPropsType<typeof getStaticProps>) {
	const canonicalContractSegment = encodeURIComponent(canonicalContract)

	return (
		<Layout
			title={`${contract.contract.contract} - RWA Perps Analytics - DefiLlama`}
			description={`Track the ${contract.contract.contract} perpetual market on ${contract.contract.venue}, including price, open interest, funding, market history, and detailed market data.`}
			pageName={pageName}
			canonicalUrl={`/rwa/perps/contract/${canonicalContractSegment}`}
		>
			<RWAPerpsContractPage contract={contract} />
		</Layout>
	)
}
