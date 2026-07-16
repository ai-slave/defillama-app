// A trend needs at least two non-null points to be meaningful. Missing days are
// gaps and must not be treated as zeroes.
export function hasSparkline(points?: Array<number | null> | null): boolean {
	if (!points) return false
	let count = 0
	for (const value of points) {
		if (value == null) continue
		count += 1
		if (count >= 2) return true
	}
	return false
}
