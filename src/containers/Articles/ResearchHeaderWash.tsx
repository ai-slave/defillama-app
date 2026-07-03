/**
 * Blue hero wash used on /research and /research/authors/*.
 *
 * Drawn with a CSS radial gradient plus an inline SVG grain tile instead of
 * the old raster Figma exports, so it renders at the container's exact size
 * on every viewport — no object-cover cropping or artboard math. Color stops
 * are sampled from the original webp exports (light and dark variants were
 * identical, so there is a single wash for both themes).
 */

// Anchoring the ellipse to the top edge rounds off the bottom corners and
// dissolves the wash into the page background, like the original art. The
// vertical radius must stay at 100% so the fade reaches zero exactly at the
// container edge — anything taller gets clipped mid-fade by overflow-hidden
// and leaves a hard horizontal line.
const WASH =
	'radial-gradient(ellipse 115% 100% at 50% 0%, #0d1c96 0%, rgba(16,45,180,0.98) 20%, rgba(14,67,212,0.87) 40%, rgba(14,77,224,0.59) 60%, rgba(17,83,236,0.23) 80%, rgba(16,86,237,0.05) 93%, rgba(17,88,238,0) 100%)'

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")`

export function ResearchHeaderWash() {
	return (
		<div className="isolate size-full" style={{ backgroundImage: WASH }}>
			{/* Grain is masked by the wash's own alpha so it fades out with the gradient
			    instead of speckling the page background below. */}
			<div
				className="size-full opacity-30 mix-blend-soft-light"
				style={{ backgroundImage: GRAIN, maskImage: WASH, WebkitMaskImage: WASH }}
			/>
		</div>
	)
}
