import { forgdSecondaryLinkStyles } from './styles'

const CARDS = [
	{
		icon: '/market-makers-docs/pictogram-advisory.svg',
		title: 'Apply for full-service advisory',
		description:
			'Work directly with our experts for personalized insights, deeper analysis, and hands-on advisory for your next milestone.',
		cta: 'Schedule a Consultation',
		href: 'https://www.forgd.com/schedule-a-consultation'
	},
	{
		icon: '/market-makers-docs/pictogram-tools.svg',
		title: 'Explore free tools',
		description: 'Browse our collection of free tools to support your research, analysis, and project operations.',
		cta: 'Learn More',
		href: 'https://www.forgd.com/tools'
	}
] as const

function ArrowUpRightIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden
			className="shrink-0"
		>
			<path
				d="M3.5 10.5L10.5 3.5M10.5 3.5H4.5M10.5 3.5V9.5"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export function ReadyToStart() {
	return (
		<div className="flex flex-col gap-4 border-t border-subtle pt-6">
			<div className="flex flex-col gap-1">
				<h2 className="heading-sm text-primary">Ready to start with Forgd?</h2>
				<p className="body-sm text-secondary">
					Engage with our free tools, and apply the learnings from our research data.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 min-[713px]:grid-cols-2">
				{CARDS.map((card) => (
					<div key={card.title} className="flex h-full flex-col gap-4 rounded-lg bg-brand p-6">
						<img src={card.icon} alt="" width={60} height={60} className="size-[60px]" />
						<div className="flex flex-col gap-2">
							<h3 className="text-base font-semibold text-on-brand">{card.title}</h3>
							<p className="text-sm leading-relaxed text-on-brand/70">{card.description}</p>
						</div>
						<a
							href={card.href}
							target="_blank"
							rel="noreferrer noopener"
							className={`mt-auto ${forgdSecondaryLinkStyles}`}
						>
							{card.cta}
							<ArrowUpRightIcon />
						</a>
					</div>
				))}
			</div>
		</div>
	)
}
