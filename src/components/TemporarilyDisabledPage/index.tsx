import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { EmptyState } from '~/ui/Status'

interface TemporarilyDisabledPageProps {
	title: string
	description?: string
	canonicalUrl?: string
	heading: string
	/** One line of inline text: it renders as EmptyState's hint, inside a <p>. */
	children: React.ReactNode
}

/** A page switched off on purpose, such as one whose data is wrong and is hidden until it is fixed. A page whose data
    failed to load is a PanelStatus error, not this. */
export function TemporarilyDisabledPage({
	title,
	description = 'This page is temporarily disabled and will be back shortly.',
	canonicalUrl,
	heading,
	children
}: TemporarilyDisabledPageProps) {
	return (
		<Layout title={title} description={description} canonicalUrl={canonicalUrl}>
			<Card padding="md" className="isolate flex flex-1 flex-col">
				<EmptyState size="lg" headingAs="h1" title={heading}>
					{children}
				</EmptyState>
			</Card>
		</Layout>
	)
}
