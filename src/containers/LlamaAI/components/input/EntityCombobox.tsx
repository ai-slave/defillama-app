import * as Ariakit from '@ariakit/react'
import type { RefObject } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { getAnchorRect } from '~/containers/LlamaAI/utils/entitySuggestions'
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
	matches: EntityMatch[] | undefined
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
		<Ariakit.ComboboxPopover
			store={combobox}
			unmountOnHide
			portal={true}
			flip={true}
			fitViewport
			getAnchorRect={() => {
				const textarea = promptInputRef.current
				if (!textarea) return null
				return getAnchorRect(textarea)
			}}
			className="relative z-50 flex max-h-(--popover-available-height) max-w-[280px] min-w-[100px] flex-col overflow-auto overscroll-contain rounded-lg border border-ai-line bg-page shadow-lg"
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
						className="flex cursor-pointer items-center gap-1.5 border-t border-ai-line px-3 py-2 first:border-t-0 hover:bg-ai-surface-muted focus-visible:bg-ai-surface-muted data-active-item:bg-ai-surface-muted"
					>
						{logo ? <TokenLogo src={logo} alt={`Logo of ${name}`} size={20} /> : null}
						<span className="flex items-center gap-1.5">
							<span className="text-sm font-medium">{name}</span>
							<EntityTypeBadge type={type} />
						</span>
					</Ariakit.ComboboxItem>
				))
			) : (
				<p className="px-3 py-2 text-sm text-ai-tertiary">Loading…</p>
			)}
		</Ariakit.ComboboxPopover>
	)
}

function EntityTypeBadge({ type }: { type: string }) {
	const colorClass =
		type === 'Chain'
			? 'bg-ai-accent-blue text-ai-accent-blue'
			: type === 'Protocol'
				? 'bg-ai-mention text-ai-mention'
				: 'bg-ai-success text-ai-success'

	return <span className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${colorClass}`}>{type}</span>
}
