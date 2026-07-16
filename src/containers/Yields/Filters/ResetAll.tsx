import { useRouter } from 'next/router'
import { Button } from '~/ui/Button'
import { nestedMenuActionStyles } from '~/ui/Popover'

export function ResetAllYieldFilters({
	pathname,
	resetContext,
	nestedMenu,
	label = 'Reset all filters'
}: {
	pathname: string
	resetContext?: () => void
	nestedMenu: boolean
	label?: string
}) {
	const router = useRouter()

	const handleClick = () => {
		void router.push(pathname, undefined, { shallow: true })
		resetContext?.()
	}

	// Dynamic-route params ([protocol]) live in router.query but are not filters.
	const routeParams = new Set(Array.from(router.pathname.matchAll(/\[(?:\.\.\.)?(\w+)\]/g), (m) => m[1]))
	let hasActiveFilters = false
	for (const key in router.query) {
		if (routeParams.has(key)) continue
		hasActiveFilters = true
		break
	}

	if (nestedMenu) {
		return (
			<button type="button" onClick={handleClick} disabled={!hasActiveFilters} className={nestedMenuActionStyles}>
				{label}
			</button>
		)
	}

	return (
		<Button type="button" variant="secondary" size="md" onClick={handleClick} disabled={!hasActiveFilters}>
			{label}
		</Button>
	)
}
