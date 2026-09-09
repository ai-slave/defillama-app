import * as Ariakit from '@ariakit/react'
import { BrowserContent } from '~/containers/LlamaAI/components/input/CapabilityBrowser'
import type { AgenticAnswerMode, FactCheckedUsage, ResearchUsage } from '~/containers/LlamaAI/types'
import { Icon } from '~/ui/Icon'
import { nestedPopoverMobileWrapperClassName, nestedMenuHeaderIconButtonStyles } from '~/ui/Popover'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface MobileToolsPopoverProps {
	mode: AgenticAnswerMode
	setMode: (mode: AgenticAnswerMode) => void
	researchUsage?: ResearchUsage | null
	factCheckedUsage?: FactCheckedUsage | null
	onFactCheckedGated?: () => void
	onOpenAlerts?: () => void
	onPromptSelect: (prompt: string, categoryKey?: string) => void
	onImageUploadClick: () => void
	isPending: boolean
	isStreaming?: boolean
	isStopping?: boolean
	walkthroughActive?: boolean
}

const itemClassName =
	'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13.5px] text-ai-secondary transition-colors hover:bg-ai-surface-muted focus-visible:bg-ai-surface-muted data-active-item:bg-ai-surface-muted'

export function MobileToolsPopover({
	mode,
	setMode,
	researchUsage,
	factCheckedUsage,
	onFactCheckedGated,
	onOpenAlerts,
	onPromptSelect,
	onImageUploadClick,
	isPending,
	isStreaming,
	isStopping,
	walkthroughActive
}: MobileToolsPopoverProps) {
	const disabled = isPending || !!isStreaming || !!isStopping
	const menu = Ariakit.useMenuStore({ placement: 'top-start', values: { answerMode: mode } })

	const handlePromptSelect = (prompt: string, categoryKey?: string) => {
		menu.hideAll()
		onPromptSelect(prompt, categoryKey)
	}

	const handleOpenAlerts = () => {
		menu.hideAll()
		trackUmamiEvent('llamaai-alerts-open', { source: 'mobile' })
		onOpenAlerts?.()
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
				className="flex size-7 items-center justify-center rounded-full bg-ai-surface-muted text-ai-secondary transition-colors hover:bg-ai-skeleton hover:text-ai-primary disabled:pointer-events-none disabled:opacity-40 aria-expanded:bg-ai-accent-blue/15 aria-expanded:text-ai-accent-blue @sm:hidden"
			>
				<Icon name="plus" height={16} width={16} />
			</Ariakit.MenuButton>

			<Ariakit.Menu
				portal
				modal={!walkthroughActive}
				unmountOnHide={!walkthroughActive}
				hideOnInteractOutside={!walkthroughActive}
				gutter={8}
				wrapperProps={{
					className: 'max-sm:fixed! max-sm:bottom-0! max-sm:top-[unset]! max-sm:transform-none! max-sm:w-full!'
				}}
				className="z-10 flex flex-col gap-0.5 rounded-xl border border-ai-line-medium bg-ai-surface-card p-1.5 shadow-2xl max-sm:h-[calc(100dvh-80px)] max-sm:drawer max-sm:overflow-auto max-sm:overscroll-contain max-sm:rounded-b-none sm:max-h-[60dvh]"
			>
				<div className="flex items-center justify-between px-3 pt-3 pb-1 sm:hidden">
					{/* <Ariakit.MenuHeading className="text-[13px] font-semibold text-ai-primary">
						Tools
					</Ariakit.MenuHeading> */}
					<Ariakit.MenuDismiss
						aria-label="Close mobile tools"
						className="flex size-7 items-center justify-center rounded-full bg-ai-surface-muted text-ai-secondary transition-colors hover:bg-ai-skeleton"
					>
						<Icon name="x" height={14} width={14} />
					</Ariakit.MenuDismiss>
				</div>

				<Ariakit.MenuItem
					data-walkthrough="mobile-upload-item"
					className={itemClassName}
					hideOnClick={false}
					onClick={handleImageUpload}
				>
					<Icon name="image-plus" height={16} width={16} className="shrink-0 text-ai-tertiary" />
					<span>Upload files</span>
				</Ariakit.MenuItem>

				<Ariakit.MenuSeparator className="mx-2 border-t border-ai-line-subtle" />

				<Ariakit.MenuItemRadio
					className={itemClassName}
					hideOnClick={false}
					name="answerMode"
					value="quick"
					onChange={() => setMode('quick')}
					data-umami-event="llamaai-quick-mode-toggle"
				>
					<Icon name="sparkles" height={16} width={16} className="shrink-0 text-ai-tertiary" />
					<span className="flex-1">Quick</span>
					{mode === 'quick' ? (
						<Icon name="check" height={14} width={14} className="shrink-0 text-ai-accent-blue" />
					) : null}
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
					<Icon name="check" height={16} width={16} className="shrink-0 text-ai-tertiary" />
					<span className="flex-1">Fact-checked</span>
					<span className="flex items-center gap-1.5">
						{factCheckedUsage && factCheckedUsage.limit > 0 && factCheckedUsage.period !== 'unlimited' ? (
							<span className="text-[11px] text-ai-muted">
								{factCheckedUsage.remainingUsage}/{factCheckedUsage.limit}
							</span>
						) : null}
						{mode === 'fact_checked' ? (
							<Icon name="check" height={14} width={14} className="shrink-0 text-ai-accent-blue" />
						) : null}
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
					<Icon name="search" height={16} width={16} className="shrink-0 text-ai-tertiary" />
					<span className="flex-1">Research</span>
					<span className="flex items-center gap-1.5">
						{researchUsage && researchUsage.limit > 0 && researchUsage.period !== 'unlimited' ? (
							<span className="text-[11px] text-ai-muted">
								{researchUsage.remainingUsage}/{researchUsage.limit}
							</span>
						) : null}
						{mode === 'research' ? (
							<Icon name="check" height={14} width={14} className="shrink-0 text-ai-accent-blue" />
						) : null}
					</span>
				</Ariakit.MenuItemRadio>

				<Ariakit.MenuSeparator className="mx-2 border-t border-ai-line-subtle" />

				<Ariakit.PopoverProvider placement="right-start">
					<Ariakit.PopoverDisclosure
						render={<Ariakit.MenuItem hideOnClick={false} />}
						role="menuitem"
						data-walkthrough="mobile-explore-item"
						className={itemClassName}
					>
						<Icon name="layout-grid" height={16} width={16} className="shrink-0 text-ai-tertiary" />
						<span className="flex-1">Explore</span>
						<Icon name="chevron-right" className="size-4" />
					</Ariakit.PopoverDisclosure>
					<Ariakit.Popover
						modal
						portal
						unmountOnHide
						aria-label="Explore AI capabilities"
						wrapperProps={{ className: nestedPopoverMobileWrapperClassName }}
						className="z-20 flex h-[calc(100dvh-80px)] max-h-dvh w-full flex-col overflow-hidden rounded-t-xl border border-ai-line-medium bg-ai-surface-card p-2 shadow-2xl max-sm:drawer-to-left sm:h-[420px] sm:w-[600px] sm:max-w-[calc(100vw-2rem)] sm:rounded-xl"
					>
						<div className="grid min-h-12 grid-cols-[2.5rem_1fr_2.5rem] items-center px-2 py-1">
							<Ariakit.PopoverDismiss aria-label="Back to mobile tools" className={nestedMenuHeaderIconButtonStyles}>
								<Icon name="chevron-left" className="size-4" />
							</Ariakit.PopoverDismiss>
							<span className="text-center label-md text-ai-primary">Explore</span>
							<Ariakit.PopoverDismiss
								aria-label="Close mobile tools"
								onClick={() => menu.hideAll()}
								className={nestedMenuHeaderIconButtonStyles}
							>
								<Icon name="x" className="size-4" />
							</Ariakit.PopoverDismiss>
						</div>
						<BrowserContent onPromptSelect={handlePromptSelect} hideDragHandle />
					</Ariakit.Popover>
				</Ariakit.PopoverProvider>

				{onOpenAlerts ? (
					<Ariakit.MenuItem
						data-walkthrough="mobile-alerts-item"
						className={itemClassName}
						hideOnClick={false}
						onClick={handleOpenAlerts}
					>
						<Icon name="calendar-plus" height={16} width={16} className="shrink-0 text-ai-warning-bright" />
						<span>Alerts</span>
					</Ariakit.MenuItem>
				) : null}
			</Ariakit.Menu>
		</Ariakit.MenuProvider>
	)
}
