import { Editor } from "obsidian";

export interface NumberingResult {
	changed: boolean;
	processedHeadings: number;
}

export interface NumberingOptions {
	startFrom: number;
	separator?: string;
	trailingMode?: "all" | "root-only" | "none";
	spaceAfterNumber?: boolean;
}

export function applyHeadingNumbering(editor: Editor, options: NumberingOptions = { startFrom: 1 }): NumberingResult {
	const startFrom = Math.max(0, Math.floor(options.startFrom ?? 1));
	const separator = sanitizeSeparator(options.separator);
	const trailingMode = options.trailingMode ?? "all";
	const spaceAfterNumber = options.spaceAfterNumber ?? true;
	const counters: number[] = [];
	let inFence = false;
	let inFrontMatter = false;
	let changed = false;
	let processedHeadings = 0;

	const baseLevel = findBaseHeadingLevel(editor) ?? 1;
	const lineCount = editor.lineCount();

	for (let lineNumber = 0; lineNumber < lineCount; lineNumber++) {
		const line = editor.getLine(lineNumber);

		if (lineNumber === 0 && line.trim() === "---") {
			inFrontMatter = true;
			continue;
		}

		if (inFrontMatter) {
			if (line.trim() === "---" || line.trim() === "...") {
				inFrontMatter = false;
			}
			continue;
		}

		if (isFenceLine(line)) {
			inFence = !inFence;
			continue;
		}

		if (inFence) {
			continue;
		}

		const headingMatch = line.match(/^(\s{0,3})(#{1,6})(\s+)(.+)$/);
		if (!headingMatch) {
			continue;
		}

		const [, indent, hashes, , rawContent] = headingMatch;
		const content = rawContent.trim();
		if (!content) {
			continue;
		}

		const cleanTitle = stripExistingNumbering(content);
		const level = hashes.length;
		const normalizedLevel = Math.max(1, level - baseLevel + 1);

		adjustCountersForLevel(counters, normalizedLevel, startFrom);

		const current = counters[normalizedLevel - 1] ?? startFrom - 1;
		counters[normalizedLevel - 1] = current + 1;

		const numbering = formatNumbering(counters, normalizedLevel, separator, trailingMode);
		const spacing = spaceAfterNumber ? " " : "";
		const newLine = `${indent}${hashes} ${numbering}${spacing}${cleanTitle}`.trimEnd();

		if (newLine !== line) {
			editor.setLine(lineNumber, newLine);
			changed = true;
		}

		processedHeadings++;
	}

	return { changed, processedHeadings };
}

function adjustCountersForLevel(counters: number[], level: number, startFrom: number) {
	if (counters.length < level) {
		while (counters.length < level) {
			counters.push(startFrom - 1);
		}
	} else {
		counters.length = level;
	}
}

function isFenceLine(line: string): boolean {
	return /^\s*(```|~~~)/.test(line);
}

function formatNumbering(counters: number[], level: number, separator: string, trailingMode: "all" | "root-only" | "none"): string {
	const parts = counters.slice(0, level);
	const body = parts.join(separator);
	const needTrailing =
		trailingMode === "all" ||
		(trailingMode === "root-only" && level === 1);
	return needTrailing ? `${body}${separator}` : body;
}

function stripExistingNumbering(content: string): string {
	const match = content.match(/^(\d+(?:\.\d+)*)([.)])?\s+(.*)$/);
	if (match) {
		return match[3].trim();
	}
	return content.trim();
}

function sanitizeSeparator(separator?: string): string {
	const fallback = ".";
	if (!separator) return fallback;
	const trimmed = separator.trim();
	return trimmed.length > 0 ? trimmed : fallback;
}

function findBaseHeadingLevel(editor: Editor): number | null {
	let inFence = false;
	let inFrontMatter = false;
	let minLevel: number | null = null;
	const lineCount = editor.lineCount();

	for (let lineNumber = 0; lineNumber < lineCount; lineNumber++) {
		const line = editor.getLine(lineNumber);

		if (lineNumber === 0 && line.trim() === "---") {
			inFrontMatter = true;
			continue;
		}

		if (inFrontMatter) {
			if (line.trim() === "---" || line.trim() === "...") {
				inFrontMatter = false;
			}
			continue;
		}

		if (isFenceLine(line)) {
			inFence = !inFence;
			continue;
		}

		if (inFence) {
			continue;
		}

		const headingMatch = line.match(/^(\s{0,3})(#{1,6})(\s+)(.+)$/);
		if (!headingMatch) {
			continue;
		}

		const level = headingMatch[2].length;
		minLevel = minLevel === null ? level : Math.min(minLevel, level);
	}

	return minLevel;
}
