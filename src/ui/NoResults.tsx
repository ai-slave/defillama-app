import { LoadingIndicator } from './Status'

/** The shared empty-result line for lists, popovers, and tables. */
export function NoResults({ children = 'No results found' }: { children?: React.ReactNode }) {
	return <p className="px-3 py-6 text-center body-sm text-tertiary">{children}</p>
}

/** Rows still loading in a list or popover, where NoResults would show once they arrive: the quiet indicator,
    announced. */
export function ListLoading({ label }: { label: string }) {
	return (
		<div role="status" aria-live="polite" className="flex justify-center px-3 py-6">
			<LoadingIndicator label={label} />
		</div>
	)
}
