import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { ArticleEntitySuggestionItem } from '~/containers/Articles/entitySuggestions'
import type { ResearchSponsorEntityType } from '~/containers/Articles/types'
import { Button } from '~/ui/Button'
import type { FieldControlProps } from '~/ui/Field'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'
import { popoverMeasuredRowStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'

const ALLOWED_TYPES = new Set<ResearchSponsorEntityType>(['protocol', 'chain', 'cex'])

export type SponsorEntitySelection = ArticleEntitySuggestionItem & {
	entityType: ResearchSponsorEntityType
}

/** The search box of a Field (~/ui/Field): `control` carries the label's id and the error wiring. */
export function SponsorEntityPicker({
	value,
	onChange,
	...control
}: FieldControlProps & {
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
			if (!response.ok) throw new Error('Failed to search DefiLlama pages')
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
				<div className="relative flex items-center">
					<Icon name="search" height={14} width={14} className="pointer-events-none absolute left-3 text-tertiary" />
					<Ariakit.Combobox
						ref={inputRef}
						{...control}
						placeholder={value?.label ?? 'Search protocols, chains, or CEXs…'}
						autoSelect
						className={`${inputStyles} w-full pr-9 pl-9`}
					/>
					{value ? (
						<Button
							variant="ghost"
							size="sm"
							square
							onClick={() =>
								keepFocus(
									() => onChange(null),
									() => inputRef.current
								)
							}
							aria-label="Clear selected DefiLlama page"
							className="absolute right-2"
						>
							<Icon name="x" className="size-4" />
						</Button>
					) : null}
				</div>
				<ComboboxSurface
					variant="search-results"
					sameWidth
					className="max-h-[min(288px,var(--popover-available-height))]"
				>
					{query.length === 0 ? <p className="p-3 body-sm text-tertiary">Type a page name to search.</p> : null}
					{query.length > 0 && isFetching && items.length === 0 ? (
						<p className="p-3 body-sm text-tertiary">Searching…</p>
					) : null}
					{query.length > 0 && !isFetching && items.length === 0 ? (
						<p className="p-3 body-sm text-tertiary">No matching protocol, chain, or CEX page.</p>
					) : null}
					{items.map((item) => (
						<Ariakit.ComboboxItem
							key={`${item.entityType}:${item.slug}`}
							value={item.label}
							setValueOnClick={false}
							onClick={() => {
								onChange(item)
								setSearchValue('')
								setOpen(false)
							}}
							className={popoverMeasuredRowStyles}
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
						</Ariakit.ComboboxItem>
					))}
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
			{value ? (
				<p className="body-sm text-secondary">
					Selected <span className="label-sm text-primary">{value.route}</span>
				</p>
			) : null}
		</div>
	)
}
