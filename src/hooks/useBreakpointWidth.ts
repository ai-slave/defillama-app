import { useMedia } from './useMedia'

/**
 * Returns a width value that only changes when crossing breakpoint boundaries.
 *
 * Pixel changes within the same breakpoint do not trigger re-renders.
 *
 * Returns the minimum width of the current breakpoint range:
 * - 1536 for 2xl (>= 1536px)
 * - 1280 for xl (>= 1280px)
 * - 1024 for lg (>= 1024px)
 * - 768 for md (>= 768px)
 * - 640 for sm (>= 640px)
 * - 480 for xs+ (>= 480px)
 * - 0 for xs (< 480px)
 *
 * @example
 * ```tsx
 * const width = useBreakpointWidth()
 * const order = width > 1024 ? desktopOrder : mobileOrder
 * ```
 */
export function useBreakpointWidth(): number
export function useBreakpointWidth(enabled: true): number
export function useBreakpointWidth(enabled: false): null
export function useBreakpointWidth(enabled: boolean): number | null
export function useBreakpointWidth(enabled = true): number | null {
	const is2xl = useMedia('(min-width: 1536px)', enabled)
	const isXl = useMedia('(min-width: 1280px)', enabled)
	const isLg = useMedia('(min-width: 1024px)', enabled)
	const isMd = useMedia('(min-width: 768px)', enabled)
	const isSm = useMedia('(min-width: 640px)', enabled)
	const isXsPlus = useMedia('(min-width: 480px)', enabled)

	if (!enabled) return null

	if (is2xl) return 1536
	if (isXl) return 1280
	if (isLg) return 1024
	if (isMd) return 768
	if (isSm) return 640
	if (isXsPlus) return 480

	return 0
}
