import { useRouter } from 'next/router'
import { useRef, useState } from 'react'
import { useDebouncedCallback } from '~/hooks/useDebounce'
import { Icon } from '~/ui/Icon'
import { pushShallowQuery } from '~/utils/routerQuery'

export function DashboardSearch({ defaultValue }: { defaultValue?: string }) {
	const router = useRouter()
	const inputRef = useRef<HTMLInputElement>(null)
	const [inputValue, setInputValue] = useState(defaultValue ?? '')
	const pushQuery = useDebouncedCallback((value: string) => {
		void pushShallowQuery(router, { page: undefined, query: value || undefined }, '/pro')
	}, 300)

	const handleChange = (value: string) => {
		setInputValue(value)
		pushQuery(value)
	}

	const handleClear = () => {
		setInputValue('')
		if (inputRef.current) {
			inputRef.current.focus()
		}
		pushQuery.cancel()
		void pushShallowQuery(
			router,
			{
				page: undefined,
				query: undefined
			},
			'/pro'
		)
	}

	return (
		<div className="w-full flex-1 lg:max-w-3xl">
			<div className="relative flex-1">
				<Icon
					name="search"
					height={16}
					width={16}
					className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-pro-text-tertiary"
				/>
				<input
					ref={inputRef}
					type="text"
					value={inputValue}
					onChange={(e) => handleChange(e.target.value)}
					placeholder="Search dashboards…"
					className="w-full rounded-md border border-pro-cards-border bg-pro-cards-bg py-2.5 pr-9 pl-9 text-sm transition-shadow duration-150 focus:border-brand focus:shadow-sub-focus-ring focus:outline-hidden"
				/>
				{inputValue ? (
					<button
						onClick={handleClear}
						className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm p-1 text-pro-text-tertiary transition-colors hover:bg-(--bg-hover) hover:text-pro-text-primary"
						type="button"
					>
						<Icon name="x" height={14} width={14} />
						<span className="sr-only">Clear search</span>
					</button>
				) : null}
			</div>
		</div>
	)
}
