function getLastDayOfUtcMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

function getMonthlyAnniversary(created: Date, monthOffset: number): Date {
	const targetMonth = created.getUTCMonth() + monthOffset
	const year = created.getUTCFullYear() + Math.floor(targetMonth / 12)
	const month = ((targetMonth % 12) + 12) % 12
	const anniversary = new Date(created)

	// Set day 1 before changing the month so dates such as January 31 cannot roll into March.
	anniversary.setUTCDate(1)
	anniversary.setUTCFullYear(year)
	anniversary.setUTCMonth(month)
	anniversary.setUTCDate(Math.min(created.getUTCDate(), getLastDayOfUtcMonth(year, month)))
	return anniversary
}

function getYearlyAnniversary(created: Date, yearOffset: number): Date {
	const year = created.getUTCFullYear() + yearOffset
	const month = created.getUTCMonth()
	const anniversary = new Date(created)

	// Clamp February 29 to February 28 in non-leap years.
	anniversary.setUTCDate(1)
	anniversary.setUTCFullYear(year)
	anniversary.setUTCDate(Math.min(created.getUTCDate(), getLastDayOfUtcMonth(year, month)))
	return anniversary
}

export function computeNextBillingDate(
	createdAt: string,
	billingInterval: 'month' | 'year',
	now = new Date()
): Date | null {
	// The subscription API uses a space before the time in otherwise ISO-compatible UTC timestamps.
	const created = new Date(createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T'))
	if (!Number.isFinite(created.getTime()) || !Number.isFinite(now.getTime())) return null
	if (now < created) return created

	if (billingInterval === 'year') {
		let yearOffset = now.getUTCFullYear() - created.getUTCFullYear()
		let candidate = getYearlyAnniversary(created, yearOffset)
		if (candidate <= now) candidate = getYearlyAnniversary(created, yearOffset + 1)
		return candidate
	}

	let monthOffset = (now.getUTCFullYear() - created.getUTCFullYear()) * 12 + (now.getUTCMonth() - created.getUTCMonth())
	let candidate = getMonthlyAnniversary(created, monthOffset)
	if (candidate <= now) candidate = getMonthlyAnniversary(created, monthOffset + 1)
	return candidate
}
