import type { SVGProps } from 'react'

/** Every icon in the sprite, grouped by meaning so the design system page and a reader of this list find one fast.
    Grouping is order only: a name maps to its sprite symbol by id, so regrouping never needs a new sprite version. */
export const ICON_GROUPS = [
	[
		'Arrows',
		[
			'arrow-up',
			'arrow-down',
			'arrow-left',
			'arrow-right',
			'arrow-up-right',
			'arrow-up-right-2',
			'chevron-up',
			'chevron-down',
			'chevron-left',
			'chevron-right',
			'chevrons-left',
			'chevrons-right',
			'external-link',
			'circle-external-link',
			'repeat',
			'expand',
			'shrink'
		]
	],
	[
		'Actions',
		[
			'plus',
			'minus',
			'x',
			'check',
			'checkmark',
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
			'alert-warning',
			'help-circle',
			'circle-help',
			'badge-check',
			'shield-check',
			'lock',
			'key',
			'key-filled',
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
			'layers',
			'blocks',
			'panel-left-open',
			'panel-left-close',
			'align-left',
			'settings',
			'gear-settings',
			'sun',
			'moon',
			'smartphone'
		]
	],
	[
		'Data and time',
		[
			'bar-chart',
			'bar-chart-2',
			'pie-chart',
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
			'wallet',
			'credit-card',
			'card',
			'banknote',
			'receipt',
			'landmark',
			'ethereum',
			'protocol',
			'chain',
			'plug',
			'house-plug',
			'briefcase-business'
		]
	],
	[
		'Files and content',
		[
			'file-text',
			'file-plus',
			'file-lock-2',
			'folder',
			'folder-plus',
			'clipboard',
			'clipboard-check',
			'paperclip',
			'image-plus',
			'sheets',
			'code',
			'cli',
			'tag',
			'pencil-ruler',
			'package',
			'box'
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
			'mail-rounded',
			'chat',
			'message-square',
			'message-square-plus',
			'message-square-warning',
			'headset'
		]
	],
	['Web and places', ['earth', 'globe', 'map']],
	['Brands', ['github', 'google', 'twitter', 'telegram', 'discord', 'linkedin', 'farcaster', 'bluesky', 'mastodon']]
] as const

export const ICON_NAMES: ReadonlyArray<Name> = ICON_GROUPS.flatMap(([, names]) => names)

type Name = (typeof ICON_GROUPS)[number][1][number]

export interface IIcon extends SVGProps<SVGSVGElement> {
	name: Name
}
export function Icon({ name, ...props }: IIcon) {
	return (
		<svg {...props}>
			<use href={`/icons/v50.svg#${name}`} />
		</svg>
	)
}
