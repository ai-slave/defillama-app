import { BasicLink } from '~/components/Link'
import Layout from '~/layout'
import { EmptyState } from '~/ui/Status'

export function NotFoundPage() {
	return (
		<Layout
			title="Page not found - DefiLlama"
			description="DefiLlama is committed to providing accurate data without ads or sponsored content, as well as transparency."
			canonicalUrl="/404"
		>
			<div className="isolate flex flex-1 flex-col items-center justify-center rounded-lg border border-subtle bg-surface p-1">
				{/* EmptyState grows to fill its parent; this column keeps it under the image, centred as one group. */}
				<div className="flex flex-col items-center">
					<img src="/assets/404.png" width={350} height={350} alt="Want a ride?" />
					<EmptyState size="lg" headingAs="h1" title="Page not found">
						This page doesn&apos;t exist. Check out{' '}
						<BasicLink href="/metrics" className="underline">
							other dashboards
						</BasicLink>
						.
					</EmptyState>
				</div>
			</div>
		</Layout>
	)
}
