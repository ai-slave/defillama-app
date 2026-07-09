import type { GetServerSideProps } from 'next'
import { useBlockExplorers } from '~/api/client'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { VaultRiskSection, VaultRiskUnmapped } from '~/containers/Yields/VaultRisk'
import { explorerUrl } from '~/containers/Yields/VaultRisk/components/trustShared'
import { AddressActions } from '~/containers/Yields/VaultRisk/primitives/AddressActions'
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
	const vaultName = vaultRisk?.vault.vault_name ?? null
	const vaultAddress = vaultRisk?.vault.vault_address ?? null

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5 rounded-md border border-(--cards-border) bg-(--cards-bg) p-3">
				<BasicLink
					href={`/yields/pool/${poolId}`}
					className="flex w-fit items-center gap-1 text-xs text-(--text-secondary) hover:text-(--text-primary)"
				>
					<Icon name="arrow-left" className="size-3" aria-hidden />
					Back to pool details
				</BasicLink>
				<h1 className="text-xl font-bold">{vaultName ?? poolName}</h1>
				<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--text-secondary)">
					<span>Risk report</span>
					{chain ? (
						<span className="flex items-center gap-1">
							<TokenLogo name={chain.toLowerCase()} kind="chain" size={14} />
							{chain}
						</span>
					) : null}
					{vaultAddress ? (
						<AddressActions
							address={vaultAddress}
							url={explorerUrl(vaultAddress, vaultRisk?.vault.chain ?? chain, blockExplorersData)}
							label="vault contract address"
						/>
					) : null}
				</p>
			</div>

			{vaultRisk ? (
				<VaultRiskSection
					data={vaultRisk}
					poolName={poolName}
					chain={chain}
					explorers={blockExplorersData}
					standalone
				/>
			) : (
				<VaultRiskUnmapped poolName={poolName} chain={chain} standalone />
			)}
		</div>
	)
}

export default function YieldPoolRiskPage(props: RiskPageProps) {
	const { poolId, poolName, chain } = props
	const displayName = props.vaultRisk?.vault.vault_name ?? poolName
	const label = displayName ? `${displayName}${chain ? ` (${chain})` : ''}` : poolId
	const title = label ? `${label} Risk` : 'Risk'
	const description = label ? `Per-vault risk analysis for ${label} on DefiLlama.` : ''

	return (
		<Layout title={title} description={description} canonicalUrl={poolId ? `/yields/pool/${poolId}/risk` : null}>
			<RiskPageView {...props} />
		</Layout>
	)
}

export const getServerSideProps = withServerSidePropsTelemetry('/yields/pool/[pool]/risk', getServerSidePropsHandler)
