import { useState } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { protocolInitial } from './format'
import { protocolIconUrl } from './iconUrls'

export function ProtocolIcon({ slug, name, size = 22 }: { slug: string; name: string; size?: number }) {
	const [errored, setErrored] = useState(false)
	if (errored || !slug) {
		return (
			<span
				className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-elevated-2 label-xs text-secondary"
				style={{ width: size, height: size }}
				aria-hidden
			>
				{protocolInitial(name)}
			</span>
		)
	}
	return (
		<img
			src={protocolIconUrl(slug, size * 2)}
			width={size}
			height={size}
			alt=""
			className="shrink-0 rounded-full object-cover"
			loading="lazy"
			decoding="async"
			onError={() => setErrored(true)}
		/>
	)
}

export function ChainIcon({ slug, name, size = 22 }: { slug: string; name: string; size?: number }) {
	return <TokenLogo kind="chain" name={slug} alt={name} size={size} />
}
