export type TokenRightsChipTone = 'positive' | 'negative' | 'warning' | 'neutral'
type TokenRightsChipVariant = 'overview' | 'details'

const CHIP_TONE_CLASSES: Record<TokenRightsChipVariant, Record<TokenRightsChipTone, string>> = {
	overview: {
		positive: 'border-success-muted bg-success-tint text-success',
		negative: 'border-error-muted bg-error-tint text-error',
		warning: 'border-warning-muted bg-warning-tint text-warning',
		neutral: 'border-medium bg-surface text-secondary'
	},
	details: {
		positive: 'border-success-muted bg-success-tint text-success',
		negative: 'border-error-muted bg-error-tint text-error',
		warning: 'border-warning-muted bg-warning-tint text-warning',
		neutral: 'border-medium bg-surface-elevated-1 text-secondary'
	}
}

export function TokenRightsChipList({
	items,
	tone,
	variant,
	wrap
}: {
	items: Array<string>
	tone: TokenRightsChipTone
	variant: TokenRightsChipVariant
	wrap?: boolean
}) {
	const shouldWrap = wrap ?? variant === 'details'
	return (
		// A span, so the list can also sit inside a heading.
		<span className={`flex items-center gap-1.5 ${shouldWrap ? 'flex-wrap' : 'flex-nowrap'}`}>
			{items.map((item, index) => (
				// oxlint-disable-next-line react/no-array-index-key -- These read-only labels preserve repeated occurrences from authored text.
				<TokenRightsChip key={`${item}-${index}`} label={item} tone={tone} variant={variant} />
			))}
		</span>
	)
}

export function TokenRightsChip({
	label,
	tone,
	variant
}: {
	label: string
	tone: TokenRightsChipTone
	variant: TokenRightsChipVariant
}) {
	const shapeClass = variant === 'overview' ? 'rounded-md px-2 py-0.5 font-medium' : 'rounded-full px-2.5 py-0.5'
	return (
		<span
			className={`inline-flex w-fit shrink-0 items-center border label-sm whitespace-nowrap ${shapeClass} ${CHIP_TONE_CLASSES[variant][tone]}`}
		>
			{label}
		</span>
	)
}
