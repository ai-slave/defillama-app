/**
 * Decorative backgrounds for /research/authors/defillama-research.
 *
 * Uses the original Figma gradient exports, but sized with `object-cover`
 * against containers that track the actual layout instead of fixed artboard
 * math — so the art scales cleanly at every viewport without stretching or
 * cutting off. The webps are semi-transparent, so cropping a smooth gradient
 * is invisible and the fade always blends into the page background.
 */

const AUTHOR_BG = '/assets/research/author-bg'

const BOTTOM_FADE_MASK = 'linear-gradient(to bottom, #000 0%, #000 80%, transparent 100%)'

function HeaderWash({ src, className }: { src: string; className: string }) {
	return (
		<div
			aria-hidden
			className={`pointer-events-none absolute inset-x-0 top-0 h-[calc(100%+min(22vw,240px))] overflow-hidden select-none ${className}`}
			style={{ maskImage: BOTTOM_FADE_MASK, WebkitMaskImage: BOTTOM_FADE_MASK }}
		>
			<img src={src} alt="" aria-hidden className="size-full object-cover object-top" />
		</div>
	)
}

/**
 * Blue wash behind the hero. Render as the first child of a `relative`
 * hero element; it covers the hero exactly and fades out just below it.
 */
export function ResearchAuthorHeaderGradient() {
	return (
		<>
			<HeaderWash src={`${AUTHOR_BG}/header-bg-light-desktop.webp`} className="dark:hidden" />
			<HeaderWash src={`${AUTHOR_BG}/header-bg-dark-desktop.webp`} className="hidden dark:block" />
		</>
	)
}

function Glow({ lightSrc, darkSrc, className }: { lightSrc: string; darkSrc: string; className: string }) {
	return (
		<>
			<img src={lightSrc} alt="" aria-hidden className={`absolute select-none dark:hidden ${className}`} />
			<img src={darkSrc} alt="" aria-hidden className={`absolute hidden select-none dark:block ${className}`} />
		</>
	)
}

/** Soft blue glows along the page edges, anchored responsively instead of to a fixed artboard. */
export function ResearchAuthorBackground() {
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none">
			<Glow
				lightSrc={`${AUTHOR_BG}/blue-blob-top-left-light.webp`}
				darkSrc={`${AUTHOR_BG}/blue-blob-top-left-dark.webp`}
				className="top-0 left-0 w-[min(34vw,508px)]"
			/>
			<Glow
				lightSrc={`${AUTHOR_BG}/blue-blob-light.webp`}
				darkSrc={`${AUTHOR_BG}/blue-blob-dark.webp`}
				className="top-[min(9vw,137px)] right-0 w-[min(30vw,451px)]"
			/>
			<Glow
				lightSrc={`${AUTHOR_BG}/blue-blob-bottom-left-light.webp`}
				darkSrc={`${AUTHOR_BG}/blue-blob-bottom-left-dark.webp`}
				className="top-[min(56vw,849px)] left-0 w-[min(34vw,508px)]"
			/>
			<div aria-hidden className="absolute inset-x-0 top-[55%] bottom-0 opacity-75 sm:hidden">
				<Glow
					lightSrc={`${AUTHOR_BG}/pill-bg-mobile-light.webp`}
					darkSrc={`${AUTHOR_BG}/pill-bg-mobile-dark.webp`}
					className="inset-0 size-full object-fill"
				/>
			</div>
		</div>
	)
}
