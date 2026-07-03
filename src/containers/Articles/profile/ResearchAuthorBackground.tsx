/**
 * Decorative backgrounds for /research/authors/defillama-research.
 *
 * Pure CSS gradients (colors sampled from the original Figma webp exports),
 * sized against containers that track the actual layout — so the art scales
 * cleanly at every viewport without stretching or cutting off, and light/dark
 * variants are just CSS variables instead of separate raster assets.
 */

import { ResearchHeaderWash } from '~/containers/Articles/ResearchHeaderWash'

const BOTTOM_FADE_MASK = 'linear-gradient(to bottom, #000 0%, #000 80%, transparent 100%)'

/**
 * Blue wash behind the hero. Render as the first child of a `relative`
 * hero element; it covers the hero exactly and fades out just below it.
 */
export function ResearchAuthorHeaderGradient() {
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100%+min(22vw,240px))] overflow-hidden select-none"
			style={{ maskImage: BOTTOM_FADE_MASK, WebkitMaskImage: BOTTOM_FADE_MASK }}
		>
			<ResearchHeaderWash />
		</div>
	)
}

/** `className` must set `--glow` (with a `dark:` override) for the gradient color. */
function Glow({ gradient, className }: { gradient: string; className: string }) {
	return <div aria-hidden className={`absolute ${className}`} style={{ backgroundImage: gradient }} />
}

/** Soft blue glows along the page edges, anchored responsively instead of to a fixed artboard. */
export function ResearchAuthorBackground() {
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none">
			<Glow
				gradient="radial-gradient(ellipse 55% 80% at 0% 22%, var(--glow) 0%, transparent 100%)"
				className="top-0 left-0 aspect-[7/8] w-[min(34vw,508px)] [--glow:rgba(33,122,250,0.55)] dark:[--glow:rgba(0,47,111,0.9)]"
			/>
			<Glow
				gradient="radial-gradient(ellipse 55% 45% at 100% 50%, var(--glow) 0%, transparent 100%)"
				className="top-[min(9vw,137px)] right-0 aspect-[4/7] w-[min(30vw,451px)] [--glow:rgba(33,122,250,0.42)] dark:[--glow:rgba(1,60,141,0.81)]"
			/>
			<Glow
				gradient="radial-gradient(ellipse 60% 55% at 0% 50%, var(--glow) 0%, transparent 100%)"
				className="top-[min(56vw,849px)] left-0 aspect-[2/3] w-[min(34vw,508px)] [--glow:rgba(32,121,248,0.67)] dark:[--glow:rgba(1,59,140,0.67)]"
			/>
			<div
				aria-hidden
				className="absolute inset-x-0 top-[55%] bottom-0 opacity-75 sm:hidden"
				style={{
					backgroundImage:
						'radial-gradient(ellipse 105% 80% at 0% 75%, rgba(74,140,252,0.75) 0%, rgba(103,175,253,0.55) 35%, rgba(125,201,253,0.35) 60%, rgba(133,207,252,0) 100%)'
				}}
			/>
		</div>
	)
}
