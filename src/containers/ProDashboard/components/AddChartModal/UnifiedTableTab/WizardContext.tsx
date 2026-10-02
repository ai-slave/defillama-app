import { createContext, useContext } from 'react'
import type { useUnifiedTableWizard } from './hooks/useUnifiedTableWizard'

// Add card owns the wizard for its whole opening, so a table draft survives tab changes and counts toward its
// discard question; the table tab reads it from here.
export const UnifiedTableWizardContext = createContext<ReturnType<typeof useUnifiedTableWizard> | null>(null)

export const useUnifiedTableWizardContext = () => {
	const ctx = useContext(UnifiedTableWizardContext)
	if (!ctx) {
		throw new Error('useUnifiedTableWizardContext must be used inside UnifiedTableWizardContext')
	}
	return ctx
}
