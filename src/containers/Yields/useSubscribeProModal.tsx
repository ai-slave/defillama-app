import * as Ariakit from '@ariakit/react'
import { type ReactNode, useCallback } from 'react'
import { setSignupSource } from '~/auth/signupSource'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'

/**
 * The site's upgrade modal, opened in place. `modal` must be rendered OUTSIDE any hovercard
 * content and outside the cell's flex row: the card unmounts its content on cursor-leave, and an
 * in-flow node in the row would shift the value beside it. Every unlock button opens through
 * `show`, so the click is tracked here once, tagged with where the button sits.
 */
export function useSubscribeProModal(source: string, placement: string): { show: () => void; modal: ReactNode } {
	const store = Ariakit.useDialogStore({
		setOpen: (open) => {
			if (!open) trackYieldsEvent(YIELDS_EVENTS.VERIFIED_MODAL_CLOSE, { source, placement })
		}
	})

	const show = useCallback(() => {
		trackYieldsEvent(YIELDS_EVENTS.VERIFIED_UNLOCK_CLICK, { source, placement })
		setSignupSource(source)
		store.show()
	}, [placement, source, store])

	return {
		show,
		modal: <LazySubscribeProModal dialogStore={store} source={source} placement={placement} />
	}
}
