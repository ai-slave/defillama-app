import { useRouter } from 'next/router'
import { nestedMenuActionStyles } from '~/ui/Popover'

export function ResetAllYieldFilters({
	pathname,
	resetContext,
	nestedMenu
}: {
	pathname: string
	resetContext?: () => void
	nestedMenu: boolean
}) {
	const router = useRouter()

	const handleClick = () => {
		void router.push(pathname, undefined, { shallow: true })
		resetContext?.()
	}

	// Check if any filters are active
	let hasActiveFilters = false
	for (const _key in router.query) {
		hasActiveFilters = true
		break
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={!hasActiveFilters}
			className={
				nestedMenu
					? nestedMenuActionStyles
					: 'rounded-md bg-(--legacy-btn-bg) px-3 py-2 text-xs hover:bg-(--legacy-btn-hover-bg) focus-visible:bg-(--legacy-btn-hover-bg) disabled:cursor-not-allowed disabled:opacity-40'
			}
		>
			Reset all filters
		</button>
	)
}
