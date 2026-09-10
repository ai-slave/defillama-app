export const UTR_SECTORS = ['DeFi', 'Gaming', 'Infrastructure', 'AI', 'RWA', 'Memecoins', 'Layer 1', 'Layer 2'] as const

export const FDV_RANGES = [
	{ key: 'micro', label: '< $10M', min: 0, max: 10_000_000 },
	{ key: 'small', label: '$10M – $100M', min: 10_000_000, max: 100_000_000 },
	{ key: 'mid', label: '$100M – $1B', min: 100_000_000, max: 1_000_000_000 },
	{ key: 'large', label: '> $1B', min: 1_000_000_000, max: Infinity }
] as const

export const LISTING_STATUS_LABELS = {
	listed: 'Listed',
	'pre-tge': 'Pre-TGE',
	unlisted: 'Unlisted'
} as const

export const UTR_PERCENT_OPTIONS = {
	input: 'percent',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	smallValueDisplay: 'rounded',
	useGrouping: false
} as const
