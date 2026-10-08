import { useAuthContext } from '~/auth'
import type { AgenticAnswerMode, FactCheckedUsage, ResearchUsage } from '~/containers/LlamaAI/types'
import { Icon } from '~/ui/Icon'
import { PromoBadge } from '~/ui/PromoBadge'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface ModeToggleProps {
	mode: AgenticAnswerMode
	setMode: (mode: AgenticAnswerMode) => void
	researchUsage?: ResearchUsage | null
	factCheckedUsage?: FactCheckedUsage | null
	onFactCheckedGated?: () => void
}

const MODE_EVENTS: Record<AgenticAnswerMode, string> = {
	quick: 'llamaai-quick-mode-toggle',
	fact_checked: 'llamaai-fact-checked-mode-toggle',
	research: 'llamaai-research-mode-toggle'
}

export function ModeUsage({
	usage,
	feature
}: {
	usage: ResearchUsage | FactCheckedUsage | null | undefined
	feature: 'fact_checked' | 'research'
}) {
	const { isAuthenticated } = useAuthContext()
	const signedOut = !usage && !isAuthenticated
	if (feature === 'fact_checked' && (usage?.period === 'blocked' || signedOut)) {
		return <PromoBadge>Pro</PromoBadge>
	}
	if (feature === 'research' && (usage?.period === 'biweekly' || signedOut)) {
		return <span className="body-sm text-tertiary tabular-nums">{usage ? usage.remainingUsage : 1} free</span>
	}
	if (!usage || usage.limit <= 0 || usage.period === 'unlimited') return null
	return (
		<span className="body-sm text-tertiary tabular-nums">
			{usage.remainingUsage}/{usage.limit}
		</span>
	)
}

function TooltipBody({ title, body, footer }: { title: string; body: React.ReactNode; footer?: React.ReactNode }) {
	return (
		<div className="flex max-w-[220px] flex-col gap-1.5">
			<span className="font-medium text-primary">{title}</span>
			<span className="text-secondary">{body}</span>
			{footer ? <span className="border-t border-subtle pt-1.5 body-sm text-secondary">{footer}</span> : null}
		</div>
	)
}

export function ModeToggle({ mode, setMode, researchUsage, factCheckedUsage, onFactCheckedGated }: ModeToggleProps) {
	const { user } = useAuthContext()
	const needsVerification = !!user && !user.verified
	const factCheckedBlocked = factCheckedUsage?.period === 'blocked'

	return (
		<SegmentedControl<AgenticAnswerMode>
			label="Answer mode"
			data-walkthrough="mode-toggle"
			variant="default"
			size="md"
			value={mode}
			onValueChange={(next) => {
				trackUmamiEvent(MODE_EVENTS[next])
				if (next === 'fact_checked' && factCheckedBlocked) {
					onFactCheckedGated?.()
					return
				}
				setMode(next)
			}}
			options={[
				{
					value: 'quick',
					label: (
						<span className="flex items-center gap-1">
							<Icon name="sparkles" height={14} width={14} />
							Quick
						</span>
					),
					tooltip: <TooltipBody title="Quick mode" body="Fast responses for most queries" />
				},
				{
					value: 'fact_checked',
					label: (
						<span className="flex items-center gap-1">
							<Icon name="check" height={14} width={14} />
							Fact-checked
							<ModeUsage usage={factCheckedUsage} feature="fact_checked" />
						</span>
					),
					tooltip: (
						<TooltipBody
							title="Fact-checked"
							body="Two-pass verification with cited evidence"
							footer={
								factCheckedUsage?.period === 'unlimited'
									? 'Unlimited answers'
									: factCheckedBlocked
										? 'Subscribe to use fact-checked'
										: factCheckedUsage
											? `${factCheckedUsage.remainingUsage}/${factCheckedUsage.limit} remaining${factCheckedUsage.period === 'daily' ? ' today' : ''}`
											: '10 answers/day on Pro · 10 lifetime on trial'
							}
						/>
					)
				},
				{
					value: 'research',
					label: (
						<span className="flex items-center gap-1">
							<Icon name="search" height={14} width={14} />
							Research
							<ModeUsage usage={researchUsage} feature="research" />
						</span>
					),
					tooltip: (
						<TooltipBody
							title="Research mode"
							body={
								<>
									Comprehensive reports with in-depth analysis and citations
									<br />
									Usually takes 10–20 minutes
								</>
							}
							footer={
								researchUsage?.period === 'unlimited'
									? 'Unlimited reports'
									: researchUsage?.period === 'blocked'
										? needsVerification
											? 'Verify your email to use research'
											: 'Subscribe to Pro to use research'
										: researchUsage
											? `${researchUsage.remainingUsage}/${researchUsage.limit} remaining${researchUsage.period === 'daily' ? ' today' : researchUsage.period === 'biweekly' ? ' (every 14 days)' : ''}`
											: '5 reports/day on Pro · 3 on trial · Free: 1 every 14 days'
							}
						/>
					)
				}
			]}
		/>
	)
}
