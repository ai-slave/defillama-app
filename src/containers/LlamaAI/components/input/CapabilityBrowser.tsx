import * as Ariakit from '@ariakit/react'
import { useCallback, useEffect, useId, useRef } from 'react'
import { CAPABILITIES } from '~/containers/LlamaAI/capabilities'
import { useMedia } from '~/hooks/useMedia'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface CapabilityBrowserProps {
	onPromptSelect: (prompt: string, categoryKey?: string) => void
}

export function CapabilityBrowser({ onPromptSelect }: CapabilityBrowserProps) {
	const isMobile = useMedia('(max-width: 640px)')

	return (
		<Ariakit.Popover
			aria-label="Explore AI capabilities"
			portal
			modal={isMobile}
			unmountOnHide
			hideOnInteractOutside
			gutter={8}
			flip
			wrapperProps={{
				className: 'max-sm:fixed! max-sm:bottom-0! max-sm:top-[unset]! max-sm:transform-none! max-sm:w-full!'
			}}
			className="z-50 flex w-[600px] overflow-hidden rounded-xl border border-ai-line-medium bg-ai-surface-card shadow-2xl max-sm:h-[calc(100dvh-80px)] max-sm:w-full max-sm:max-w-full max-sm:drawer max-sm:flex-col max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:border-0 sm:max-h-[min(420px,50vh)] sm:capability-panel"
		>
			<BrowserContent onPromptSelect={onPromptSelect} />
		</Ariakit.Popover>
	)
}

export function BrowserContent({
	onPromptSelect,
	hideDragHandle
}: {
	onPromptSelect: (prompt: string, categoryKey?: string) => void
	hideDragHandle?: boolean
}) {
	const id = useId()
	const tabs = Ariakit.useTabStore({
		defaultSelectedId: `${id}-${CAPABILITIES[0].key}`,
		selectOnMove: true,
		orientation: 'both'
	})
	const selectedId = Ariakit.useStoreState(tabs, 'selectedId')
	const activeCategory = CAPABILITIES.find((c) => `${id}-${c.key}` === selectedId) ?? CAPABILITIES[0]

	const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const handleHoverIntent = useCallback(
		(key: string) => {
			if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
			hoverTimerRef.current = setTimeout(() => {
				tabs.setSelectedId(`${id}-${key}`)
				trackUmamiEvent('llamaai-capability-category-view', { category: key })
			}, 80)
		},
		[id, tabs]
	)
	const cancelHoverIntent = useCallback(() => {
		if (hoverTimerRef.current) {
			clearTimeout(hoverTimerRef.current)
			hoverTimerRef.current = null
		}
	}, [])

	useEffect(() => {
		return () => {
			if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
		}
	}, [])

	const handlePromptClick = (prompt: string) => {
		trackUmamiEvent('llamaai-capability-prompt-click', {
			category: activeCategory.key,
			prompt: prompt.slice(0, 100)
		})
		onPromptSelect(prompt, activeCategory.key)
	}

	return (
		<Ariakit.TabProvider store={tabs}>
			{!hideDragHandle ? (
				<div className="flex items-center justify-between px-3 pt-3 pb-1 sm:hidden">
					<span className="text-[13px] font-semibold text-ai-primary">Explore</span>
					<Ariakit.PopoverDismiss
						aria-label="Close Explore"
						className="flex size-7 items-center justify-center rounded-full bg-ai-surface-muted text-ai-secondary transition-colors hover:bg-ai-skeleton"
					>
						<Icon name="x" height={14} width={14} />
					</Ariakit.PopoverDismiss>
				</div>
			) : null}

			<div className="flex min-h-0 flex-1 flex-col sm:flex-row">
				<Ariakit.TabList
					aria-label="Capability categories"
					onKeyDownCapture={cancelHoverIntent}
					className="flex scrollbar-none shrink-0 gap-1.5 overflow-x-auto px-3 pb-2.5 sm:w-[176px] sm:flex-col sm:gap-0.5 sm:overflow-y-auto sm:overscroll-contain sm:border-r sm:border-ai-line-subtle sm:bg-ai-surface sm:p-1.5"
				>
					{CAPABILITIES.map((cap) => (
						<Ariakit.Tab
							key={cap.key}
							id={`${id}-${cap.key}`}
							onClick={() => {
								cancelHoverIntent()
								trackUmamiEvent('llamaai-capability-category-view', { category: cap.key })
							}}
							onMouseEnter={() => handleHoverIntent(cap.key)}
							onMouseLeave={cancelHoverIntent}
							className="group flex shrink-0 items-center gap-1.5 rounded-full bg-ai-surface-muted px-3 py-1.5 text-left text-xs font-medium whitespace-nowrap text-ai-secondary aria-selected:bg-ai-inverse aria-selected:text-ai-on-inverse sm:gap-2 sm:rounded-lg sm:bg-transparent sm:px-2.5 sm:py-1.75 sm:text-[12.5px] sm:hover:bg-ai-hover sm:hover:text-ai-primary sm:aria-selected:bg-ai-surface-card sm:aria-selected:text-ai-primary sm:aria-selected:shadow-ai-xs"
						>
							<Icon
								name={cap.icon}
								height={13}
								width={13}
								className="shrink-0 opacity-60 group-aria-selected:opacity-90"
							/>
							<span className="truncate">{cap.name}</span>
							{cap.badge ? (
								<span className="ml-auto shrink-0 rounded-sm bg-ai-accent-blue/12 px-1.5 py-px text-[9px] leading-normal font-bold tracking-wide text-ai-accent-blue">
									{cap.badge}
								</span>
							) : null}
						</Ariakit.Tab>
					))}
				</Ariakit.TabList>

				{/* Content panel */}
				<Ariakit.TabPanel
					tabId={selectedId ?? undefined}
					className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
				>
					{/* Desktop: category header */}
					<div className="shrink-0 px-4 pt-1 pb-2 sm:border-b sm:border-ai-line-subtle sm:pt-3.5 sm:pb-3">
						<div className="hidden items-center gap-2 sm:flex">
							<Icon name={activeCategory.icon} height={14} width={14} className="text-ai-tertiary" />
							<h3 className="text-[13px] font-semibold text-ai-primary">{activeCategory.name}</h3>
							{activeCategory.badge ? (
								<span className="rounded-sm bg-ai-accent-blue/12 px-1.5 py-px text-[9px] leading-normal font-bold tracking-wide text-ai-accent-blue">
									{activeCategory.badge}
								</span>
							) : null}
						</div>
						<p className="mt-1 text-xs leading-relaxed text-ai-tertiary">{activeCategory.description}</p>
					</div>

					{/* Prompt list */}
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
						<ul className="flex flex-col p-1.5 max-sm:px-2">
							{activeCategory.prompts.map((prompt) => (
								<PromptItem key={`${activeCategory.key}:${prompt}`} prompt={prompt} onClick={handlePromptClick} />
							))}
							<li aria-hidden="true" className="h-1 shrink-0 max-sm:h-6" />
						</ul>
					</div>
				</Ariakit.TabPanel>
			</div>
		</Ariakit.TabProvider>
	)
}

function PromptItem({ prompt, onClick }: { prompt: string; onClick: (prompt: string) => void }) {
	return (
		<li>
			<Ariakit.PopoverDismiss
				render={<button type="button" />}
				onClick={() => onClick(prompt)}
				className="group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-ai-surface-muted focus-visible:bg-ai-surface-muted"
			>
				<p className="m-0 flex-1 text-[13px] leading-[1.55] text-ai-secondary group-hover:text-ai-primary group-focus-visible:text-ai-primary">
					{prompt}
				</p>
				<Icon
					name="arrow-right"
					height={12}
					width={12}
					className="mt-1 shrink-0 text-ai-muted opacity-0 group-hover:translate-x-0.5 group-hover:text-ai-tertiary group-hover:opacity-100 group-focus-visible:translate-x-0.5 group-focus-visible:text-ai-tertiary group-focus-visible:opacity-100"
				/>
			</Ariakit.PopoverDismiss>
		</li>
	)
}
