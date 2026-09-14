import type { KeyboardEvent } from 'react'

export function keepKeyboardEventsInsideCard(event: KeyboardEvent) {
	event.stopPropagation()
}
