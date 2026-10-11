import * as Ariakit from '@ariakit/react'
import { BrowserContent } from '~/containers/LlamaAI/components/input/CapabilityBrowser'
import { ModeUsage } from '~/containers/LlamaAI/components/input/ModeToggle'
import type { AgenticAnswerMode, FactCheckedUsage, ResearchUsage } from '~/containers/LlamaAI/types'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { MenuSurface } from '~/ui/MenuSurface'
import { popoverMenuItemStyles } from '~/ui/Popover'
import { NestedDrawerHeader, PopoverSurface } from '~/ui/PopoverSurface'

interface MobileToolsPopoverProps {
	mode: AgenticAnswerMode
	setMode: (mode: AgenticAnswerMode) => void
	researchUsage?: ResearchUsage | null
	factCheckedUsage?: FactCheckedUsage | null
	onFactCheckedGated?: () => void
	onPromptSelect: (prompt: string, categoryKey?: string) => void
	onImageUploadClick: () => void
	isPending: boolean
	isStreaming?: boolean
	isStopping?: boolean
	walkthroughActive?: boolean
}

const itemClassName = `${popoverMenuItemStyles} w-full gap-3 text-left`

export function MobileToolsPopover({
	mode,
	setMode,
	researchUsage,
	factCheckedUsage,
	onFactCheckedGated,
	onPromptSelect,
	onImageUploadClick,
	isPending,
	isStreaming,
	isStopping,
	walkthroughActive
}: MobileToolsPopoverProps) {
	const disabled = isPending || !!isStreaming || !!isStopping
	const menu = Ariakit.useMenuStore({ placement: 'top-start', values: { answerMode: mode } })
	const open = Ariakit.useStoreState(menu, 'open')

	const handlePromptSelect = (prompt: string, categoryKey?: string) => {
		menu.hideAll()
		onPromptSelect(prompt, categoryKey)
	}

	const handleImageUpload = () => {
		menu.hideAll()
		onImageUploadClick()
	}

	return (
		<Ariakit.MenuProvider store={menu}>
			<Ariakit.MenuButton
				data-walkthrough="mobile-tools-button"
				disabled={disabled}
				aria-label="Open mobile tools"
				render={
					<Button type="button" size="md" variant={open ? 'outline' : 'secondary'} square className="@sm:hidden" />
				}
			>
				<Icon name="plus" className="size-4" />
			</Ariakit.MenuButton>

			<MenuSurface
				variant="actions"
				modal={!walkthroughActive}
				unmountOnHide={!walkthroughActive}
				hideOnInteractOutside={!walkthroughActive}
				// The tour opens this drawer under its own card. Marked as outside the drawer, the card would ignore Escape
				// while the drawer ignores a key pressed in the card, so the tour's layer counts as part of the drawer.
				getPersistentElements={() => document.querySelectorAll('[data-walkthrough="tour-layer"]')}
			>
				<Ariakit.MenuItem
					data-walkthrough="mobile-upload-item"
					className={itemClassName}
					hideOnClick={false}
					onClick={handleImageUpload}
				>
					<Icon name="paperclip" className="size-4 shrink-0 text-secondary" />
					<span>Upload files</span>
				</Ariakit.MenuItem>

				<Ariakit.MenuSeparator className="border-t border-subtle" />

				<Ariakit.MenuItemRadio
					className={itemClassName}
					hideOnClick={false}
					name="answerMode"
					value="quick"
					onChange={() => setMode('quick')}
					data-umami-event="llamaai-quick-mode-toggle"
				>
					<Icon name="sparkles" className="size-4 shrink-0 text-secondary" />
					<span className="flex-1">Quick</span>
					{mode === 'quick' ? <Icon name="check" className="size-3.5 shrink-0 text-link" /> : null}
				</Ariakit.MenuItemRadio>

				<Ariakit.MenuItemRadio
					className={itemClassName}
					hideOnClick={false}
					name="answerMode"
					value="fact_checked"
					onChange={(event) => {
						if (factCheckedUsage?.period === 'blocked') {
							event.preventDefault()
							onFactCheckedGated?.()
							return
						}
						setMode('fact_checked')
					}}
					data-umami-event="llamaai-fact-checked-mode-toggle"
				>
					<Icon name="check" className="size-4 shrink-0 text-secondary" />
					<span className="flex-1">Fact-checked</span>
					<span className="flex items-center gap-1.5">
						<ModeUsage usage={factCheckedUsage} feature="fact_checked" />
						{mode === 'fact_checked' ? <Icon name="check" className="size-3.5 shrink-0 text-link" /> : null}
					</span>
				</Ariakit.MenuItemRadio>

				<Ariakit.MenuItemRadio
					data-walkthrough="mobile-research-item"
					className={itemClassName}
					hideOnClick={false}
					name="answerMode"
					value="research"
					onChange={() => setMode('research')}
					data-umami-event="llamaai-research-mode-toggle"
				>
					<Icon name="search" className="size-4 shrink-0 text-secondary" />
					<span className="flex-1">Research</span>
					<span className="flex items-center gap-1.5">
						<ModeUsage usage={researchUsage} feature="research" />
						{mode === 'research' ? <Icon name="check" className="size-3.5 shrink-0 text-link" /> : null}
					</span>
				</Ariakit.MenuItemRadio>

				<Ariakit.MenuSeparator className="border-t border-subtle" />

				{/* Scoped to the menu content, so closing the menu unmounts it and each open starts at the root. */}
				<Ariakit.PopoverProvider placement="right-start">
					<Ariakit.PopoverDisclosure
						render={<Ariakit.MenuItem hideOnClick={false} />}
						role="menuitem"
						data-walkthrough="mobile-explore-item"
						className={itemClassName}
					>
						<Icon name="layout-grid" className="size-4 shrink-0 text-secondary" />
						<span className="flex-1">Explore</span>
						<Icon name="chevron-right" className="size-4" />
					</Ariakit.PopoverDisclosure>
					<PopoverSurface
						variant="nested"
						gutter={4}
						modal
						aria-label="Explore AI capabilities"
						className="overflow-hidden sm:w-[600px] sm:max-w-[calc(100vw-2rem)]"
					>
						<ExploreHeader onCloseTools={menu.hideAll} />
						<BrowserContent onPromptSelect={handlePromptSelect} hideDragHandle />
					</PopoverSurface>
				</Ariakit.PopoverProvider>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}

function ExploreHeader({ onCloseTools }: { onCloseTools: () => void }) {
	const explore = Ariakit.usePopoverContext()!
	return (
		<NestedDrawerHeader
			title="Explore"
			backLabel="Back to mobile tools"
			onBack={explore.hide}
			closeLabel="Close mobile tools"
			onClose={() => {
				explore.hide()
				onCloseTools()
			}}
			visibleFromSm
		/>
	)
}
