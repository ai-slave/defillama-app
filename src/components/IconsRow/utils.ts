import { slug } from '~/utils'
import type { IconsRowItem } from './index'

export const chainHref = (base: string, chain: string) => `${base}/${slug(chain)}`

// Yields matches its chain and protocol pickers by display name ("Aave V3"), never by slug.
export const yieldsChainHref = (chain: string) => `/yields?chain=${encodeURIComponent(chain)}`

export const yieldsProtocolsHref = (protocols: Array<string>) =>
	`/yields?${new URLSearchParams(protocols.map((protocol) => ['protocol', protocol])).toString()}`

export const toChainIconItems = (
	chains: Array<string>,
	getHref?: (chain: string) => string | undefined
): Array<IconsRowItem> => {
	return chains.map((chain) => ({
		label: chain,
		kind: 'chain',
		href: getHref?.(chain),
		size: 22
	}))
}

export const toTokenIconItems = (
	tokens: Array<string>,
	options?: {
		titles?: Array<string>
		getHref?: (token: string) => string | undefined
	}
): Array<IconsRowItem> => {
	return tokens.map((token, index) => ({
		label: token,
		kind: 'token',
		title: options?.titles?.[index],
		href: options?.getHref?.(token)
	}))
}
