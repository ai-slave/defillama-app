// m-of-n threshold as key pips: filled = the signatures that must be compromised to act.
// Falls back to text for big n.
export function MofNPips({ m, n }: { m: number; n: number }) {
	if (!n || n > 15) return <span className="text-xs text-(--text-secondary) tabular-nums">{`${m}/${n}`}</span>
	return (
		<span className="inline-flex items-center gap-0.5" role="img" aria-label={`${m} of ${n} signatures required`}>
			{Array.from({ length: n }, (_, i) => (
				<span
					key={i}
					className={`size-1.5 rounded-full ${i < m ? 'bg-(--warning)' : 'border border-(--text-secondary)/40'}`}
				/>
			))}
		</span>
	)
}
