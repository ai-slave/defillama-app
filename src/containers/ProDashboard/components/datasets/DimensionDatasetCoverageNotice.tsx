export function DimensionDatasetCoverageNotice({ unavailableChains }: { unavailableChains: Array<string> }) {
	if (unavailableChains.length === 0) return null

	return (
		<p
			className="mb-3 rounded-md border border-warning-muted bg-warning-tint px-3 py-2 body-sm text-secondary"
			role="status"
		>
			Partial data: {unavailableChains.join(', ')} {unavailableChains.length === 1 ? 'was' : 'were'} unavailable.
		</p>
	)
}
