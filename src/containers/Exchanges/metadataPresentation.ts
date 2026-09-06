import type { ComponentProps } from 'react'
import type { Icon } from '~/ui/Icon'
import { formatMonthYear } from '~/utils/dateFormat'
import type { ExchangeMetadataGroupKey, ExchangeMetadataTone } from './models'

type IconName = ComponentProps<typeof Icon>['name']

interface MetadataGroupPresentation {
	title: string
	icon: IconName
}

export const METADATA_GROUP_ORDER: Array<ExchangeMetadataGroupKey> = [
	'identity',
	'links',
	'security',
	'proof_of_reserves',
	'regulation',
	'products',
	'funding',
	'kyc',
	'fees'
]

export const METADATA_GROUP_PRESENTATION: Record<ExchangeMetadataGroupKey, MetadataGroupPresentation> = {
	identity: { title: 'Overview', icon: 'file-text' },
	links: { title: 'Links & platforms', icon: 'link' },
	security: { title: 'Security & access', icon: 'file-lock-2' },
	proof_of_reserves: { title: 'Proof of reserves', icon: 'wallet' },
	regulation: { title: 'Regulation & licenses', icon: 'clipboard-check' },
	products: { title: 'Products & availability', icon: 'package' },
	funding: { title: 'Deposits & withdrawals', icon: 'banknote' },
	kyc: { title: 'KYC & verification', icon: 'id-card' },
	fees: { title: 'Fees', icon: 'percent' },
	metrics: { title: 'Markets & volume', icon: 'bar-chart-2' }
}

const VALUE_LABELS: Record<string, string> = {
	web: 'Web',
	ios: 'iOS',
	android: 'Android',
	macos: 'macOS',
	windows: 'Windows',
	linux: 'Linux',
	'browser-extension': 'Browser extension',
	spot: 'Spot',
	convert: 'Convert',
	etf: 'ETFs',
	otc: 'OTC',
	p2p: 'P2P',
	staking: 'Staking',
	margin: 'Margin',
	'cross-margin': 'Cross margin',
	'isolated-margin': 'Isolated margin',
	'spot-margin': 'Spot margin',
	options: 'Options',
	'btc-options': 'BTC options',
	'eth-options': 'ETH options',
	'linear-options': 'Linear options',
	'inverse-options': 'Inverse options',
	'linear-perp': 'USD perpetuals',
	'inverse-perp': 'COIN perpetuals',
	'coinm-perp': 'COIN-M perpetuals',
	'usdm-perp': 'USD-M perpetuals',
	'usdc-m-perp': 'USDC-M perpetuals',
	'usdcm-perp': 'USDC-M perpetuals',
	'usdc-perp': 'USDC-settled perpetuals',
	'usdm-perp-usd': 'USD-settled perpetuals',
	'perpetual-futures': 'Perpetual futures',
	'tradfi-perp': 'TradFi perpetuals',
	'x-perps': 'X-Perps',
	'dated-futures': 'Dated futures',
	'linear-futures': 'Linear futures',
	'inverse-futures': 'Inverse futures',
	'quarterly-futures': 'Quarterly futures',
	'delivery-futures': 'Delivery futures',
	'coinm-delivery': 'COIN-M delivery futures',
	'coinm-futures': 'COIN-M futures',
	'usdm-delivery': 'USD-M delivery futures',
	'usdm-futures': 'USD-M futures',
	'dvol-futures': 'DVOL futures',
	available: 'Available',
	unavailable: 'Unavailable',
	active: 'Active',
	'in-progress': 'In progress',
	both: 'Deposit & withdraw',
	deposit: 'Deposit',
	withdraw: 'Withdraw',
	authenticator: 'Authenticator app',
	passkey: 'Passkey',
	'transparency page': 'Transparency page',
	schedule: 'Fee schedule'
}

export function metadataValueLabel(value: string): string {
	return VALUE_LABELS[value] ?? value
}

/** Brand icon for a metadata link pill, inferred from the server-provided label. */
export function metadataLinkIcon(label: string): IconName | undefined {
	const normalized = label.toLowerCase()
	if (normalized.includes('website')) return 'globe'
	if (normalized.includes('twitter') || normalized === 'x') return 'twitter'
	if (normalized.includes('telegram')) return 'telegram'
	if (normalized.includes('discord')) return 'discord'
	if (normalized.includes('github')) return 'github'
	if (normalized.startsWith('@')) return 'user'
	return undefined
}

export function metadataStatusTone(value: string): ExchangeMetadataTone {
	if (value === 'available' || value === 'active') return 'positive'
	if (value === 'in-progress') return 'caution'
	return 'neutral'
}

export function formatMetadataAsOf(asOf: string): string {
	return formatMonthYear(asOf) ?? asOf
}
