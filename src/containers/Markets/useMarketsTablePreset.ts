import { useMedia } from '~/hooks/useMedia'

export type MarketsTablePreset = 'mobile' | 'compact' | 'wide'

export function useMarketsTablePreset(): MarketsTablePreset {
	const isMobile = useMedia('(max-width: 767px)')
	const isCompact = useMedia('(max-width: 1535px)')

	if (isMobile) return 'mobile'
	if (isCompact) return 'compact'
	return 'wide'
}
