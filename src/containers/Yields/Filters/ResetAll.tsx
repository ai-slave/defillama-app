import { useRouter } from 'next/router'
import { ResetFiltersButton } from '~/components/Filters/ResetFiltersButton'
import { Tooltip } from '~/ui/Tooltip'
import { YIELDS_TABLE_PREFS } from '../stickyQueryPrefs'

const preferenceKeys = new Set(YIELDS_TABLE_PREFS.map((pref) => pref.queryKey))

export function ResetAllYieldFilters({
	pathname,
	resetContext,
	nestedMenu,
	label = 'Clear filters'
}: {
	pathname: string
	resetContext?: () => void
	nestedMenu: boolean
	label?: string
}) {
	const router = useRouter()

	const handleClick = () => {
		const query = Object.fromEntries(Object.entries(router.query).filter(([key]) => preferenceKeys.has(key)))
		void router.push({ pathname, query }, undefined, { shallow: true })
		resetContext?.()
	}

	// Dynamic-route params ([protocol]) live in router.query but are not filters.
	const routeParams = new Set(Array.from(router.pathname.matchAll(/\[(?:\.\.\.)?(\w+)\]/g), (m) => m[1]))
	let hasActiveFilters = false
	for (const key in router.query) {
		if (routeParams.has(key) || preferenceKeys.has(key)) continue
		hasActiveFilters = true
		break
	}

	return (
		<Tooltip
			content="Clear filters while keeping your APY window, reward/intrinsic settings, and rows per page."
			render={<ResetFiltersButton nestedMenu={nestedMenu} onClick={handleClick} disabled={!hasActiveFilters} />}
		>
			{label}
		</Tooltip>
	)
}
