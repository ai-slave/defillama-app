import type { SVGProps } from 'react'

type Name = 'spotlight-badge' | 'rss-mark' | 'research-search-empty'

/** The research pages' illustrations (colored badges, empty-state drawings); interface icons and logos come from `Icon`. */
export function ResearchArt({ name, ...props }: SVGProps<SVGSVGElement> & { name: Name }) {
	return (
		<svg {...props}>
			<use href={`/assets/research/art-v3.svg#${name}`} />
		</svg>
	)
}
