import { createPortal } from 'react-dom'
import { Toaster } from 'react-hot-toast'
import { useIsClient } from '~/hooks/useIsClient'

export function Toast() {
	const isClient = useIsClient()
	if (!isClient) return null

	return createPortal(
		<Toaster
			position="top-center"
			containerStyle={{ zIndex: 99_999 }}
			toastOptions={{
				style: {
					background: 'var(--bg-overlay)',
					color: 'var(--text-primary)',
					border: '1px solid var(--border-medium)',
					borderRadius: '8px',
					fontSize: '14px'
				},
				success: {
					iconTheme: {
						primary: 'var(--text-success)',
						secondary: 'var(--bg-overlay)'
					}
				},
				error: {
					iconTheme: {
						primary: 'var(--text-error)',
						secondary: 'var(--bg-overlay)'
					}
				}
			}}
		/>,
		document.body
	)
}
