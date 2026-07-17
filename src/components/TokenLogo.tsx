import * as React from 'react'
import { chainIconUrl, equityIconUrl, peggedAssetIconUrl, tokenIconUrl } from '~/utils/icons'

export type LogoKind = 'token' | 'chain' | 'pegged' | 'equities'

type TokenLogoProps = {
	size?: number
	alt?: string
	title?: string
	fallbackSrc?: string | null
	'data-lgonly'?: boolean
} & (
	| { name: string; kind: Exclude<LogoKind, 'equities'>; country?: never; src?: never }
	| { name: string; kind: 'equities'; country: string; src?: never }
	| { src: string | null | undefined; name?: never; kind?: never; country?: never }
)

type NamedLogoProps = Extract<TokenLogoProps, { name: string }>

function resolveLogoUrl(props: NamedLogoProps): string {
	switch (props.kind) {
		case 'token':
			return tokenIconUrl(props.name)
		case 'chain':
			return chainIconUrl(props.name)
		case 'pegged':
			return peggedAssetIconUrl(props.name)
		case 'equities':
			return equityIconUrl(props.name, props.country)
	}
}

export const FallbackLogo = () => (
	<span className="inline-block aspect-square size-6 shrink-0 rounded-full bg-surface-elevated-2 object-cover" />
)

export function TokenLogo(props: TokenLogoProps) {
	const { size = 24, fallbackSrc, alt, title, 'data-lgonly': lgonly, ...rest } = props
	const resolvedSrc = 'kind' in rest && rest.kind ? resolveLogoUrl(rest) : (rest.src ?? null)

	const sourcesKey = `${resolvedSrc ?? ''}|${fallbackSrc ?? ''}`

	return (
		<TokenLogoImg
			key={sourcesKey}
			resolvedSrc={resolvedSrc}
			size={size}
			fallbackSrc={fallbackSrc}
			alt={alt}
			title={title}
			data-lgonly={lgonly}
		/>
	)
}

function TokenLogoImg({
	resolvedSrc,
	size = 24,
	fallbackSrc,
	alt,
	title,
	'data-lgonly': lgonly
}: {
	resolvedSrc: string | null
	size?: number
	fallbackSrc?: string | null
	alt?: string
	title?: string
	'data-lgonly'?: boolean
}) {
	const placeholderSrc = '/assets/placeholder.png'
	const initialSrc = resolvedSrc || fallbackSrc || placeholderSrc
	const [src, setSrc] = React.useState<string>(initialSrc)

	return (
		<img
			alt={alt ?? ''}
			src={src}
			height={size}
			width={size}
			title={title}
			data-lgonly={lgonly}
			className="inline-block aspect-square max-w-none shrink-0 rounded-full bg-surface-elevated-2 object-cover text-transparent data-[lgonly=true]:hidden lg:data-[lgonly=true]:inline-block"
			loading="lazy"
			onError={(e) => {
				setSrc((prev) => {
					if (prev === resolvedSrc && fallbackSrc && fallbackSrc !== resolvedSrc) return fallbackSrc
					if (prev !== placeholderSrc) return placeholderSrc
					return prev
				})

				if (src === placeholderSrc) e.currentTarget.onerror = null
			}}
		/>
	)
}
