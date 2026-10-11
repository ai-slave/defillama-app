import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'

const REPORTS = [
	{
		source: 'Bitwise',
		title: 'The Investment Case for NEAR',
		url: 'https://bitwiseinvestments.eu/blog/special-reports/the-investment-case-for-near/',
		color: '#2563eb'
	},
	{
		source: 'SVRN',
		title: 'NEAR Protocol: The Bottom-Up Investment Case',
		url: 'https://svrn.net/research/near-protocol',
		color: '#7c3aed'
	},
	{
		source: 'Nansen',
		title: 'NEAR Quarterly Report: Q4 2025',
		url: 'https://research.nansen.ai/articles/nansen-s-near-quarterly-report-q4-2025',
		color: '#0891b2'
	},
	{
		source: 'Messari',
		title: 'State of NEAR Q3 2025',
		url: 'https://messari.io/report/state-of-near-q3-2025',
		color: '#059669'
	},
	{
		source: 'Reflexivity Research',
		title: 'Exploring NEAR\u2019s Approach to Chain Abstraction',
		url: 'https://www.reflexivityresearch.com/all-reports/exploring-nears-approach-to-chain-abstraction',
		color: '#d97706'
	}
]

const RESEARCH_PAPERS = [
	{
		title: 'The NEAR White Paper',
		description: 'Core protocol design, consensus mechanism, and economic model.',
		url: 'https://cdn.builder.io/o/assets%2F70130eda95b54795a38fe0f6e694359f%2Ffa4d6a189b424099a9fea6d80de00303?alt=media&token=dc09fbbb-2ff6-44c2-a508-72f8a985290a&apiKey=70130eda95b54795a38fe0f6e694359f',
		icon: 'W'
	},
	{
		title: 'Nightshade: NEAR Protocol Sharding Design 2.0',
		description: 'Dynamic sharding architecture enabling horizontal scalability without sacrificing security.',
		url: 'https://discovery-domain.org/papers/nightshade.pdf',
		icon: 'N'
	},
	{
		title: 'Decentralized Confidential Machine Learning (DCML)',
		description: 'Framework for private, verifiable AI computation using trusted execution environments.',
		url: 'https://github.com/nearai/papers/blob/main/DecentralizedConfidentialMachineLearning.pdf',
		icon: 'D'
	},
	{
		title: 'Proof of Response',
		description: 'Mechanism for verifiable agent behavior in decentralized AI systems.',
		url: 'https://arxiv.org/html/2502.10637v1',
		icon: 'P'
	}
]

const ABOUT_NEAR = [
	{
		title: 'NEAR: The Definitive Guide',
		url: 'https://www.near.org/blog/what-is-near-protocol'
	},
	{
		title: 'Evolving NEAR Tokenomics',
		url: 'https://www.near.org/blog/evolving-near-tokenomics'
	},
	{
		title: 'NEAR Protocol and Product Revenue Tracker',
		url: 'https://revenue.near.org/'
	},
	{
		title: 'Attention by Illia Polosukhin',
		url: 'https://ilblackdragon.substack.com/'
	}
]

function ReportCard({ source, title, url, color }: { source: string; title: string; url: string; color: string }) {
	return (
		<Card
			as="a"
			padding="md"
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="hover-wash-card group flex gap-4"
		>
			<div
				className="flex size-10 shrink-0 items-center justify-center rounded-lg"
				style={{ backgroundColor: `${color}18` }}
			>
				<span className="title-md" style={{ color }}>
					{source.charAt(0)}
				</span>
			</div>
			<div className="flex flex-1 flex-col gap-1.5">
				<span className="title-sm tracking-wider uppercase" style={{ color }}>
					{source}
				</span>
				<span className="label-md text-primary group-hover:text-link">{title}</span>
			</div>
			<span className="flex h-lh shrink-0 items-center title-sm">
				<Icon name="arrow-up-right" className="size-4 text-tertiary group-hover:text-link" aria-hidden="true" />
			</span>
		</Card>
	)
}

function PaperCard({
	title,
	description,
	url,
	icon
}: {
	title: string
	description: string
	url: string
	icon: string
}) {
	return (
		<Card
			as="a"
			padding="md"
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="hover-wash-card group flex gap-4"
		>
			<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
				<span className="title-md text-link">{icon}</span>
			</div>
			<div className="flex flex-1 flex-col gap-1">
				<span className="title-md text-primary group-hover:text-link">{title}</span>
				<span className="body-sm text-secondary">{description}</span>
			</div>
			<span className="flex h-lh shrink-0 items-center title-md">
				<Icon name="arrow-up-right" className="size-4 text-tertiary group-hover:text-link" aria-hidden="true" />
			</span>
		</Card>
	)
}

function LinkItem({ title, url }: { title: string; url: string }) {
	return (
		<Card
			as="a"
			padding="md"
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="hover-wash-card group flex items-center justify-between gap-4"
		>
			<span className="label-md text-primary group-hover:text-link">{title}</span>
			<Icon name="arrow-up-right" className="size-4 shrink-0 text-tertiary group-hover:text-link" aria-hidden="true" />
		</Card>
	)
}

export default function Research() {
	return (
		<div className="flex flex-col gap-8">
			<Card padding="md" className="flex flex-col gap-2">
				<h2 className="heading-sm text-primary">Reports & research</h2>
				<p className="max-w-2xl body-md text-secondary">
					Independent analysis, technical papers, and foundational resources covering NEAR&apos;s investment case,
					architecture, and ecosystem growth.
				</p>
			</Card>

			<div>
				<h2 className="mb-4 heading-xs tracking-tight text-primary">Reports</h2>
				<div className="flex flex-col gap-3">
					{REPORTS.map((report) => (
						<ReportCard key={report.title} {...report} />
					))}
				</div>
			</div>

			<div>
				<h2 className="mb-4 heading-xs tracking-tight text-primary">Papers</h2>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{RESEARCH_PAPERS.map((paper) => (
						<PaperCard key={paper.title} {...paper} />
					))}
				</div>
			</div>

			<div>
				<h2 className="mb-4 heading-xs tracking-tight text-primary">About NEAR</h2>
				<div className="flex flex-col gap-2.5">
					{ABOUT_NEAR.map((resource) => (
						<LinkItem key={resource.title} {...resource} />
					))}
				</div>
			</div>
		</div>
	)
}
