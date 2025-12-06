export function formatNumbering(
	counters: number[],
	level: number,
	separator: string,
	trailingMode: "all" | "root-only" | "none",
): string {
	const parts = counters.slice(0, level);
	const body = parts.join(separator);
	const needTrailing =
		trailingMode === "all" || (trailingMode === "root-only" && level === 1);
	return needTrailing ? `${body}${separator}` : body;
}

export function sanitizeSeparator(separator?: string): string {
	const fallback = ".";
	if (!separator) return fallback;
	const trimmed = separator.trim();
	return trimmed.length > 0 ? trimmed : fallback;
}

export function normalizeLine(line: string): string {
	return line.replace(/\s+/g, " ").trimEnd();
}

export function adjustCountersForLevel(
	counters: number[],
	level: number,
	startFrom: number,
): void {
	if (counters.length < level) {
		while (counters.length < level) {
			counters.push(startFrom - 1);
		}
	} else {
		counters.length = level;
	}
}

