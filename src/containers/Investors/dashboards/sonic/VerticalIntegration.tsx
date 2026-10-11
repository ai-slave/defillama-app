import { SkeletonTable } from '~/containers/Investors/DashboardTabsContent'
import { Icon } from '~/ui/Icon'

const PRODUCTS = ['Native Swap', 'Native Perps', 'Lending', 'LST', 'Concentrated Liquidity', 'Vault', 'USSD', 'Perps']

export default function VerticalIntegration() {
	return (
		<div className="flex min-h-[calc(100vh-180px)] flex-col gap-6">
			<div className="max-w-2xl">
				<h2 className="heading-xs text-primary">Vertical Integration</h2>
				<p className="mt-3 body-lg text-secondary">
					Vertical integration is Sonic's strategy of building and aligning core applications, infrastructure, and
					liquidity so that economic activity on the network compounds back into the S token rather than leaking to
					disconnected teams or external tokens.
				</p>
				<p className="mt-3 body-lg text-secondary">
					Rather than depending on gas fees alone, the goal is to own or integrate the key economic primitives across
					the network so that adoption, usage, and revenue translate into more durable value creation for Sonic.
				</p>
				<a
					href="https://blog.soniclabs.com/vertical-integration-the-missing-link-in-l1-value-creation/"
					target="_blank"
					rel="noopener noreferrer"
					className="mt-3 inline-flex items-center gap-1 label-md text-link transition-colors hover:underline"
				>
					Read more
					<Icon name="arrow-up-right" className="size-3" />
				</a>
			</div>

			<div className="flex flex-1 flex-col gap-4">
				<h3 className="heading-xs">Product Breakdown</h3>
				<div className="flex flex-wrap items-center gap-2">
					{PRODUCTS.map((name) => (
						<span key={name} className="rounded-md border border-medium bg-surface px-3 py-1.5 body-md text-secondary">
							{name}
						</span>
					))}
				</div>

				<div className="relative flex-1">
					<SkeletonTable still />
					<div className="absolute inset-0 flex items-center justify-center">
						<span className="rounded-full border border-medium bg-overlay px-5 py-2.5 title-md tracking-wide text-secondary">
							Dashboard — Coming Soon
						</span>
					</div>
				</div>
			</div>
		</div>
	)
}
