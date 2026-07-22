import { chainIconUrl, equityIconUrl, exchangeIconUrl, peggedAssetIconUrl, tokenIconUrl } from '~/utils/icons'

export type LogoKind = 'token' | 'chain' | 'exchange' | 'pegged' | 'equities'

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
		case 'exchange':
			return exchangeIconUrl(props.name)
		case 'pegged':
			return peggedAssetIconUrl(props.name)
		case 'equities':
			return equityIconUrl(props.name, props.country)
	}
}

export const FallbackLogo = ({ size = 24, 'data-lgonly': lgonly }: { size?: number; 'data-lgonly'?: boolean }) => (
	<span
		aria-hidden="true"
		data-lgonly={lgonly}
		className="inline-block shrink-0 rounded-full bg-surface-elevated-2 data-[lgonly=true]:hidden lg:data-[lgonly=true]:inline-block"
		style={{ height: size, width: size }}
	/>
)

export function TokenLogo(props: TokenLogoProps) {
	const { size = 24, fallbackSrc, alt, title, 'data-lgonly': lgonly, ...rest } = props
	const resolvedSrc = 'kind' in rest && rest.kind ? resolveLogoUrl(rest) : (rest.src ?? null)

	return (
		<TokenLogoImg
			key={`${resolvedSrc ?? ''}|${fallbackSrc ?? ''}`}
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
	const sources = [
		...new Set([resolvedSrc, fallbackSrc, placeholderSrc].filter((source): source is string => !!source))
	]

	return (
		<span
			data-lgonly={lgonly}
			className="inline-block shrink-0 overflow-hidden rounded-full bg-surface-elevated-2 data-[lgonly=true]:hidden lg:data-[lgonly=true]:inline-block"
			style={{ height: size, width: size }}
			title={title}
		>
			<img
				alt={alt ?? ''}
				src={sources[0]}
				height={size}
				width={size}
				data-logo-source-index="0"
				className="block size-full object-cover text-transparent"
				loading="lazy"
				onError={(event) => {
					const image = event.currentTarget
					const sourceIndex = Number(image.dataset.logoSourceIndex)
					const nextSourceIndex = sourceIndex + 1

					if (nextSourceIndex < sources.length) {
						image.dataset.logoSourceIndex = String(nextSourceIndex)
						image.src = sources[nextSourceIndex]
						return
					}

					image.removeAttribute('src')
					image.classList.add('hidden')
				}}
			/>
		</span>
	)
}
