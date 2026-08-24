import { useRouter } from 'next/router'
import { useRef } from 'react'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { SelectOption } from '~/components/Select/types'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { pushYieldsQuery } from '../queryUpdates.client'
import { ATTRIBUTE_DEFS, EARN_ATTRIBUTE_IDS, type AttributeId } from './attributeOptions'

// Attribute option registry. Each option is a URL `attribute` key that the view
// (EarnView / BorrowView / LoopView) translates into the tri-state / boolean route
// params.
// The /yields earn dropdown surfaces every option; borrow markets & loops surface the
// protocol-token / audit / meme subset (the exposure/IL attributes are pool-only).
export function YieldAttributesSelect({
	nestedMenu,
	attributeIds = EARN_ATTRIBUTE_IDS
}: {
	nestedMenu?: boolean
	attributeIds?: AttributeId[]
}) {
	const router = useRouter()
	const { attribute } = router.query

	const options: SelectOption[] = attributeIds.map((id) => {
		const def = ATTRIBUTE_DEFS[id]
		return { key: def.key, name: def.name, help: def.help }
	})
	const optionKeys = new Set(options.map((o) => o.key))
	const attributeSet = Array.isArray(attribute) ? new Set(attribute) : null
	const selectedAttributes: string[] = []
	for (const option of options) {
		if (typeof attribute === 'string' ? option.key === attribute : attributeSet?.has(option.key)) {
			selectedAttributes.push(option.key)
		}
	}

	const prevSelectionRef = useRef<Set<string> | null>(null)

	// These attributes are independent boolean toggles, not a "pick from a full set"
	// filter, so we drive the `attribute` param directly (state mode) instead of the
	// shared include/exclude-diff encoding — which would collapse "all selected" to no
	// filter and flip large selections to an `excludeAttribute` the view can't read.
	const setSelectedValues = (values: string[]) => {
		const prevSet = prevSelectionRef.current ?? new Set(selectedAttributes)
		for (const attributeKey of values) {
			if (!prevSet.has(attributeKey)) {
				trackYieldsEvent(YIELDS_EVENTS.FILTER_ATTRIBUTE, { attribute: attributeKey })
			}
		}
		prevSelectionRef.current = new Set(values)

		// Preserve any `attribute` values owned by other controls/pages.
		const foreign = Array.isArray(attribute)
			? attribute.filter((value) => !optionKeys.has(value))
			: typeof attribute === 'string' && !optionKeys.has(attribute)
				? [attribute]
				: []
		const next = [...foreign, ...values]
		void pushYieldsQuery(router, { attribute: next.length ? next : undefined })
	}

	return (
		<SelectWithCombobox
			variant="default"
			size="sm"
			allValues={options}
			selectedValues={selectedAttributes}
			setSelectedValues={setSelectedValues}
			label="Attributes"
			labelType="regular"
			{...(nestedMenu !== undefined ? { nestedMenu } : {})}
		/>
	)
}
