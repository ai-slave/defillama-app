import { useRouter } from 'next/router'
import { useRef } from 'react'
import { readSelectionFromQuery } from '~/components/Select/query'
import { UrlSelectWithCombobox } from '~/components/Select/UrlSelect'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { pushYieldsQuery } from '../queryUpdates.client'

const EMPTY_ARRAY: Array<string> = []

interface IFiltersByCategoryProps {
	categoryList: Array<string>
	nestedMenu?: boolean
	labelType?: 'smol' | 'none'
	label?: string
}

export function FiltersByCategory({
	categoryList = EMPTY_ARRAY,
	nestedMenu,
	labelType,
	label = 'Category'
}: IFiltersByCategoryProps) {
	const router = useRouter()
	const selectedCategories = readSelectionFromQuery(router.query, 'category', 'excludeCategory', categoryList)
	const prevSelectionRef = useRef<Set<string>>(new Set(selectedCategories))

	return (
		<UrlSelectWithCombobox
			heading={label}
			variant="default"
			size="sm"
			label={label}
			allValues={categoryList}
			{...(nestedMenu !== undefined ? { nestedMenu } : {})}
			labelType={labelType ?? (selectedCategories.length === categoryList.length ? 'none' : 'regular')}
			includeQueryKey="category"
			excludeQueryKey="excludeCategory"
			pushQueryUpdates={(updates) => {
				void pushYieldsQuery(router, updates)
			}}
			onValuesChange={(values) => {
				const prevSet = prevSelectionRef.current
				for (const categoryValue of values) {
					if (!prevSet.has(categoryValue)) {
						trackYieldsEvent(YIELDS_EVENTS.FILTER_CATEGORY, { category: categoryValue })
					}
				}
				prevSelectionRef.current = new Set(values)
			}}
		/>
	)
}
