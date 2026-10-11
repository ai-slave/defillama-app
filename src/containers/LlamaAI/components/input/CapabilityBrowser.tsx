import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { CAPABILITIES } from '~/containers/LlamaAI/capabilities'
import { useMedia } from '~/hooks/useMedia'
import { Icon } from '~/ui/Icon'
import { DrawerDismiss, PopoverSurface } from '~/ui/PopoverSurface'
import { Tab, TabPanel, Tabs } from '~/ui/Tabs'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { RAIL_TAB } from '../tabRailStyles'

const CATEGORY_OPTIONS = CAPABILITIES.map(({ key, name }) => ({ key, name }))
const CATEGORY_KEYS = CAPABILITIES.map(({ key }) => key)

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
	const isMobile = useMedia('(max-width: 639px)')
	const [categoryKey, setCategoryKey] = useState(CAPABILITIES[0].key)
	const activeCategory = CAPABILITIES.find((c) => c.key === categoryKey)!

	const handlePromptClick = (prompt: string) => {
		trackUmamiEvent('llamaai-capability-prompt-click', {
			category: activeCategory.key,
			prompt: prompt.slice(0, 100)
		})
		onPromptSelect(prompt, activeCategory.key)
	}

	return (
		<Tabs value={categoryKey} onValueChange={setCategoryKey} values={CATEGORY_KEYS} selectOnMove orientation="vertical">
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
								setCategoryKey(key)
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
					className="hidden shrink-0 sm:flex sm:w-48 sm:flex-col sm:gap-0.5 sm:overflow-y-auto sm:overscroll-contain sm:border-r sm:border-subtle sm:bg-page sm:p-2"
				>
					{CAPABILITIES.map((cap) => (
						<Tab
							key={cap.key}
							value={cap.key}
							onClick={() => {
								trackUmamiEvent('llamaai-capability-category-view', { category: cap.key })
							}}
							className={RAIL_TAB}
						>
							<Icon name={cap.icon} className="size-3.5 shrink-0" />
							<span className="truncate">{cap.name}</span>
							{cap.badge ? (
								<span className="ml-auto shrink-0 rounded-sm bg-brand-muted px-1.5 py-px label-xs tracking-wide text-link uppercase">
									{cap.badge}
								</span>
							) : null}
						</Tab>
					))}
				</Ariakit.TabList>

				{/* Content panel */}
				<TabPanel
					value={categoryKey}
					aria-label={isMobile ? activeCategory.name : undefined}
					className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
				>
					{/* Desktop: category header */}
					<div className="shrink-0 px-4 pt-1 pb-2 sm:border-b sm:border-subtle sm:pt-3 sm:pb-3">
						<div className="hidden items-center gap-2 sm:flex">
							<Icon name={activeCategory.icon} className="size-3.5 text-secondary" />
							<h3 className="label-md text-primary">{activeCategory.name}</h3>
							{activeCategory.badge ? (
								<span className="rounded-sm bg-brand-muted px-1.5 py-px label-xs tracking-wide text-link uppercase">
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
				</TabPanel>
			</div>
		</Tabs>
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
				<span className="flex h-lh shrink-0 items-center body-md">
					<Icon
						name="arrow-right"
						className="size-3.5 text-tertiary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
					/>
				</span>
			</Ariakit.PopoverDismiss>
		</li>
	)
}
