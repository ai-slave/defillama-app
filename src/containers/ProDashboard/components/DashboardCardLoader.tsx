import { skeletonVariantForItemKind } from './ProCardSkeleton'
import { ProCardLoading } from './ProCardStatus'

export function DashboardCardLoader({ className, kind }: { className: string; kind?: string | undefined }) {
	return (
		<ProCardLoading label="Loading card" variant={skeletonVariantForItemKind(kind)} className={`p-4 ${className}`} />
	)
}
