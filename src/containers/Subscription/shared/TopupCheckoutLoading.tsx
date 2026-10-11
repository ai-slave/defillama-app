import { SurfaceBodyLoadingStatus } from '~/ui/Status'

export function TopupCheckoutLoading() {
	return <SurfaceBodyLoadingStatus label="Loading card payments" className="min-h-[400px]" />
}
