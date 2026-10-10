/** Small DefiLlama logo for the corner of a data card. Matches the PNG export mark. */
export function Watermark({ className = '' }: { className?: string }) {
	return (
		<span
			className={`pointer-events-none flex h-5 justify-end opacity-40 select-none ${className}`.trim()}
			aria-hidden="true"
		>
			<img src="/assets/defillama-dark-neutral.webp" alt="" height={20} width={58} className="h-5 dark:hidden" />
			<img src="/assets/defillama-light-neutral.webp" alt="" height={20} width={58} className="hidden h-5 dark:block" />
		</span>
	)
}
