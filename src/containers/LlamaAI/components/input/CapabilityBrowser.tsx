import * as Ariakit from '@ariakit/react'
import { useId } from 'react'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { CAPABILITIES } from '~/containers/LlamaAI/capabilities'
import { useMedia } from '~/hooks/useMedia'
import { Icon } from '~/ui/Icon'
import { DrawerDismiss, PopoverSurface } from '~/ui/PopoverSurface'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const CATEGORY_OPTIONS = CAPABILITIES.map(({ key, name }) => ({ key, name }))

interface CapabilityBrowserProps {
	onPromptSelect: (prompt: string, categoryKey?: string) => void
}

export function CapabilityBrowser({ onPromptSelect }: CapabilityBrowserProps) {
	const isMobile = useMedia('(max-width: 639px)')

	return (
		<PopoverSurface
			variant="list"
			aria-label="Explore AI capabilities"
			modal={isMobile}
			gutter={8}
			flip
			dismiss="own"
			className="w-[600px] overflow-hidden"
		>
			<BrowserContent onPromptSelect={onPromptSelect} />
		</PopoverSurface>
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
	const isMobile = useMedia('(max-width: 639px)')
	const tabs = Ariakit.useTabStore({
		defaultSelectedId: `${id}-${CAPABILITIES[0].key}`,
		selectOnMove: true,
		orientation: 'both'
	})
	const selectedId = Ariakit.useStoreState(tabs, 'selectedId')
	const activeCategory = CAPABILITIES.find((c) => `${id}-${c.key}` === selectedId) ?? CAPABILITIES[0]

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
				<div className="flex shrink-0 items-center justify-between px-3 py-1 sm:hidden">
					<span className="label-md text-primary">Explore</span>
					<DrawerDismiss label="Close Explore" />
				</div>
			) : null}

			<div className="flex min-h-0 flex-1 flex-col sm:flex-row">
				{isMobile ? (
					<div className="shrink-0 border-b border-subtle p-3">
						<SelectWithCombobox
							allValues={CATEGORY_OPTIONS}
							selectedValues={[activeCategory.key]}
							setSelectedValues={([key]) => {
								tabs.setSelectedId(`${id}-${key}`)
								trackUmamiEvent('llamaai-capability-category-view', { category: key })
							}}
							singleSelect
							label="Category"
							labelType="regular"
							variant="filter"
							size="md"
							visibleOptionLimit={null}
							searchPlaceholder="Search categories…"
							emptyLabel="No matching categories"
							className="w-full"
						/>
					</div>
				) : null}
				<Ariakit.TabList
					aria-label="Capability categories"
					className="hidden shrink-0 sm:flex sm:w-48 sm:flex-col sm:gap-0.5 sm:overflow-y-auto sm:overscroll-contain sm:border-r sm:border-subtle sm:bg-page sm:p-1.5"
				>
					{CAPABILITIES.map((cap) => (
						<Ariakit.Tab
							key={cap.key}
							id={`${id}-${cap.key}`}
							onClick={() => {
								trackUmamiEvent('llamaai-capability-category-view', { category: cap.key })
							}}
							className="group hover-wash flex shrink-0 items-center gap-2 rounded-lg border border-medium px-3 py-1.5 label-sm whitespace-nowrap text-secondary not-disabled:not-aria-disabled:hover:text-primary aria-selected:border-brand aria-selected:bg-brand-muted aria-selected:text-link-on-tint sm:border-transparent sm:text-left"
						>
							<Icon name={cap.icon} height={14} width={14} className="shrink-0" />
							<span className="truncate">{cap.name}</span>
							{cap.badge ? (
								<span className="ml-auto shrink-0 rounded-sm bg-brand-muted px-1.5 py-px label-xs tracking-wide text-link-on-tint uppercase">
									{cap.badge}
								</span>
							) : null}
						</Ariakit.Tab>
					))}
				</Ariakit.TabList>

				{/* Content panel */}
				<Ariakit.TabPanel
					tabId={selectedId ?? undefined}
					aria-label={isMobile ? activeCategory.name : undefined}
					className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
				>
					{/* Desktop: category header */}
					<div className="shrink-0 px-4 pt-1 pb-2 sm:border-b sm:border-subtle sm:pt-3 sm:pb-3">
						<div className="hidden items-center gap-2 sm:flex">
							<Icon name={activeCategory.icon} height={14} width={14} className="text-secondary" />
							<h3 className="label-md text-primary">{activeCategory.name}</h3>
							{activeCategory.badge ? (
								<span className="rounded-sm bg-brand-muted px-1.5 py-px label-xs tracking-wide text-link-on-tint uppercase">
									{activeCategory.badge}
								</span>
							) : null}
						</div>
						<p className="mt-1 body-md text-secondary">{activeCategory.description}</p>
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
				className="group flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left not-disabled:not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row"
			>
				<p className="m-0 flex-1 body-md text-primary group-hover:text-primary group-focus-visible:text-primary">
					{prompt}
				</p>
				<Icon
					name="arrow-right"
					height={14}
					width={14}
					className="mt-0.5 shrink-0 text-tertiary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
				/>
			</Ariakit.PopoverDismiss>
		</li>
	)
}
