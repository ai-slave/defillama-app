import * as Ariakit from '@ariakit/react'
import type { RefObject } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { getAnchorRect } from '~/containers/LlamaAI/utils/entitySuggestions'
import { popoverMenuItemStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { LoadingIndicator } from '~/ui/Status'
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
			className="max-w-[280px]"
		>
			{hasMatches && matches ? (
				matches.map(({ id, name, logo, type }) => (
					<Ariakit.ComboboxItem
						key={id}
						value={id}
						focusOnHover
						onClick={() => {
							trackUmamiEvent('llamaai-entity-select', { type })
							onItemClick({ id, name, type })
						}}
						className={`${popoverMenuItemStyles} border-t border-subtle first:border-t-0`}
					>
						{logo ? <TokenLogo src={logo} alt={`Logo of ${name}`} size={20} /> : null}
						<span className="flex items-center gap-1.5">
							<span className="font-medium">{name}</span>
							<Tag>{type}</Tag>
						</span>
					</Ariakit.ComboboxItem>
				))
			) : (
				<div role="status" aria-live="polite" className="px-3 py-2">
					<LoadingIndicator />
				</div>
			)}
		</ComboboxSurface>
	)
}
