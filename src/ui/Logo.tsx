const PLACEHOLDER_SRC = '/assets/placeholder.png'

/* ----------------------------------------------------------------------------
   Logo — a round logo drawn from an image URL, `size` px square, on a disc.
   A broken image falls through `fallbackSrc`, then the placeholder, then
   hides and leaves the empty disc. A missing `src` starts at the next source.

   `fill` artwork (tokens, chains, exchanges, pegged assets, picker options)
   fills the circle (`object-cover`). `company` artwork is company art: it
   keeps its proportions (`object-contain`) inside the circle, with a subtle
   border on the fixed light `bg-equity-logo` canvas the source assets are
   drawn for. Never stretch company artwork or put it on a dark surface.

   A logo known by an entity's name rather than a URL is `TokenLogo`
   (src/components/TokenLogo), which resolves the URL and renders this.
   `data-lgonly` shows the logo from `lg` up only.
---------------------------------------------------------------------------- */

export function Logo({
	src,
	fallbackSrc,
	size,
	variant = 'fill',
	alt,
	title,
	'data-lgonly': lgonly
}: {
	src: string | null
	fallbackSrc?: string | null
	size: number
	variant?: 'fill' | 'company'
	alt?: string
	title?: string
	'data-lgonly'?: boolean
}) {
	const sources = [...new Set([src, fallbackSrc, PLACEHOLDER_SRC].filter((source): source is string => !!source))]

	return (
		<span
			data-lgonly={lgonly}
			className={`inline-block shrink-0 overflow-hidden rounded-full data-[lgonly=true]:hidden lg:data-[lgonly=true]:inline-block ${
				variant === 'company' ? 'border border-subtle bg-equity-logo' : 'bg-surface-elevated-2'
			}`}
			style={{ height: size, width: size }}
			title={title}
		>
			<img
				// New sources are a new image, so a fallback stage reached for the last logo never carries over.
				key={`${src ?? ''}|${fallbackSrc ?? ''}`}
				alt={alt ?? ''}
				src={sources[0]}
				height={size}
				width={size}
				data-logo-source-index="0"
				className={`block size-full text-transparent ${variant === 'company' ? 'object-contain' : 'object-cover'}`}
				loading="lazy"
				onError={(event) => {
					// Removing `src` is what ends the chain: any assignment, even of an empty source, starts another
					// request that can fail and land here again. Clearing `image.onerror` would not stop it either,
					// because React listens with addEventListener and never sets that property.
					const image = event.currentTarget
					const nextSourceIndex = Number(image.dataset.logoSourceIndex) + 1

					if (nextSourceIndex < sources.length) {
						image.dataset.logoSourceIndex = String(nextSourceIndex)
						image.setAttribute('src', sources[nextSourceIndex])
						return
					}

					image.removeAttribute('src')
					image.classList.add('hidden')
				}}
			/>
		</span>
	)
}
