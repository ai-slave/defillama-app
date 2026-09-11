import * as Ariakit from '@ariakit/react'
import { lazy, type ReactNode, Suspense, useCallback, useState } from 'react'
import { setSignupSource } from '~/auth/signupSource'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'

const SubscribeProModal = lazy(() =>
	import('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard').then((m) => ({
		default: m.SubscribeProModal
	}))
)

/**
 * The site's upgrade modal, opened in place. `modal` must be rendered OUTSIDE any hovercard
 * content and outside the cell's flex row: the card unmounts its content on cursor-leave, and an
 * in-flow node in the row would shift the value beside it. Every unlock button opens through
 * `show`, so the click is tracked here once, tagged with where the button sits.
 */
export function useSubscribeProModal(source: string, placement: string): { show: () => void; modal: ReactNode } {
	const [open, setOpen] = useState(false)
	const store = Ariakit.useDialogStore({ open, setOpen })

	const show = useCallback(() => {
		trackYieldsEvent(YIELDS_EVENTS.VERIFIED_UNLOCK_CLICK, { source, placement })
		setSignupSource(source)
		store.show()
	}, [placement, source, store])

	return {
		show,
		modal: open ? (
			<Suspense fallback={null}>
				<SubscribeProModal dialogStore={store} />
			</Suspense>
		) : null
	}
}
