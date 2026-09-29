import type { ReactNode } from 'react'
import { SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'

// A tab's own loading, empty and error state, in the Investors card chrome: PanelStatus draws the site's
// surface, which does not match these dashboards.
export function TabStatus({ variant, children }: { variant: 'loading' | 'empty' | 'error'; children?: ReactNode }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg">
			{variant === 'loading' ? (
				<SurfaceBodyLoadingStatus />
			) : (
				<SurfaceBodyStatus variant={variant}>{children}</SurfaceBodyStatus>
			)}
		</div>
	)
}
