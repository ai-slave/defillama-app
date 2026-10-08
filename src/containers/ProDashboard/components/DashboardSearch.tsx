import { useRouter } from 'next/router'
import { type RefObject, useState } from 'react'
import { useDebouncedCallback } from '~/hooks/useDebounce'
import { SearchField } from '~/ui/SearchField'
import { pushShallowQuery } from '~/utils/routerQuery'

/** `ref` is the search input; the page hands focus to it when a control it removed (a tag filter) had focus. */
export function DashboardSearch({
	defaultValue,
	ref
}: {
	defaultValue?: string
	ref: RefObject<HTMLInputElement | null>
}) {
	const router = useRouter()
	const [inputValue, setInputValue] = useState(defaultValue ?? '')
	const pushQuery = useDebouncedCallback((value: string) => {
		void pushShallowQuery(router, { page: undefined, query: value }, '/pro')
	}, 300)

	// An emptied field drops the query at once, so a pending debounced search never lands after a clear.
	const handleChange = (value: string) => {
		setInputValue(value)
		if (value) {
			pushQuery(value)
			return
		}
		pushQuery.cancel()
		void pushShallowQuery(router, { page: undefined, query: undefined }, '/pro')
	}

	return (
		<SearchField
			ref={ref}
			label="Search dashboards"
			value={inputValue}
			onChange={handleChange}
			placeholder="Search dashboards…"
			className="w-full flex-1 lg:max-w-3xl"
		/>
	)
}
