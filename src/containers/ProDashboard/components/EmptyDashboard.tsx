import type { ComponentProps } from 'react'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { EmptyState } from '~/ui/Status'
import { ProButton } from '../ui'

interface EmptyDashboardProps {
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

export function EmptyDashboard({ onAddChart, onGenerateWithAI, isReadOnly = false, editHref }: EmptyDashboardProps) {
	const showAIGeneration = onGenerateWithAI && !isReadOnly

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-6">
			<EmptyState
				size="lg"
				icon="bar-chart-2"
				title={isReadOnly ? 'This dashboard is empty' : 'No cards yet'}
				framed
				className="w-full flex-none"
				actions={
					isReadOnly ? (
						editHref ? (
							<ProButton as={BasicLink} href={editHref} size="md" variant="primary">
								<Icon name="pencil" className="size-3.5" />
								Edit dashboard
							</ProButton>
						) : (
							<Button as={BasicLink} href="/pro?tab=discover" size="md" variant="secondary">
								Browse dashboards
							</Button>
						)
					) : (
						<>
							<ProButton type="button" size="md" variant="primary" onClick={onAddChart}>
								<Icon name="plus" className="size-3.5" />
								Add your first card
							</ProButton>
							{showAIGeneration ? (
								<ProButton type="button" size="md" variant="ai" onClick={onGenerateWithAI}>
									<Icon name="sparkles" className="size-3.5" />
									Generate with LlamaAI
								</ProButton>
							) : null}
						</>
					)
				}
			>
				{isReadOnly
					? editHref
						? 'Switch to editing to add charts, tables, metrics or text.'
						: "The author hasn't added any cards yet."
					: showAIGeneration
						? 'Add charts, tables, metrics or text — or let LlamaAI draft the first version.'
						: 'Add charts, tables, metrics or text.'}
			</EmptyState>
			{!isReadOnly ? (
				<ul aria-label="What you can add next" className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
					{EDITOR_HINTS.map((hint) => (
						<li
							key={hint.title}
							className="flex flex-col gap-1 rounded-lg border border-subtle bg-surface-elevated-1 p-3 text-left"
						>
							<span className="flex items-center gap-2 label-md text-primary">
								<Icon name={hint.icon} className="size-4 text-secondary" />
								{hint.title}
							</span>
							<span className="body-sm text-tertiary">{hint.description}</span>
						</li>
					))}
				</ul>
			) : null}
		</div>
	)
}
