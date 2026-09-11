import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { isChatSurfaceAttended, type ChatAttention } from '~/containers/LlamaAI/chatAttention'

interface UseStreamNotificationOptions {
	soundEnabled: boolean
	attention: ChatAttention
}

export function useStreamNotification({ soundEnabled, attention }: UseStreamNotificationOptions) {
	const originalTitleRef = useRef('')
	const originalFaviconRef = useRef('')
	const hasBadgeRef = useRef(false)
	const audioRef = useRef<HTMLAudioElement | null>(null)
	const soundEnabledRef = useRef(soundEnabled)
	const attentionRef = useRef(attention)
	// Written after commit rather than during render: a render-phase ref write costs the hook its
	// compiler optimization, and every reader here runs from a handler or an effect, after commit.
	useLayoutEffect(() => {
		soundEnabledRef.current = soundEnabled
		attentionRef.current = attention
	})

	// Preload the notification sound once so later completion notifications can play immediately.
	useEffect(() => {
		const audio = new Audio('/assets/notification.mp3')
		audioRef.current = audio
		audio.load()
		return () => {
			audio.pause()
			audio.removeAttribute('src')
			audio.load()
			audioRef.current = null
		}
	}, [])

	// Restore the original tab title/favicon after the user returns to the chat.
	const clearBadge = useCallback(() => {
		if (!hasBadgeRef.current) return
		hasBadgeRef.current = false
		document.title = originalTitleRef.current
		const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
		if (link && originalFaviconRef.current) link.href = originalFaviconRef.current
	}, [])

	// Mark the tab as unread while a completed response is waiting out of view.
	const setBadge = useCallback(() => {
		if (hasBadgeRef.current) return
		hasBadgeRef.current = true
		originalTitleRef.current = document.title
		const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
		if (link) originalFaviconRef.current = link.href
		document.title = 'LlamaAI (1) - DefiLlama'
		if (link) link.href = '/favicon-badge.png'
	}, [])

	const clearBadgeIfAttending = useCallback(() => {
		if (isChatSurfaceAttended(attentionRef.current)) clearBadge()
	}, [clearBadge])

	useEffect(() => {
		return () => {
			if (hasBadgeRef.current) clearBadge()
		}
	}, [clearBadge])

	useEffect(() => {
		clearBadgeIfAttending()
		document.addEventListener('visibilitychange', clearBadgeIfAttending)
		window.addEventListener('focus', clearBadgeIfAttending)
		return () => {
			document.removeEventListener('visibilitychange', clearBadgeIfAttending)
			window.removeEventListener('focus', clearBadgeIfAttending)
		}
		// eslint-disable-next-line react/exhaustive-effect-dependencies -- attention.uncovered is the trigger: clear the badge when the chat becomes visible
	}, [attention.uncovered, clearBadgeIfAttending])

	// Reset and replay the short audio cue when a background response completes.
	const playSound = useCallback(() => {
		if (!soundEnabledRef.current) return
		if (!audioRef.current) return
		audioRef.current.currentTime = 0
		audioRef.current.play().catch((error) => {
			// Audio playback can fail due to autoplay policies - this is expected behavior
			if (error.name !== 'NotAllowedError') {
				console.log('Failed to play notification sound:', error)
			}
		})
	}, [])

	// Use the browser notification API as a secondary signal when permission is available.
	const showNotification = useCallback(() => {
		const notification = new Notification('LlamaAI', {
			body: 'Llama has answered your question!',
			icon: '/favicon-badge.png'
		})
		notification.addEventListener(
			'click',
			() => {
				window.focus()
				window.parent?.focus?.()
				notification.close()
			},
			{ once: true }
		)
		void notification
	}, [])

	// Notify only when the user is not attending the chat; foreground completions do not need browser-level alerts.
	// Permission prompting is handled by NotificationPermissionBanner, not here — if the user hasn't
	// granted permission we silently skip the OS notification and rely on badge+sound.
	const notify = useCallback(() => {
		if (isChatSurfaceAttended(attentionRef.current)) return

		setBadge()
		playSound()

		if (typeof Notification === 'undefined') return
		if (Notification.permission === 'granted') showNotification()
	}, [playSound, setBadge, showNotification])

	// Prime audio playback from a user gesture so completion sounds aren't blocked by autoplay policy.
	const primeAudio = useCallback(() => {
		if (!soundEnabledRef.current) return
		if (!audioRef.current) return
		const vol = audioRef.current.volume
		audioRef.current.volume = 0
		audioRef.current
			.play()
			.then(() => {
				if (!audioRef.current) return
				audioRef.current.pause()
				audioRef.current.currentTime = 0
				audioRef.current.volume = vol
			})
			.catch((error) => {
				if (audioRef.current) {
					audioRef.current.pause()
					audioRef.current.currentTime = 0
					audioRef.current.volume = vol
				}
				// Expected when autoplay is blocked - silently ignore
				if (error.name !== 'NotAllowedError') {
					console.log('Failed to initialize audio:', error)
				}
			})
	}, [])

	return { notify, primeAudio }
}
