import * as Ariakit from '@ariakit/react'
import type { RefObject } from 'react'
import { getAnchorRect } from '~/containers/LlamaAI/utils/entitySuggestions'
import { Logo } from '~/ui/Logo'
import { ListLoading } from '~/ui/NoResults'
import { ComboboxSurface, PopoverList, PopoverRow } from '~/ui/PopoverSurface'
import { Tag } from '~/ui/Tag'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface EntityMatch {
	id: string
	name: string
	logo?: string | null
	type: string
}

interface EntityComboboxPopoverProps {
	combobox: Ariakit.ComboboxStore
	promptInputRef: RefObject<HTMLTextAreaElement | null>
	matches: Array<EntityMatch> | undefined
	hasMatches: boolean
	isTriggerOnly: boolean
	isLoading: boolean
	isFetching: boolean
	onItemClick: (entity: { id: string; name: string; type: string }) => void
}

export function EntityComboboxPopover({
	combobox,
	promptInputRef,
	matches,
	hasMatches,
	isTriggerOnly,
	isLoading,
	isFetching,
	onItemClick
}: EntityComboboxPopoverProps) {
	const shouldShow = hasMatches || (isTriggerOnly && (isLoading || isFetching))

	if (!shouldShow) return null

	return (
		<ComboboxSurface
			variant="search-results"
			store={combobox}
			flip
			fitViewport
			getAnchorRect={() => {
				const textarea = promptInputRef.current
				if (!textarea) return null
				return getAnchorRect(textarea)
			}}
			width="md"
		>
			{hasMatches && matches ? (
				<PopoverList divided>
					{matches.map(({ id, name, logo, type }) => (
						<PopoverRow
							key={id}
							render={<Ariakit.ComboboxItem value={id} focusOnHover />}
							onClick={() => {
								trackUmamiEvent('llamaai-entity-select', { type })
								onItemClick({ id, name, type })
							}}
						>
							{logo ? <Logo src={logo} alt={`Logo of ${name}`} size={20} /> : null}
							<span className="flex items-center gap-1.5">
								<span className="font-medium">{name}</span>
								<Tag>{type}</Tag>
							</span>
						</PopoverRow>
					))}
				</PopoverList>
			) : (
				<ListLoading label="Loading suggestions" />
			)}
		</ComboboxSurface>
	)
}
