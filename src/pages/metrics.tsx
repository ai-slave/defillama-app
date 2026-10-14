import { METRICS_DIRECTORY, Metrics } from '~/components/Metrics'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import Layout from '~/layout'

export default function MetricsPageView() {
	return (
		<Layout
			title="DeFi Metrics Index - Dashboards by Topic - DefiLlama"
			description={METRICS_DIRECTORY}
			canonicalUrl="/metrics"
		>
			<NewsletterSignup layout="strip" />
			<Metrics />
		</Layout>
	)
}
