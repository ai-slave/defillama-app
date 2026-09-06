import type { SVGProps } from 'react'

const RESEARCH_ICON_NAMES = [
	'research-media-kit',
	'calendly-mark',
	'research-icon',
	'rss',
	'rss-mark',
	'rss-feed',
	'quote',
	'x-social',
	'telegram',
	'linkedin',
	'linkedin-square',
	'newsletter',
	'newsletter-mark',
	'spotlight',
	'spotlight-badge',
	'research-placeholder',
	'research-search-empty',
	'research-admin'
] as const

type Name = (typeof RESEARCH_ICON_NAMES)[number]

export interface IResearchIcon extends SVGProps<SVGSVGElement> {
	name: Name
}

export function ResearchIcon({ name, ...props }: IResearchIcon) {
	return (
		<svg {...props}>
			<use href={`/icons/research/v2.svg#${name}`} />
		</svg>
	)
}
