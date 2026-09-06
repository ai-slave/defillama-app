import { YIELDS_SETTINGS } from '~/contexts/LocalStorage'

export const ATTRIBUTE_DEFS = {
	stablecoins: {
		key: YIELDS_SETTINGS.STABLECOINS.toLowerCase(),
		name: 'Stablecoin only',
		help: 'Pools backed entirely by stablecoins'
	},
	single_exposure: {
		key: YIELDS_SETTINGS.SINGLE_EXPOSURE.toLowerCase(),
		name: 'Single asset',
		help: 'Exposure to a single token'
	},
	multi_exposure: {
		key: YIELDS_SETTINGS.MULTI_EXPOSURE.toLowerCase(),
		name: 'Multi asset',
		help: 'Exposure to multiple tokens'
	},
	no_il: {
		key: YIELDS_SETTINGS.NO_IL.toLowerCase(),
		name: 'No IL risk',
		help: 'No impermanent loss risk'
	},
	no_protocol_token: {
		key: 'no_protocol_token',
		name: 'Potential Airdrop',
		help: 'Protocols with no token yet that might airdrop one to depositors in the future'
	},
	audited: {
		key: YIELDS_SETTINGS.AUDITED.toLowerCase(),
		name: 'Audited protocol',
		help: 'Audited protocols only'
	},
	include_meme_tokens: {
		key: 'include_meme_tokens',
		name: 'Include meme tokens',
		help: 'Show pools containing meme tokens (hidden by default)'
	},
	// App-side editorial whitelist (earn only); translated to `halal=true` by EarnView.
	halal: { key: 'halal', name: 'Halal', help: 'Protocols on the curated halal whitelist' }
} as const satisfies Record<string, { key: string; name: string; help: string }>

export type AttributeId = keyof typeof ATTRIBUTE_DEFS

export const EARN_ATTRIBUTE_IDS: Array<AttributeId> = [
	'stablecoins',
	'audited',
	'no_il',
	'single_exposure',
	'multi_exposure',
	'no_protocol_token',
	'halal',
	'include_meme_tokens'
]

export const BORROW_ATTRIBUTE_IDS: Array<AttributeId> = ['no_protocol_token', 'audited', 'include_meme_tokens']
