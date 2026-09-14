import { useRouter } from 'next/router'
import { Select } from '~/components/Select/Select'
import type { SelectTriggerSize } from '~/components/Select/types'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { RWAOverviewInclusionDefaults } from './constants'
import { getRwaInclusionQueryValue, resolveRWAOverviewInclusionFlag } from './filterState'
import { getRwaInclusionDefault, RWA_INCLUSION_OPTIONS } from './inclusion'

const OPTIONS = RWA_INCLUSION_OPTIONS.map((option) => ({ key: option.key, name: option.name }))

/** The home page's Include in TVL dropdown, bound to the four scope flags in the URL. */
export function RWAIncludeInTvlSelect({
	defaultInclusion,
	size = 'sm'
}: {
	defaultInclusion: RWAOverviewInclusionDefaults
	size?: SelectTriggerSize
}) {
	const router = useRouter()
	const selectedValues = RWA_INCLUSION_OPTIONS.filter((option) =>
		resolveRWAOverviewInclusionFlag(router.query[option.key], getRwaInclusionDefault(defaultInclusion, option.key))
	).map((option) => option.key)

	return (
		<Select
			allValues={OPTIONS}
			selectedValues={selectedValues}
			setSelectedValues={(values: Array<string>) => {
				const selected = new Set(values)
				const updates: Record<string, string | undefined> = {}
				for (const option of RWA_INCLUSION_OPTIONS) {
					updates[option.key] = getRwaInclusionQueryValue(
						selected.has(option.key),
						getRwaInclusionDefault(defaultInclusion, option.key)
					)
				}
				void pushShallowQuery(router, updates)
			}}
			label="Include in TVL"
			labelType="smol"
			variant="filter"
			size={size}
			placement="bottom-end"
			unmountOnHide={false}
		/>
	)
}
