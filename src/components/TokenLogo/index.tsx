import { Logo } from '~/ui/Logo'
import { chainIconUrl, equityIconUrl, exchangeIconUrl, peggedAssetIconUrl, tokenIconUrl } from '~/utils/icons'

/* ----------------------------------------------------------------------------
   TokenLogo — the logo of a token, chain, exchange, pegged asset or equity,
   found by name: it resolves the artwork URL from the icon CDN and draws it
   with `Logo` (src/ui/Logo.tsx), which owns the disc, sizing and the
   broken-image fallback. A logo from a URL is `Logo` itself.

   Equities draw with Logo's `company` artwork. `equityIconUrl` in
   src/utils/icons.ts may route a ticker whose asset is a poorly fitted
   wordmark to a reviewed alternative.
---------------------------------------------------------------------------- */

export type LogoKind = 'token' | 'chain' | 'exchange' | 'pegged' | 'equities'

type TokenLogoProps = {
	size?: number
	alt?: string
	title?: string | undefined
	fallbackSrc?: string | null
	'data-lgonly'?: boolean
} & (
	| { name: string; kind: Exclude<LogoKind, 'equities'>; country?: never }
	| { name: string; kind: 'equities'; country: string }
)

function resolveLogoUrl(props: TokenLogoProps): string {
	switch (props.kind) {
		case 'token':
			return tokenIconUrl(props.name)
		case 'chain':
			return chainIconUrl(props.name)
		case 'exchange':
			return exchangeIconUrl(props.name)
		case 'pegged':
			return peggedAssetIconUrl(props.name)
		case 'equities':
			return equityIconUrl(props.name, props.country)
	}
}

export function TokenLogo(props: TokenLogoProps) {
	const { size = 24, fallbackSrc, alt, title, 'data-lgonly': lgonly } = props

	return (
		<Logo
			src={resolveLogoUrl(props)}
			fallbackSrc={fallbackSrc}
			size={size}
			variant={props.kind === 'equities' ? 'company' : 'fill'}
			alt={alt}
			title={title}
			data-lgonly={lgonly}
		/>
	)
}
