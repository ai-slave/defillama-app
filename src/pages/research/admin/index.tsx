import Link from 'next/link'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { ArticlesAccessGate } from '~/containers/Articles/ArticlesAccessGate'
import Layout from '~/layout'
import { Card } from '~/ui/Card'

export default function ResearchAdminHubPage() {
	return (
		<Layout
			title="Research Admin - DefiLlama"
			description="Internal admin tools for the research platform."
			canonicalUrl="/research/admin"
			noIndex
			hideDesktopSearch
		>
			<ArticleProxyAuthProvider>
				<ArticlesAccessGate>
					<div className="mx-auto grid w-full max-w-4xl gap-6 px-1 pb-16">
						<header className="pt-2 pb-2">
							<Link
								href="/research"
								className="inline-flex items-center gap-1 body-sm text-tertiary hover:text-primary focus-visible:text-primary"
							>
								<span aria-hidden>←</span> Research
							</Link>
							<h1 className="mt-2 heading-lg tracking-tight text-primary">Admin</h1>
							<p className="mt-1 body-md text-secondary">Internal tools for the research platform.</p>
						</header>

						<div className="grid gap-4 sm:grid-cols-2">
							<Card as={Link} padding="md" href="/research/new" className="group hover-wash-card grid gap-2">
								<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Authoring</span>
								<span className="heading-xs text-primary group-hover:text-link">Write new article</span>
								<span className="body-md text-secondary">Start a fresh draft in the research editor.</span>
							</Card>
							<Card as={Link} padding="md" href="/research/mine" className="group hover-wash-card grid gap-2">
								<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Authoring</span>
								<span className="heading-xs text-primary group-hover:text-link">My articles</span>
								<span className="body-md text-secondary">
									Review and edit drafts and published articles you authored.
								</span>
							</Card>
							<Card as={Link} padding="md" href="/research/admin/curation" className="group hover-wash-card grid gap-2">
								<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Editorial</span>
								<span className="heading-xs text-primary group-hover:text-link">Curation</span>
								<span className="body-md text-secondary">
									Pick the Spotlight and Insights articles shown on /research.
								</span>
							</Card>
							<Card as={Link} padding="md" href="/research/admin/banners" className="group hover-wash-card grid gap-2">
								<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Promotions</span>
								<span className="heading-xs text-primary group-hover:text-link">Banners</span>
								<span className="body-md text-secondary">
									Configure the dismissible strip shown above articles or on /research.
								</span>
							</Card>
							<Card
								as={Link}
								padding="md"
								href="/research/admin/trusted-by"
								className="group hover-wash-card grid gap-2"
							>
								<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Promotions</span>
								<span className="heading-xs text-primary group-hover:text-link">Trusted By</span>
								<span className="body-md text-secondary">
									Manage the Trusted By logos and social media mentions shown on /research.
								</span>
							</Card>
							<Card as={Link} padding="md" href="/research/admin/reports" className="group hover-wash-card grid gap-2">
								<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Reports</span>
								<span className="heading-xs text-primary group-hover:text-link">Report PDFs</span>
								<span className="body-md text-secondary">
									Attach a PDF, carousel image, sponsor logo, and description to each Report article.
								</span>
							</Card>
							<Card as={Link} padding="md" href="/research/admin/sponsors" className="group hover-wash-card grid gap-2">
								<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Research filter</span>
								<span className="heading-xs text-primary group-hover:text-link">Trusted by filter</span>
								<span className="body-md text-secondary">
									Keep the list readers filter Research by and link each article to its company.
								</span>
							</Card>
						</div>
					</div>
				</ArticlesAccessGate>
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
