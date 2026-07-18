import { useBlockExplorers } from '~/api/client'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { BasicLink } from '~/components/Link'
import { CopyHelper } from '~/ui/Copy'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { categoryLabel } from './format'
import { ChainIcon, ProtocolIcon } from './Icons'
import type { DetailChain, DetailProtocol } from './types'

function shortAddress(a: string): string {
	return a.length <= 13 ? a : `${a.slice(0, 6)}…${a.slice(-4)}`
}

// Pool detail identity and metadata are split so the view can place the metric
// summary between them without duplicating entity presentation.
export function PoolHeader({
	symbol,
	name,
	protocol,
	chain
}: {
	symbol: string
	name: string
	protocol: DetailProtocol
	chain: DetailChain
}) {
	return (
		<div className="flex min-w-0 items-center gap-3">
			<span className="relative inline-flex shrink-0">
				<ProtocolIcon slug={protocol.slug} name={protocol.name} size={40} />
				<span className="absolute -right-1 -bottom-1 rounded-full border-2 border-surface bg-surface">
					<ChainIcon slug={chain.slug} name={chain.name} size={18} />
				</span>
			</span>
			<span className="flex min-w-0 flex-col gap-0.5">
				<h1 className="heading-sm break-words text-primary">{symbol}</h1>
				{name ? <span className="body-md text-secondary">{name}</span> : null}
			</span>
		</div>
	)
}

export function PoolMetaInfo({
	protocol,
	chain,
	poolTokenAddress,
	url,
	assets,
	actions
}: {
	protocol: DetailProtocol
	chain: DetailChain
	poolTokenAddress?: string | null
	url?: string | null
	assets?: string[]
	actions?: React.ReactNode
}) {
	const { data: blockExplorers } = useBlockExplorers()
	const category = categoryLabel(protocol.category)
	const audit = protocol.has_audit === true ? 'audited' : protocol.has_audit === false ? 'unaudited' : 'unknown'
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
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 body-md">
				{poolTokenAddress ? (
					<span className="inline-flex items-center gap-1.5">
						<span className="text-secondary">Token:</span>
						<Tooltip content={poolTokenAddress} className="mono-md text-primary">
							<code>{shortAddress(poolTokenAddress)}</code>
						</Tooltip>
						<CopyHelper toCopy={poolTokenAddress} />
					</span>
				) : null}
				<span className="inline-flex items-center gap-1.5">
					<span className="text-secondary">Chain:</span>
					{chain.slug ? (
						<BasicLink href={`/chain/${chain.slug}`} className="label-md text-primary hover:underline">
							{chain.name}
						</BasicLink>
					) : (
						<span className="label-md text-primary">{chain.name}</span>
					)}
				</span>
				<span className="inline-flex items-center gap-1.5">
					<span className="text-secondary">Protocol:</span>
					<BasicLink href={`/protocol/${protocol.slug}`} className="label-md text-primary hover:underline">
						{protocol.name}
					</BasicLink>
				</span>
				{category ? (
					<span className="inline-flex items-center gap-1.5">
						<span className="text-secondary">Category:</span>
						<BasicLink
							href={`/protocols/${slug(protocol.category ?? category)}`}
							className="label-md text-primary hover:underline"
						>
							{category}
						</BasicLink>
					</span>
				) : null}
				{assets?.length ? (
					<span className="inline-flex flex-wrap items-center gap-1.5">
						<span className="text-secondary">Underlying Tokens:</span>
						{assets.map((asset, i) => (
							<span key={asset} className="inline-flex items-center gap-1">
								<BasicLink
									href={`/token/${encodeURIComponent(asset.toUpperCase())}`}
									className="label-md text-primary hover:underline"
								>
									{asset}
								</BasicLink>
								{i < assets.length - 1 ? <span className="text-secondary">,</span> : null}
							</span>
						))}
					</span>
				) : null}
				{audit !== 'unknown' ? (
					<span className="inline-flex items-center gap-1.5">
						<span className="inline-flex items-center gap-1 text-secondary">
							Audits
							<QuestionHelper text="Audits are not a security guarantee" />:
						</span>
						{audit === 'audited' ? (
							<span className="inline-flex items-center gap-1 rounded-full border border-medium bg-surface-elevated-1 px-2.5 py-0.5 label-sm text-primary">
								<span className="size-1.5 rounded-full bg-data-up" aria-hidden />
								Yes
							</span>
						) : (
							<span className="inline-flex items-center gap-1 rounded-full border border-medium bg-surface-elevated-1 px-2.5 py-0.5 label-sm text-primary">
								<span className="size-1.5 rounded-full bg-warning" aria-hidden />
								No
							</span>
						)}
					</span>
				) : null}
			</div>

			{url || explorer || actions ? (
				<div className="flex flex-wrap items-center gap-3">
					{url ? (
						<ExternalLinkButton href={url} icon="globe">
							Website
						</ExternalLinkButton>
					) : null}
					{explorer ? <ExternalLinkButton href={explorer}>Explorer</ExternalLinkButton> : null}
					{actions}
				</div>
			) : null}
		</div>
	)
}
