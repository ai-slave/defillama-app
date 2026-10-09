import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { InlineStatus } from '~/ui/Status'

// Its own module, so the dashboard page that lazy-loads DemoPreview shows it without loading DemoPreview.
export function DemoPreviewFallback() {
	return (
		<div className="mx-auto my-12 w-full max-w-xl">
			<InlineStatus
				variant="error"
				action={
					<Button as={BasicLink} href="/pro?tab=discover" size="sm">
						See community dashboards
					</Button>
				}
			>
				The preview could not be displayed.
			</InlineStatus>
		</div>
	)
}
