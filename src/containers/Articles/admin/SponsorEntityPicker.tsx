import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { ArticleEntitySuggestionItem } from '~/containers/Articles/entitySuggestions'
import type { ResearchSponsorEntityType } from '~/containers/Articles/types'
import { Button } from '~/ui/Button'
import type { FieldControlProps } from '~/ui/Field'
import { keepFocus } from '~/ui/focus'
import { ListLoading } from '~/ui/NoResults'
import { ComboboxSurface, PopoverRow } from '~/ui/PopoverSurface'
import { SearchField } from '~/ui/SearchField'

const ALLOWED_TYPES = new Set<ResearchSponsorEntityType>(['protocol', 'chain', 'cex'])

export type SponsorEntitySelection = ArticleEntitySuggestionItem & {
	entityType: ResearchSponsorEntityType
}

/** The search box of a Field (~/ui/Field): `control` carries the label's id and the error wiring, and `label` repeats
    the Field's label, because SearchField names its input with `aria-label`. */
export function SponsorEntityPicker({
	label,
	value,
	onChange,
	...control
}: FieldControlProps & {
	label: string
	value: SponsorEntitySelection | null
	onChange: (value: SponsorEntitySelection | null) => void
}) {
	const [open, setOpen] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const [searchValue, setSearchValue] = useState('')
	const query = searchValue.trim()

	const { data, isFetching } = useQuery<{ entities: Array<ArticleEntitySuggestionItem> }>({
		queryKey: ['research', 'admin', 'sponsor-entities', query],
		queryFn: async () => {
			const response = await fetch(`/api/public/research/entities/search?q=${encodeURIComponent(query)}`)
			if (!response.ok) throw new Error("Couldn't search DefiLlama pages.")
			return response.json()
		},
		enabled: open && query.length > 0,
		staleTime: 60_000,
		retry: false
	})

	const items = (data?.entities ?? []).filter((item): item is SponsorEntitySelection =>
		ALLOWED_TYPES.has(item.entityType as ResearchSponsorEntityType)
	)

	return (
		<div className="grid gap-2">
			<Ariakit.ComboboxProvider open={open} setOpen={setOpen} setInputValue={setSearchValue} resetValueOnHide>
				<SearchField
					combobox
					ref={inputRef}
					{...control}
					label={label}
					placeholder={value?.label ?? 'Search protocols, chains, or CEXs…'}
					autoSelect
				/>
				<ComboboxSurface variant="search-results" sameWidth maxHeight="md">
					{query.length === 0 ? <p className="p-3 body-sm text-tertiary">Type a page name to search.</p> : null}
					{query.length > 0 && isFetching && items.length === 0 ? <ListLoading label="Searching" /> : null}
					{query.length > 0 && !isFetching && items.length === 0 ? (
						<p className="p-3 body-sm text-tertiary">No matching protocol, chain, or CEX page.</p>
					) : null}
					{items.map((item) => (
						<PopoverRow
							key={`${item.entityType}:${item.slug}`}
							onClick={() => {
								onChange(item)
								setSearchValue('')
								setOpen(false)
							}}
							render={<Ariakit.ComboboxItem value={item.label} setValueOnClick={false} />}
						>
							<span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-subtle bg-surface">
								{item.logo ? (
									<img src={item.logo} alt="" className="size-full object-cover" loading="lazy" />
								) : (
									<span className="label-xs text-tertiary">{item.label.slice(0, 2).toUpperCase()}</span>
								)}
							</span>
							<span className="grid min-w-0 flex-1 gap-0.5">
								<span className="truncate label-md text-primary">{item.label}</span>
								<span className="truncate body-sm text-tertiary">{item.route}</span>
							</span>
							<span className="rounded-full border border-medium px-2 py-0.5 label-xs text-secondary uppercase">
								{item.entityType}
							</span>
						</PopoverRow>
					))}
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
			{value ? (
				<div className="flex items-center gap-2">
					<p className="min-w-0 body-sm text-secondary">
						Selected <span className="label-sm text-primary">{value.route}</span>
					</p>
					{/* The search field's × clears the typed text; this clears the pick. */}
					<Button
						type="button"
						variant="link"
						className="ml-auto"
						onClick={() =>
							keepFocus(
								() => onChange(null),
								() => inputRef.current
							)
						}
					>
						Clear selection
					</Button>
				</div>
			) : null}
		</div>
	)
}
