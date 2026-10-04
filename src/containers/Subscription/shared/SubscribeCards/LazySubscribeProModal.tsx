import * as Ariakit from '@ariakit/react'
import { lazy, Suspense, type ComponentProps } from 'react'

const SubscribeProModal = lazy(() => import('./SubscribeProCard').then((m) => ({ default: m.SubscribeProModal })))

/** The upgrade modal for an upsell control: the caller keeps the store and calls show() (after setSignupSource). The
    modal's code loads on the first opening, and it stays mounted until its exit animation ends. Its own module, so a
    caller's chunk does not include the modal. */
export function LazySubscribeProModal(props: ComponentProps<typeof SubscribeProModal>) {
	const mounted = Ariakit.useStoreState(props.dialogStore, 'mounted')
	return mounted ? (
		<Suspense fallback={null}>
			<SubscribeProModal {...props} />
		</Suspense>
	) : null
}
