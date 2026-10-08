import type { ComponentProps } from 'react'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { ProButton } from '../ui'

interface EmptyStateProps {
	onAddChart: () => void
	onGenerateWithAI?: () => void
	isReadOnly?: boolean
	editHref?: string
}

const EDITOR_HINTS: ReadonlyArray<{
	icon: ComponentProps<typeof Icon>['name']
	title: string
	description: string
}> = [
	{
		icon: 'layout-grid',
		title: 'Sections & tabs',
		description: 'Group cards, or split the dashboard into tabs'
	},
	{
		icon: 'chain',
		title: 'Parameters',
		description: 'Let viewers switch the chain or protocol across connected cards'
	},
	{
		icon: 'share',
		title: 'Share & embed',
		description: 'Public dashboards get a share link, a link preview and embed code'
	}
]

export function EmptyState({ onAddChart, onGenerateWithAI, isReadOnly = false, editHref }: EmptyStateProps) {
	const showAIGeneration = onGenerateWithAI && !isReadOnly

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg px-1 py-12">
			<Icon name="bar-chart-2" height={48} width={48} className="text-pro-text-label" />
			<h1 className="heading-lg">{isReadOnly ? 'This dashboard is empty' : 'No cards yet'}</h1>
			<p className="max-w-lg text-center body-lg text-pro-text-label">
				{isReadOnly
					? editHref
						? 'Switch to editing to add charts, tables, metrics or text.'
						: "The author hasn't added any cards yet."
					: showAIGeneration
						? 'Add charts, tables, metrics or text — or let LlamaAI draft the first version.'
						: 'Add charts, tables, metrics or text.'}
			</p>
			{isReadOnly ? (
				<div className="mt-7">
					{editHref ? (
						<ProButton as={BasicLink} href={editHref} size="lg" variant="primary">
							<Icon name="pencil" height={20} width={20} />
							Edit dashboard
						</ProButton>
					) : (
						<Button as={BasicLink} href="/pro?tab=discover" size="md" variant="secondary">
							Browse dashboards
						</Button>
					)}
				</div>
			) : null}
			{!isReadOnly ? (
				<div className="mt-7 flex flex-col justify-center gap-4 sm:flex-row">
					<ProButton type="button" size="lg" variant="primary" onClick={onAddChart}>
						<Icon name="plus" height={20} width={20} />
						Add your first card
					</ProButton>
					{showAIGeneration ? (
						<ProButton type="button" size="lg" variant="ai" onClick={onGenerateWithAI}>
							<Icon name="sparkles" height={20} width={20} />
							Generate with LlamaAI
						</ProButton>
					) : null}
				</div>
			) : null}
			{!isReadOnly ? (
				<ul aria-label="What you can add next" className="mt-10 grid w-full max-w-3xl gap-3 px-4 sm:grid-cols-3">
					{EDITOR_HINTS.map((hint) => (
						<li
							key={hint.title}
							className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-surface-elevated-1/45 p-3 text-left"
						>
							<span className="flex items-center gap-2 label-md text-pro-text-primary">
								<Icon name={hint.icon} height={16} width={16} className="text-pro-text-label" />
								{hint.title}
							</span>
							<span className="body-sm text-pro-text-tertiary">{hint.description}</span>
						</li>
					))}
				</ul>
			) : null}
		</div>
	)
}
