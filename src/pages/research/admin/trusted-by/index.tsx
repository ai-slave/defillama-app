import { TrustedByAdminView } from '~/containers/Articles/admin/TrustedByAdminView'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { ArticlesAccessGate } from '~/containers/Articles/ArticlesAccessGate'
import Layout from '~/layout'

export default function TrustedByAdminListPage() {
	return (
		<Layout
			title="Trusted By - Research Admin - DefiLlama"
			description="Manage sponsor logos and social media mentions."
			canonicalUrl="/research/admin/trusted-by"
			noIndex
			hideDesktopSearch
		>
			<ArticleProxyAuthProvider>
				<ArticlesAccessGate>
					<TrustedByAdminView />
				</ArticlesAccessGate>
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
