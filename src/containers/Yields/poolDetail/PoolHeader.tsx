import type { ReactNode } from 'react'
import { useBlockExplorers } from '~/api/client'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { CopyHelper } from '~/ui/Copy'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { slug } from '~/utils'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { categoryLabel } from './format'
import { ProtocolIcon } from './Icons'
import type { DetailChain, DetailProtocol } from './types'

function shortAddress(a: string): string {
	return a.length <= 13 ? a : `${a.slice(0, 6)}…${a.slice(-4)}`
}

function AuditPill({ audited }: { audited: boolean }) {
	return (
		<span className="inline-flex items-center gap-1 rounded-full border border-medium bg-surface-elevated-1 px-2.5 py-0.5 label-sm text-primary">
			<span className={`size-1.5 rounded-full ${audited ? 'bg-success' : 'bg-warning'}`} aria-hidden />
			{audited ? 'Yes' : 'No'}
		</span>
	)
}

export function PoolHeader({
	symbol,
	name,
	protocol,
	chain,
	poolTokenAddress,
	url
}: {
	symbol: string
	name: string
	protocol: DetailProtocol
	chain: DetailChain
	poolTokenAddress?: string | null
	url?: string | null
}) {
	const { data: blockExplorers } = useBlockExplorers()
	const explorer =
		blockExplorers && poolTokenAddress
			? (getBlockExplorerNew({
					apiResponse: blockExplorers,
					address: poolTokenAddress,
					chainName: chain.name,
					urlType: 'address'
				})?.url ?? null)
			: null
	return (
		<Card as="header" padding="sm" className="flex flex-wrap items-center gap-x-5 gap-y-2">
			<div className="flex min-w-0 items-center gap-3">
				<span className="relative inline-flex shrink-0">
					<ProtocolIcon slug={protocol.slug} name={protocol.name} size={40} />
					<span className="absolute -right-1 -bottom-1 rounded-full border-2 border-surface bg-surface">
						<TokenLogo kind="chain" name={chain.slug} alt={chain.name} size={18} />
					</span>
				</span>
				<span className="flex min-w-0 flex-col gap-0.5">
					<h1 className="heading-sm break-words text-primary">{symbol}</h1>
					{name ? <span className="body-md text-secondary">{name}</span> : null}
				</span>
			</div>
			{url || explorer ? (
				<div className="flex flex-wrap items-center gap-2 @min-[48rem]:ml-auto">
					{url ? (
						<ExternalLinkButton href={url} icon="globe">
							Website
						</ExternalLinkButton>
					) : null}
					{explorer ? <ExternalLinkButton href={explorer}>Explorer</ExternalLinkButton> : null}
				</div>
			) : null}
		</Card>
	)
}

function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			<dt className="body-md text-secondary">{label}</dt>
			<dd className="m-0 flex flex-wrap items-center gap-1.5 body-md text-primary">{children}</dd>
		</div>
	)
}

export function PoolMetaInfo({
	poolId,
	protocol,
	chain,
	poolTokenAddress,
	assets
}: {
	poolId: string
	protocol: DetailProtocol
	chain: DetailChain
	poolTokenAddress?: string | null
	assets?: Array<string>
}) {
	const category = categoryLabel(protocol.category)

	return (
		<Card as="section" padding="none">
			{/* No controls in this header, so it takes the height a header with a 32px control has. */}
			<PanelHeader className="min-h-14">
				<PanelTitle>About</PanelTitle>
			</PanelHeader>
			<dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-4 @min-[48rem]:grid-cols-4">
				{poolTokenAddress ? (
					<Fact label="Pool token">
						<span>{shortAddress(poolTokenAddress)}</span>
						<CopyHelper toCopy={poolTokenAddress} />
					</Fact>
				) : null}
				{assets?.length ? (
					<Fact label="Underlying tokens">
						{assets.map((asset, i) => (
							<span key={asset} className="inline-flex items-center gap-1">
								<BasicLink href={`/token/${encodeURIComponent(asset.toUpperCase())}`} className="hover:underline">
									{asset}
								</BasicLink>
								{i < assets.length - 1 ? <span className="text-secondary">,</span> : null}
							</span>
						))}
					</Fact>
				) : null}
				<Fact label="Protocol">
					<BasicLink href={`/protocol/${protocol.slug}`} className="hover:underline">
						{protocol.name}
					</BasicLink>
				</Fact>
				<Fact label="Chain">
					{chain.slug ? (
						<BasicLink href={`/chain/${chain.slug}`} className="hover:underline">
							{chain.name}
						</BasicLink>
					) : (
						<span>{chain.name}</span>
					)}
				</Fact>
				{category ? (
					<Fact label="Category">
						<BasicLink href={`/protocols/${slug(protocol.category ?? category)}`} className="hover:underline">
							{category}
						</BasicLink>
					</Fact>
				) : null}
				{protocol.has_audit != null ? (
					<Fact
						label={
							<span className="inline-flex items-center gap-1">
								Audits
								<QuestionHelper text="Audits are not a security guarantee" />
							</span>
						}
					>
						<AuditPill audited={protocol.has_audit} />
					</Fact>
				) : null}
				<Fact label="Pool id">
					<span className="break-all">{poolId}</span>
					<CopyHelper toCopy={poolId} />
				</Fact>
			</dl>
		</Card>
	)
}
