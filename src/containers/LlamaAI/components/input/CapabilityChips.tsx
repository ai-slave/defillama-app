import * as Ariakit from '@ariakit/react'
import { CapabilityBrowser } from '~/containers/LlamaAI/components/input/CapabilityBrowser'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface CapabilityChipsProps {
	onPromptSelect: (prompt: string, categoryKey?: string) => void
	isPending: boolean
	isStreaming?: boolean
}

export function CapabilityChips({ onPromptSelect, isPending, isStreaming }: CapabilityChipsProps) {
	const disabled = isPending || !!isStreaming
	const popover = Ariakit.usePopoverStore({
		placement: 'bottom-start',
		setOpen: (open) => {
			if (open) trackUmamiEvent('llamaai-capability-chip-click', { category: 'explore' })
		}
	})
	const open = Ariakit.useStoreState(popover, 'open')

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure
				data-walkthrough="explore-button"
				disabled={disabled}
				render={<Button type="button" size="md" variant={open ? 'outline' : 'secondary'} />}
			>
				<Icon name={open ? 'x' : 'layout-grid'} className="size-3.5" />
				Explore
			</Ariakit.PopoverDisclosure>
			<CapabilityBrowser onPromptSelect={onPromptSelect} />
		</Ariakit.PopoverProvider>
	)
}
