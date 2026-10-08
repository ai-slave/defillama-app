import type { IIcon } from '~/ui/Icon'

export type TNavLink = {
	name: string
	route: string
	children?: Array<{ name: string; route: string }>
	icon?: IIcon['name']
	attention?: boolean
	isNew?: boolean
	requireLlama?: boolean
	/** Only for external links - internal pages are auto-tracked by Umami */
	umamiEvent?: string
}

export type TNavLinks = Array<{ category: string; pages: Array<TNavLink> }>

export type TOldNavLink = {
	name: string
	route?: string
	pages?: Array<{ name: string; route: string }>
}
