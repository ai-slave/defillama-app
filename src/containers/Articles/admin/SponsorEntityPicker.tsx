import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { ArticleEntitySuggestionItem } from '~/containers/Articles/entitySuggestions'
import type { ResearchSponsorEntityType } from '~/containers/Articles/types'
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'

const ALLOWED_TYPES = new Set<ResearchSponsorEntityType>(['protocol', 'chain', 'cex'])

export type SponsorEntitySelection = ArticleEntitySuggestionItem & {
	entityType: ResearchSponsorEntityType
}

type Props = {
	value: SponsorEntitySelection | null
	onChange: (value: SponsorEntitySelection | null) => void
	placeholder?: string
	inputId?: string
}

export function SponsorEntityPicker({
	value,
	onChange,
	placeholder = 'Search protocols, chains, or CEXs…',
	inputId
}: Props) {
	const [open, setOpen] = useState(false)
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
						id={inputId}
						placeholder={value?.label ?? placeholder}
						autoSelect
						className={`${inputStyles} w-full pr-9 pl-9`}
					/>
					{value ? (
						<button
							type="button"
							onClick={() => onChange(null)}
							aria-label="Clear selected DefiLlama page"
							className="absolute right-2 flex size-6 items-center justify-center rounded-md text-secondary hover:bg-hover-row hover:text-primary"
						>
							<Icon name="x" height={12} width={12} />
						</button>
					) : null}
				</div>
				<Ariakit.ComboboxPopover
					gutter={6}
					sameWidth
					portal
					unmountOnHide
					className="z-50 flex max-h-72 flex-col overflow-auto rounded-lg border border-medium bg-overlay py-1 shadow-md outline-hidden"
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
							className="flex cursor-pointer items-center gap-3 px-3 py-2 text-secondary data-active-item:bg-hover-row data-active-item:text-primary"
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
				</Ariakit.ComboboxPopover>
			</Ariakit.ComboboxProvider>
			{value ? (
				<p className="body-sm text-secondary">
					Selected <span className="label-sm text-primary">{value.route}</span>
				</p>
			) : null}
		</div>
	)
}
