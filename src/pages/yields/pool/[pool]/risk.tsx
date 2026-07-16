import type { GetServerSideProps } from 'next'
import { useBlockExplorers } from '~/api/client'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { fetchBorrowMarketDetail, fetchPoolDetail, isNotFoundError } from '~/containers/Yields/poolDetail/fetch'
import { explorerUrl } from '~/containers/Yields/VaultRisk/components/trustShared'
import { AddressActions } from '~/containers/Yields/VaultRisk/primitives/AddressActions'
import type { VaultRiskData } from '~/containers/Yields/VaultRisk/types'
import { VaultRiskSection, VaultRiskUnmapped } from '~/containers/Yields/VaultRisk/VaultRiskSection'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { jitterCacheControlHeader, maxAgeForNext } from '~/utils/maxAgeForNext'
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

	if (!poolId) {
		return { notFound: true }
	}

	const { loadVaultRisk } = await import('~/containers/Yields/VaultRisk/loader')
	const detailPromise = fetchPoolDetail(poolId)
		.then((pool) => ({ kind: 'earn' as const, pool }))
		.catch((error: unknown) => {
			if (!isNotFoundError(error)) throw error
			return fetchBorrowMarketDetail(poolId)
				.then((market) => ({ kind: 'borrow' as const, market }))
				.catch((borrowError: unknown) => {
					if (isNotFoundError(borrowError)) return null
					throw borrowError
				})
		})
	const [detail, vaultRisk] = await Promise.all([detailPromise, loadVaultRisk(poolId)])
	if (!detail) return { notFound: true }

	res.setHeader(
		'Cache-Control',
		jitterCacheControlHeader(
			`public, s-maxage=${maxAgeForNext([22])}, stale-while-revalidate=3600`,
			`yields/pool/${poolId}/risk:v2`
		)
	)

	const entity = detail.kind === 'earn' ? detail.pool : detail.market
	const label = entity.display?.label ?? ''
	const meta = entity.display?.detail
	const poolName = meta ? `${label} (${meta})` : label
	const chain = entity.chain

	return { props: { poolId, poolName, chain, vaultRisk } }
}

function RiskPageView({ poolId, poolName, chain, vaultRisk }: RiskPageProps) {
	const { data: blockExplorersData } = useBlockExplorers()
	const vaultName = vaultRisk?.vault.vault_name ?? null
	const vaultAddress = vaultRisk?.vault.vault_address ?? null

	return (
		<div className="flex flex-col gap-2">
			<BasicLink
				href={`/yields/pool/${poolId}`}
				className="flex w-fit items-center gap-1 body-sm text-secondary hover:text-primary"
			>
				<Icon name="arrow-left" className="size-3.5" aria-hidden />
				Back to pool details
			</BasicLink>
			<Card padding="sm" className="flex flex-col gap-2">
				<h1 className="heading-sm">{vaultName ?? poolName}</h1>
				<p className="flex flex-wrap items-center gap-x-3 gap-y-1 body-sm text-secondary">
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
			</Card>

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
