import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { Tag } from '~/ui/Tag'
import { lifecycleStyles } from './columns'
import type { RewardProgram } from './types'

export function FeaturedCards({ programs }: { programs: Array<RewardProgram> }) {
	if (programs.length === 0) return null
	return (
		<section aria-label="Featured rewards" className="grid w-full max-w-7xl grid-cols-1 gap-3 px-3 py-2 lg:grid-cols-3">
			{programs.map((program) => (
				<Card as="article" padding="none" key={program.programId} className="flex min-w-0 flex-col">
					<div className="flex flex-col gap-3 p-4">
						<div className="flex items-center gap-2">
							<span
								className={`inline-flex items-center gap-1.5 label-sm uppercase ${lifecycleStyles[program.lifecycle]}`}
							>
								<span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
								{program.lifecycle}
							</span>
							{program.verification === 'Unverified' ? <span className="body-xs text-tertiary">Unverified</span> : null}
						</div>
						<div className="flex items-center gap-3">
							<TokenLogo src={program.logo} size={40} />
							<div className="min-w-0">
								<h2 className="label-lg text-primary">{program.protocol}</h2>
								{program.programName ? <p className="body-xs text-tertiary">{program.programName}</p> : null}
							</div>
						</div>
						<div className="flex flex-wrap gap-2">
							{program.rewardTypes.map((type) => (
								<Tag key={type}>{type}</Tag>
							))}
						</div>
						<p className="body-sm text-secondary">{program.visitorBenefit}</p>
					</div>
					{program.referralUrl ? (
						<a
							href={program.referralUrl}
							target="_blank"
							rel="noopener noreferrer sponsored"
							data-reward-program-id={program.programId}
							data-reward-project-path={program.projectPath ?? undefined}
							data-reward-placement="card"
							aria-label={`Open ${program.protocol}${program.programName ? ` ${program.programName}` : ''} with DefiLlama link`}
							className="mt-auto flex items-center justify-between gap-2 rounded-b-lg border-t border-subtle px-4 py-3 label-sm text-link no-underline hover:bg-hover-row hover:no-underline focus-visible:bg-hover-row focus-visible:focus-ring"
						>
							Open with DefiLlama link
							<Icon name="arrow-right" height={16} width={16} aria-hidden="true" />
						</a>
					) : null}
				</Card>
			))}
		</section>
	)
}
