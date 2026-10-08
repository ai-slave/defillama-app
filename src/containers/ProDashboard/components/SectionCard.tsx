import { useId } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tooltip } from '~/ui/Tooltip'
import { SECTION_DESCRIPTION_MAX_LENGTH, SECTION_TITLE_MAX_LENGTH, type SectionConfig } from '../types'
import { InlineTextField, ProMeta } from '../ui'
import { keepKeyboardEventsInsideCard } from './ProCardActions'

let tabsExplainerShown = false

function explainTabsOnce() {
	if (tabsExplainerShown) return
	tabsExplainerShown = true
	toast('Cards above the first tab stay visible on every tab', {
		id: 'tabs-explainer',
		duration: 8000,
		ariaProps: { role: 'status', 'aria-live': 'polite' }
	})
}

export type SectionPatch = {
	title?: string
	description?: string
	displayAs?: SectionConfig['displayAs']
	collapsed?: boolean
}

const DISPLAY_AS_OPTIONS = [
	{ value: 'heading' as const, label: 'Heading' },
	{ value: 'tab' as const, label: 'Tab' }
]

const SECTION_CONTROLS_CLASS =
	'flex shrink-0 flex-wrap items-center gap-1 opacity-0 transition-opacity group-focus-within/section:opacity-100 group-hover/section:opacity-100 group-data-[arrived=true]/dashboard-section:opacity-100 has-[[aria-expanded=true]]:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100'

export interface SectionCardProps {
	section: SectionConfig
	itemCount: number
	collapsed: boolean
	onToggleCollapsed: () => void
	contentId: string
	flushTop?: boolean
	editing?: {
		autoFocusTitle: boolean
		onUpdate: (patch: SectionPatch) => void
		onMove: (direction: -1 | 1) => void
		canMoveUp: boolean
		canMoveDown: boolean
		onDelete: () => void
		onAddSectionBelow: () => void
	}
}

export function SectionCard({
	section,
	itemCount,
	collapsed,
	onToggleCollapsed,
	contentId,
	flushTop = false,
	editing
}: SectionCardProps) {
	const headingId = useId()
	const isTab = section.displayAs === 'tab'
	return (
		<div
			className={`group/section flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-1 ${flushTop ? 'pt-1' : 'pt-4'}`}
			data-section-id={section.id}
			data-testid="dashboard-section"
		>
			{!isTab ? (
				<Tooltip
					content={collapsed ? 'Expand section' : 'Collapse section'}
					render={
						<Button
							size="sm"
							square
							variant="ghost"
							aria-expanded={!collapsed}
							aria-controls={contentId}
							aria-label={collapsed ? 'Expand section' : 'Collapse section'}
							onClick={onToggleCollapsed}
						/>
					}
				>
					<Icon
						name="chevron-down"
						height={16}
						width={16}
						className={`transition-[rotate] duration-180 ease-out-quart ${collapsed ? '-rotate-90' : ''}`}
					/>
				</Tooltip>
			) : null}
			<div className="flex min-w-48 flex-col">
				{editing ? (
					<InlineTextField
						value={section.title}
						placeholder="Section title"
						maxLength={SECTION_TITLE_MAX_LENGTH}
						autoFocus={editing.autoFocusTitle}
						className="title-lg text-pro-text-primary"
						onCommit={(title) => editing.onUpdate({ title: title || 'Section' })}
					/>
				) : (
					<h2 id={headingId} className="truncate title-lg text-pro-text-primary">
						{section.title}
					</h2>
				)}
				{editing ? (
					<InlineTextField
						value={section.description ?? ''}
						placeholder="Add a description"
						maxLength={SECTION_DESCRIPTION_MAX_LENGTH}
						className="text-sm text-pro-text-secondary"
						onCommit={(description) => editing.onUpdate({ description })}
					/>
				) : section.description ? (
					<p className="text-sm text-pro-text-secondary">{section.description}</p>
				) : null}
			</div>
			<div aria-hidden="true" className="h-px min-w-6 flex-1 bg-pro-cards-border" />
			<ProMeta className="shrink-0 tabular-nums" items={[`${itemCount} ${itemCount === 1 ? 'card' : 'cards'}`]} />
			{editing ? (
				<div role="presentation" onKeyDown={keepKeyboardEventsInsideCard} className={SECTION_CONTROLS_CLASS}>
					<Tooltip
						content={
							isTab
								? 'Show as heading'
								: 'Show as tab. Cards above the first tab become a shared header shown on every tab.'
						}
						data-umami-event={isTab ? 'dashboard-section-to-heading' : 'dashboard-section-to-tab'}
					>
						<SegmentedControl<NonNullable<SectionConfig['displayAs']>>
							variant="default"
							size="sm"
							label="Section display"
							options={DISPLAY_AS_OPTIONS}
							value={isTab ? 'tab' : 'heading'}
							onValueChange={(displayAs) => {
								if ((displayAs === 'tab') === isTab) return
								if (displayAs === 'tab') explainTabsOnce()
								editing.onUpdate({ displayAs })
							}}
						/>
					</Tooltip>
					<Tooltip
						content="Move section up"
						render={
							<Button
								size="sm"
								square
								variant="ghost"
								aria-label="Move section up"
								disabled={!editing.canMoveUp}
								accessibleWhenDisabled
								onClick={() => editing.onMove(-1)}
							/>
						}
					>
						<Icon name="chevron-up" height={16} width={16} />
					</Tooltip>
					<Tooltip
						content="Move section down"
						render={
							<Button
								size="sm"
								square
								variant="ghost"
								aria-label="Move section down"
								disabled={!editing.canMoveDown}
								accessibleWhenDisabled
								onClick={() => editing.onMove(1)}
							/>
						}
					>
						<Icon name="chevron-down" height={16} width={16} />
					</Tooltip>
					<Tooltip
						content="Add section below"
						render={
							<Button
								size="sm"
								square
								variant="ghost"
								aria-label="Add section below"
								onClick={editing.onAddSectionBelow}
								data-umami-event="dashboard-section-add"
							/>
						}
					>
						<Icon name="plus" height={16} width={16} />
					</Tooltip>
					<Tooltip
						content="Remove section (cards stay)"
						render={
							<Button
								size="sm"
								square
								variant="ghostDestructive"
								aria-label="Delete section"
								onClick={editing.onDelete}
							/>
						}
					>
						<Icon name="trash-2" height={16} width={16} />
					</Tooltip>
				</div>
			) : null}
		</div>
	)
}
