import { Skeleton } from '~/ui/Skeleton'

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">{title}</h3>
			{children}
		</div>
	)
}

export function CardSkeleton({ title }: { title: string }) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">{title}</h3>
			<div className="flex h-[400px] items-center justify-center">
				<div className="size-5 animate-spin rounded-full border-2 border-tertiary border-t-transparent" />
			</div>
		</div>
	)
}

export function KpiCard({ label, value }: { label: string; value: string | number | null }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-subtle bg-surface p-4">
			<span className="label-sm tracking-wide text-secondary">{label}</span>
			<span className="mono-xl text-primary">{value ?? '—'}</span>
		</div>
	)
}

export function KpiSkeleton({ label }: { label: string }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-subtle bg-surface p-4">
			<span className="label-sm tracking-wide text-secondary">{label}</span>
			<Skeleton className="h-8 w-24" />
		</div>
	)
}
