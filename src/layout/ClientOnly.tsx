import type { ReactNode } from 'react'
import { useIsClient } from '~/hooks/useIsClient'

// Preserve the account pages' client-only boundary without loading wallet SDKs.
export function ClientOnly({ children }: { children: ReactNode }) {
	return useIsClient() ? children : null
}
