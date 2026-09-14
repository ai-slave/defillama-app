import toast from 'react-hot-toast'

const FREE_PUBLIC_NOTICE_KEY = 'pro-dashboard-free-public-notice'

export function notifyForcedPublicVisibility() {
	if (typeof window === 'undefined') return
	try {
		if (window.sessionStorage.getItem(FREE_PUBLIC_NOTICE_KEY)) return
		window.sessionStorage.setItem(FREE_PUBLIC_NOTICE_KEY, '1')
	} catch {
		return
	}
	toast('Free dashboards are always public. Upgrade to keep one private.', {
		id: 'free-public',
		duration: 8000,
		ariaProps: { role: 'status', 'aria-live': 'polite' }
	})
}
