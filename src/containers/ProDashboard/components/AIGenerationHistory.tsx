import { Card } from '~/ui/Card'
import { DisclosureChevron } from '~/ui/DisclosureChevron'
import { Icon } from '~/ui/Icon'
import { formatDateTime } from '~/utils/dateFormat'
import type { AIGeneratedData } from '../dashboardTypes'

interface AIGenerationHistoryProps {
	aiGenerated: AIGeneratedData
}

export function AIGenerationHistory({ aiGenerated }: AIGenerationHistoryProps) {
	const sessions: Array<AIGeneratedData[string] & { sessionId: string }> = []
	for (const sessionId in aiGenerated) {
		const data = aiGenerated[sessionId]
		if (data !== undefined) sessions.push({ sessionId, ...data })
	}
	sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

	if (sessions.length === 0) return null

	return (
		<details className="flex flex-col">
			<summary className="flex items-center gap-2 text-secondary hover:text-link">
				<Icon name="sparkles" className="size-4" />
				<span>View AI Generation History</span>
				<DisclosureChevron kind="section" size="sm" />
			</summary>
			{sessions.map((session, index) => (
				<Card key={session.sessionId} padding="sm" className="mt-2 flex flex-nowrap gap-2">
					<span className="flex h-lh shrink-0 items-center label-md">
						<Icon name="sparkles" className="size-3.5 text-link" />
					</span>
					<div className="flex flex-col gap-1">
						<div className="flex flex-wrap items-center gap-2 body-sm">
							<h2 className="label-md">
								{session.mode === 'create' ? 'Initial Generation' : 'Iteration'} #{sessions.length - index}
							</h2>
							<p className="text-secondary">{formatDateTime(session.timestamp, { timeZone: 'UTC' }) ?? '-'}</p>
							{session.rating !== undefined && session.rating !== -1 ? (
								<p className="flex items-center gap-1">
									<span className="sr-only">Rating: </span>
									{session.rating === -99 ? (
										<>
											<Icon name="arrow-left" className="size-3 text-warning" />
											<span className="text-warning">Undone</span>
										</>
									) : (
										<>
											<Icon name="star" className="size-3 fill-current text-warning" />
											<span>{session.rating}/5</span>
										</>
									)}
								</p>
							) : null}
						</div>
						<p>
							<span className="font-medium">Prompt: </span>
							<span className="text-secondary">{session.prompt || 'No prompt recorded'}</span>
						</p>
					</div>
				</Card>
			))}
		</details>
	)
}
