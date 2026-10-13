import type { SVGProps } from 'react'

/** Every icon in the sprite, grouped by meaning so the design system page and a reader of this list find one fast.
    The sprite lists its symbols in this order under one `<!-- Group -->` comment each, so a pasted icon lands next to
    its neighbors and a duplicate shows up in review. To add one (design.md → Icons):
    1. Copy the SVG from lucide.dev (a brand from simpleicons.org) without changing it. A glyph Lucide lacks is drawn on
       the same grid: 24px, a 2px round stroke, currentColor.
    2. Paste it into the sprite under its group as `<symbol id="name" …>`, keeping Lucide's root attributes. Star,
       bookmark, pin, play and stop drop `fill="none"` so `fill-current` can fill them.
    3. Add the name here in the same position.
    4. Copy the sprite to the next version and point ICON_SPRITE at it, so cached copies of the old one are never used.
    src/ui/__tests__/Icon.test.tsx fails a symbol that breaks the grid, stroke or color rules, or is out of order. */
export const ICON_GROUPS = [
	[
		'Arrows',
		[
			'arrow-up',
			'arrow-down',
			'arrow-left',
			'arrow-right',
			'arrow-up-right',
			'arrow-left-right',
			'chevron-up',
			'chevron-down',
			'chevron-left',
			'chevron-right',
			'chevrons-left',
			'chevrons-right',
			'external-link',
			'repeat',
			'rotate-ccw',
			'expand',
			'shrink',
			'sort-up',
			'sort-down'
		]
	],
	[
		'Actions',
		[
			'plus',
			'minus',
			'x',
			'check',
			'pencil',
			'square-pen',
			'copy',
			'link',
			'trash-2',
			'download',
			'download-cloud',
			'download-paper',
			'share',
			'search',
			'pin',
			'bookmark',
			'flag',
			'star',
			'thumbs-up',
			'thumbs-down',
			'pause',
			'play',
			'stop',
			'sign-out',
			'ellipsis',
			'menu',
			'grip-vertical'
		]
	],
	[
		'Status',
		[
			'check-circle',
			'circle-x',
			'alert-triangle',
			'alert-triangle-filled',
			'help-circle',
			'info',
			'circle-alert',
			'ban',
			'badge-check',
			'shield-check',
			'lock',
			'key',
			'eye',
			'eye-off',
			'sparkles',
			'flame'
		]
	],
	[
		'Layout and settings',
		[
			'house',
			'layout-grid',
			'layout-dashboard',
			'layers',
			'blocks',
			'panel-left-open',
			'panel-left-close',
			'align-left',
			'table',
			'sliders-horizontal',
			'settings',
			'sun',
			'moon',
			'smartphone'
		]
	],
	[
		'Data and time',
		[
			'bar-chart-2',
			'pie-chart',
			'chart-line',
			'chart-no-axes-column-increasing',
			'activity',
			'trending-up',
			'percent',
			'linear-unlock',
			'cliff-unlock',
			'clock',
			'calendar',
			'calendar-plus'
		]
	],
	[
		'Finance and crypto',
		[
			'dollar-sign',
			'coins',
			'wallet',
			'credit-card',
			'banknote',
			'receipt',
			'landmark',
			'gem',
			'scale',
			'droplets',
			'route',
			'protocol',
			'chain',
			'plug',
			'house-plug',
			'briefcase-business',
			'rocket'
		]
	],
	[
		'Files and content',
		[
			'file-text',
			'newspaper',
			'quote',
			'file-plus',
			'file-lock-2',
			'folder',
			'folder-plus',
			'clipboard',
			'clipboard-check',
			'paperclip',
			'image-plus',
			'image',
			'square-play',
			'sheets',
			'code',
			'square-code',
			'cli',
			'tag',
			'pencil-ruler',
			'wrench',
			'package',
			'lightbulb',
			'presentation',
			'rss'
		]
	],
	[
		'People and messages',
		[
			'user',
			'users',
			'id-card',
			'scan-face',
			'graduation-cap',
			'gift',
			'mail',
			'message-square',
			'message-square-plus',
			'message-square-warning',
			'headset'
		]
	],
	[
		'Text formatting',
		[
			'bold',
			'italic',
			'underline',
			'strikethrough',
			'highlighter',
			'heading-2',
			'heading-3',
			'list',
			'list-ordered',
			'text-quote',
			'undo-2',
			'redo-2'
		]
	],
	[
		'Chart types',
		[
			'chart-type-line',
			'chart-type-area',
			'chart-type-area-stacked',
			'chart-type-area-percent',
			'chart-type-bar',
			'chart-type-hbar',
			'chart-type-donut',
			'chart-type-scatter',
			'chart-type-bubble',
			'chart-type-histogram',
			'chart-type-treemap',
			'chart-type-candlestick'
		]
	],
	['Web and places', ['globe', 'map', 'building-2']],
	['DefiLlama', ['llamaai', 'research', 'token-rating']],
	[
		'Brands',
		[
			'github',
			'google',
			'twitter',
			'telegram',
			'telegram-plane',
			'discord',
			'linkedin',
			'linkedin-in',
			'farcaster',
			'bluesky',
			'mastodon',
			'calendly'
		]
	]
] as const

export const ICON_NAMES: ReadonlyArray<Name> = ICON_GROUPS.flatMap(([, names]) => names)

/** The one place the sprite version lives; _document.tsx prefetches the same file. */
export const ICON_SPRITE = '/icons/v53.svg'

type Name = (typeof ICON_GROUPS)[number][1][number]

/** No `height` or `width`: the size sits in the class list beside the icon's color, so a reader sees one scale. */
export interface IIcon extends Omit<SVGProps<SVGSVGElement>, 'height' | 'width'> {
	name: Name
}
/** A sprite icon. Size it with a `size-*` class: `size-3.5` (14px) beside a label, `size-4` (16px) icon-only
    (design.md → Icons). Icons are outlines; `fill-current` fills the ones whose symbol leaves fill open (star,
    bookmark, pin, play, stop): an on state, or a solid play or stop button. */
export function Icon({ name, ...props }: IIcon) {
	return (
		<svg fill="none" {...props}>
			<use href={`${ICON_SPRITE}#${name}`} />
		</svg>
	)
}
