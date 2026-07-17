import * as Ariakit from '@ariakit/react'
import { Icon } from '~/components/Icon'
import { CapabilityBrowser } from '~/containers/LlamaAI/components/input/CapabilityBrowser'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface CapabilityChipsProps {
	onPromptSelect: (prompt: string, categoryKey?: string) => void
	isPending: boolean
	isStreaming?: boolean
}

export function CapabilityChips({ onPromptSelect, isPending, isStreaming }: CapabilityChipsProps) {
	const disabled = isPending || !!isStreaming

	return (
		<Ariakit.PopoverProvider
			placement="bottom-start"
			setOpen={(open) => {
				if (open) trackUmamiEvent('llamaai-capability-chip-click', { category: 'explore' })
			}}
		>
			<Ariakit.PopoverDisclosure
				data-walkthrough="explore-button"
				disabled={disabled}
				className="group flex h-7 items-center justify-center gap-1 rounded-md bg-ai-blue/8 px-2 text-ai-blue/70 transition-colors duration-150 hover:bg-ai-blue/15 hover:text-ai-blue disabled:pointer-events-none disabled:opacity-40 aria-expanded:bg-ai-blue/15 aria-expanded:text-ai-blue"
			>
				<Icon name="layout-grid" height={14} width={14} className="group-aria-expanded:hidden" />
				<Icon name="x" height={14} width={14} className="hidden group-aria-expanded:block" />
				<span className="text-xs font-medium">Explore</span>
			</Ariakit.PopoverDisclosure>
			<CapabilityBrowser onPromptSelect={onPromptSelect} />
		</Ariakit.PopoverProvider>
	)
}
