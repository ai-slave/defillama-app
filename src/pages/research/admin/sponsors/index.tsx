import { ResearchSponsorsAdminView } from '~/containers/Articles/admin/ResearchSponsorsAdminView'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { ArticlesAccessGate } from '~/containers/Articles/ArticlesAccessGate'
import Layout from '~/layout'

export default function ResearchSponsorsAdminPage() {
	return (
		<Layout
			title="Clients - Research Admin - DefiLlama"
			description="Link DefiLlama Research articles to their clients."
			canonicalUrl="/research/admin/sponsors"
			noIndex
			hideDesktopSearch
		>
			<ArticleProxyAuthProvider>
				<ArticlesAccessGate>
					<ResearchSponsorsAdminView />
				</ArticlesAccessGate>
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
