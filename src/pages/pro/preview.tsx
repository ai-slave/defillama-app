import { ErrorBoundary } from '~/components/ErrorBoundary'
import { BasicLink } from '~/components/Link'
import { DemoPreview } from '~/containers/ProDashboard/components/DemoPreview'
import { ProDashboardAPIProvider } from '~/containers/ProDashboard/ProDashboardAPIContext'
import Layout from '~/layout'

function DemoPreviewFallback() {
	return (
		<div
			role="alert"
			className="mx-auto my-12 flex max-w-xl flex-col items-center gap-3 rounded-md border border-subtle bg-surface p-6 text-center"
		>
			<p className="body-md text-secondary">The preview could not be displayed.</p>
			<BasicLink href="/pro?tab=discover" className="label-md text-link hover:underline">
				See community dashboards
			</BasicLink>
		</div>
	)
}

export default function ProPreviewPage() {
	return (
		<ProDashboardAPIProvider>
			<Layout
				title="DefiLlama Pro Dashboard - Preview"
				description="Preview DefiLlama Pro dashboards. Explore custom DeFi analytics built with TVL, fees, volume, and protocol metrics."
				canonicalUrl="/pro/preview"
			>
				<ErrorBoundary fallback={<DemoPreviewFallback />}>
					<DemoPreview />
				</ErrorBoundary>
			</Layout>
		</ProDashboardAPIProvider>
	)
}
