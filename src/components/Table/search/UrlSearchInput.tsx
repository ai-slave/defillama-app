import { useState } from 'react'
import { useDebouncedCallback } from '~/hooks/useDebounce'
import { searchFieldWrapperStyles } from '~/ui/Input'
import { SearchField } from '~/ui/SearchField'

/**
 * The search field of a table whose search lives in the URL. Typing shows at once; the URL (and the fetch) update
 * after a debounce, or at once on Enter.
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
	// `sent` is the search this field last sent; `search` is the URL's search at the last render. The URL catches up
	// a render or more later, so a new search equal to `sent` is the field's own echo and keeps the text; any other
	// search came from outside (back navigation, a removed pill) and replaces it.
	const [field, setField] = useState({ text: search, sent: search, search })
	if (search !== field.search) {
		setField({ text: search === field.sent ? field.text : search, sent: search, search })
	}
	const send = (value: string) => {
		setField((current) => ({ ...current, sent: value }))
		updateSearch(value)
	}
	// Reads the text when the timer fires, so an outside search that replaced it meanwhile drops the pending typing.
	const debouncedSend = useDebouncedCallback(() => {
		const value = field.text.trim()
		if (value !== field.sent) send(value)
	}, 300)

	return (
		<form
			noValidate
			onSubmit={(event) => {
				event.preventDefault()
				debouncedSend.cancel()
				send(field.text.trim())
			}}
			className={searchFieldWrapperStyles}
		>
			<SearchField
				label={label}
				name="search"
				value={field.text}
				onChange={(text) => {
					setField((current) => ({ ...current, text }))
					// The × and the last deleted letter wait out the debounce too, so retyping a search is one URL change.
					debouncedSend()
				}}
				placeholder={placeholder}
			/>
		</form>
	)
}
