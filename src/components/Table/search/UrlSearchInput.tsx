import { useEffect, useRef } from 'react'
import { useDebouncedCallback } from '~/hooks/useDebounce'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles, searchFieldWrapperStyles } from '~/ui/Input'

/**
 * The search field of a table whose search lives in the URL. Uncontrolled so typing stays instant; the URL
 * (and the fetch) update after a debounce, or at once on Enter.
 */
export function UrlSearchInput({
	search,
	updateSearch,
	label,
	placeholder
}: {
	/** The search the URL holds, trimmed. */
	search: string
	updateSearch: (search: string) => void
	label: string
	placeholder: string
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	// The search this field last sent. The URL catches up a render or more later, so a search equal to it is
	// the field's own echo; any other search came from outside (back navigation, a removed pill).
	const sentRef = useRef(search)
	const send = (value: string) => {
		sentRef.current = value
		updateSearch(value)
	}
	const debouncedSend = useDebouncedCallback(send, 300)

	useEffect(() => {
		if (search === sentRef.current) return
		sentRef.current = search
		debouncedSend.cancel()
		if (inputRef.current) inputRef.current.value = search
	}, [search, debouncedSend])

	return (
		<form
			noValidate
			onSubmit={(event) => {
				event.preventDefault()
				debouncedSend.cancel()
				send(inputRef.current?.value.trim() ?? '')
			}}
			className={searchFieldWrapperStyles}
		>
			<label className="relative block min-w-0">
				<span className="sr-only">{label}</span>
				<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
				<Input
					ref={inputRef}
					name="search"
					defaultValue={search}
					onInput={(event) => debouncedSend(event.currentTarget.value.trim())}
					placeholder={placeholder}
					className={searchFieldInputPlacementStyles}
				/>
			</label>
		</form>
	)
}
