/** The shared empty-result line for lists, popovers, and tables. */
export function NoResults({
	children = 'No results found',
	className
}: {
	children?: React.ReactNode
	className?: string
}) {
	return <p className={`px-3 py-6 text-center body-sm text-tertiary ${className ?? ''}`.trim()}>{children}</p>
}
