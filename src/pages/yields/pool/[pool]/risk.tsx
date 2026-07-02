import type { GetServerSideProps } from 'next'
import { useBlockExplorers } from '~/api/client'
import { BasicLink } from '~/components/Link'
import { VaultRiskSection, VaultRiskUnmapped } from '~/containers/Yields/VaultRisk'
import type { VaultRiskData } from '~/containers/Yields/VaultRisk/types'
import Layout from '~/layout'
import { jitterCacheControlHeader, maxAgeForNext } from '~/utils/maxAgeForNext'
import { YIELD_POOL_CONFIG_ID_REGEX } from '~/utils/regex-constants'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

interface RiskPageProps {
	poolId: string
	poolName: string
	chain: string
	vaultRisk: VaultRiskData | null
}

// Standalone per-pool risk page; the pool page links here when `hasVaultRisk` reports an entry.
// `getYieldPoolPageData` gives the pool context (name / chain) for the header; a missing pool
// 404s, a pool with no risk entry renders a stable empty state so the URL stays shareable.
const getServerSidePropsHandler: GetServerSideProps<RiskPageProps> = async ({ params, res }) => {
	const poolParam = params?.pool
	const poolId = typeof poolParam === 'string' ? poolParam : Array.isArray(poolParam) ? poolParam[0] : null

	if (!poolId || !YIELD_POOL_CONFIG_ID_REGEX.test(poolId)) {
		return { notFound: true }
	}

	const [{ getYieldPoolPageData }, { loadVaultRisk }] = await Promise.all([
		import('~/containers/Yields/server/dataset'),
		import('~/containers/Yields/VaultRisk/loader')
	])
	// The risk payload only needs the pool id, so it loads alongside the pool data
	// (loadVaultRisk never throws — it resolves null on any failure).
	const [result, vaultRisk] = await Promise.all([getYieldPoolPageData(poolId), loadVaultRisk(poolId)])

	if (!result.data) {
		return { notFound: true }
	}

	res.setHeader(
		'Cache-Control',
		jitterCacheControlHeader(
			`public, s-maxage=${maxAgeForNext([22])}, stale-while-revalidate=3600`,
			`yields/pool/${poolId}/risk:${result.source}`
		)
	)

	const { pool } = result.data
	const poolName = pool.poolMeta ? `${pool.pool} (${pool.poolMeta})` : (pool.pool ?? '')
	const chain = pool.chains?.[0] ?? ''

	return { props: { poolId, poolName, chain, vaultRisk } }
}

function RiskPageView({ poolId, poolName, chain, vaultRisk }: RiskPageProps) {
	const { data: blockExplorersData } = useBlockExplorers()

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2 rounded-md border border-(--cards-border) bg-(--cards-bg) p-3">
				<BasicLink
					href={`/yields/pool/${poolId}`}
					className="w-fit text-sm text-(--text-secondary) hover:text-(--text-primary)"
				>
					← {poolName}
				</BasicLink>
				<h1 className="flex flex-wrap items-baseline gap-2 text-xl font-bold">
					{poolName}
					<span className="text-base font-normal text-(--text-secondary)">Risk{chain ? ` · ${chain}` : ''}</span>
				</h1>
			</div>

			{vaultRisk ? (
				<VaultRiskSection data={vaultRisk} poolName={poolName} chain={chain} explorers={blockExplorersData} />
			) : (
				<VaultRiskUnmapped poolName={poolName} chain={chain} />
			)}
		</div>
	)
}

export default function YieldPoolRiskPage(props: RiskPageProps) {
	const { poolId, poolName, chain } = props
	const label = poolName ? `${poolName}${chain ? ` (${chain})` : ''}` : poolId
	const title = label ? `${label} Risk` : 'Risk'
	const description = label ? `Per-vault risk analysis for ${label} on DefiLlama.` : ''

	return (
		<Layout title={title} description={description} canonicalUrl={poolId ? `/yields/pool/${poolId}/risk` : null}>
			<RiskPageView {...props} />
		</Layout>
	)
}

export const getServerSideProps = withServerSidePropsTelemetry('/yields/pool/[pool]/risk', getServerSidePropsHandler)
