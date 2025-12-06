import { Editor } from "obsidian";
import {
	NumberingResult,
	NumberingOptions,
	LineChange,
	MarkdownState,
} from "./types";
import { NumberingParser } from "./numbering-parser";
import {
	parseMarkdownState,
	isInCodeBlock,
	parseHeading,
	findBaseHeadingLevel,
} from "./parser";
import {
	formatNumbering,
	sanitizeSeparator,
	normalizeLine,
	adjustCountersForLevel,
} from "./formatter";
import { MAX_STRIP_ITERATIONS } from "./constants";

export function applyHeadingNumbering(
	editor: Editor,
	options: NumberingOptions = { startFrom: 1 },
): NumberingResult {
	const startFrom = Math.max(0, Math.floor(options.startFrom ?? 1));
	const separator = sanitizeSeparator(options.separator);
	const trailingMode = options.trailingMode ?? "all";
	const spaceAfterNumber = options.spaceAfterNumber ?? true;
	const debugMode = options.debugMode ?? false;
	const parser = new NumberingParser(separator);
	const counters: number[] = [];
	let state: MarkdownState = { inFence: false, inFrontMatter: false };
	let processedHeadings = 0;

	const baseLevel = findBaseHeadingLevel(editor) ?? 1;
	const lineCount = editor.lineCount();
	const changes: LineChange[] = [];

	for (let lineNumber = 0; lineNumber < lineCount; lineNumber++) {
		state = parseMarkdownState(editor, lineNumber, state);

		if (isInCodeBlock(state)) {
			continue;
		}

		const line = editor.getLine(lineNumber);
		const heading = parseHeading(line);
		if (!heading) {
			continue;
		}

		const normalizedLevel = Math.max(1, heading.level - baseLevel + 1);
		adjustCountersForLevel(counters, normalizedLevel, startFrom);

		const current = counters[normalizedLevel - 1] ?? startFrom - 1;
		counters[normalizedLevel - 1] = current + 1;

		const expectedNumbering = formatNumbering(
			counters,
			normalizedLevel,
			separator,
			trailingMode,
		);
		const spacing = spaceAfterNumber ? " " : "";

		// Check if line needs updating
		const change = processHeadingLine(
			parser,
			heading,
			expectedNumbering,
			separator,
			spacing,
			normalizedLevel,
			spaceAfterNumber,
			debugMode,
		);

		if (change) {
			changes.push({ lineNumber, newContent: change });
		}

		processedHeadings++;
	}

	// Save cursor position and line content before making changes
	const cursor = editor.getCursor();
	const cursorLine = cursor.line;
	const cursorCh = cursor.ch;
	const oldCursorLineContent = cursorLine < lineCount ? editor.getLine(cursorLine) : "";

	// Apply all changes
	let changed = false;
	const modifiedLines = new Set<number>();
	for (const change of changes) {
		editor.setLine(change.lineNumber, change.newContent);
		modifiedLines.add(change.lineNumber);
		changed = true;
	}

	// Restore cursor position, adjusting for content changes if needed
	if (changed && modifiedLines.has(cursorLine)) {
		const newLine = editor.getLine(cursorLine);
		restoreCursorPosition(
			editor,
			cursorLine,
			cursorCh,
			oldCursorLineContent,
			newLine,
			separator,
			parser,
		);
	} else if (changed) {
		// Line wasn't modified, but other lines were - restore original position
		editor.setCursor(cursor);
	}

	return { changed, processedHeadings };
}

function restoreCursorPosition(
	editor: Editor,
	cursorLine: number,
	cursorCh: number,
	oldCursorLineContent: string,
	newLine: string,
	separator: string,
	parser: NumberingParser,
): void {
	// Parse the old and new heading to understand the change
	const oldHeading = parseHeading(oldCursorLineContent);
	const newHeading = parseHeading(newLine);
	
	if (oldHeading && newHeading) {
		// Calculate where the actual content (after numbering) starts
		const oldPrefix = `${oldHeading.indent}${oldHeading.hashes} `;
		const newPrefix = `${newHeading.indent}${newHeading.hashes} `;
		
		// Parse numbering from old and new content to find content start
		const oldParsed = parser.parse(oldHeading.content);
		const newParsed = parser.parse(newHeading.content);
		
		// Calculate the length of numbering part in the original content string
		// Find where the actual text content starts after the numbering
		let oldNumberingLength = 0;
		if (oldParsed.isValid && oldParsed.numbering) {
			// Find the numbering in the original content
			const numberingIndex = oldHeading.content.indexOf(oldParsed.numbering);
			if (numberingIndex >= 0) {
				// Numbering found, calculate length including separator/space
				oldNumberingLength = numberingIndex + oldParsed.numbering.length;
				// Check for separator or space after numbering
				if (oldNumberingLength < oldHeading.content.length) {
					const charAfter = oldHeading.content[oldNumberingLength];
					if (charAfter === separator || charAfter === " ") {
						oldNumberingLength += 1;
					}
				}
			}
		}
		
		let newNumberingLength = 0;
		if (newParsed.isValid && newParsed.numbering) {
			// Find the numbering in the new content
			const numberingIndex = newHeading.content.indexOf(newParsed.numbering);
			if (numberingIndex >= 0) {
				// Numbering found, calculate length including separator/space
				newNumberingLength = numberingIndex + newParsed.numbering.length;
				// Check for separator or space after numbering
				if (newNumberingLength < newHeading.content.length) {
					const charAfter = newHeading.content[newNumberingLength];
					if (charAfter === separator || charAfter === " ") {
						newNumberingLength += 1;
					}
				}
			}
		}
		
		// Calculate where actual text content starts (after prefix + numbering)
		const oldContentStart = oldPrefix.length + oldNumberingLength;
		const newContentStart = newPrefix.length + newNumberingLength;
		
		// If cursor was in the content area (after prefix and numbering), preserve relative position
		if (cursorCh >= oldContentStart) {
			// Cursor was in content area - preserve offset within content
			const offsetInContent = cursorCh - oldContentStart;
			const newCh = newContentStart + offsetInContent;
			// Ensure cursor doesn't go beyond line length
			editor.setCursor({ line: cursorLine, ch: Math.min(newCh, newLine.length) });
		} else {
			// Cursor was in prefix or numbering area - move to start of content
			editor.setCursor({ line: cursorLine, ch: newContentStart });
		}
	} else {
		// Fallback: adjust cursor position based on line length
		let newCh = cursorCh;
		if (newLine.length < cursorCh) {
			newCh = Math.max(0, newLine.length);
		}
		editor.setCursor({ line: cursorLine, ch: newCh });
	}
}

function processHeadingLine(
	parser: NumberingParser,
	heading: { indent: string; hashes: string; content: string },
	expectedNumbering: string,
	separator: string,
	spacing: string,
	normalizedLevel: number,
	spaceAfterNumber: boolean,
	debugMode: boolean,
): string | null {
	const parsed = parser.parse(heading.content);
	
	if (debugMode) {
		console.log("[HeadIndex Debug] Processing heading:", {
			line: `${heading.indent}${heading.hashes} ${heading.content}`,
			headingContent: heading.content,
			parsed: {
				isValid: parsed.isValid,
				numbering: parsed.numbering,
				content: parsed.content,
				contentLength: parsed.content.length,
				hasSpace: parsed.hasSpace,
			},
			expectedNumbering,
			separator,
			spaceAfterNumber,
			spacing,
		});
	}

	// Handle special case: single digit at start (e.g., "1内容")
	// Only for top-level headings where the digit matches the first part of expected numbering
	if (
		!parsed.isValid &&
		normalizedLevel === 1 &&
		heading.content.length > 0
	) {
		const firstChar = heading.content[0];
		if (/\d/.test(firstChar)) {
			const expectedFirstDigit = expectedNumbering.split(separator)[0];
			if (firstChar === expectedFirstDigit) {
				// Treat as numbering match, but need to reformat
				const content = heading.content.substring(1).trim();
				const expectedLine = `${heading.indent}${heading.hashes} ${expectedNumbering}${spacing}${content}`.trimEnd();
				const normalizedExpected = normalizeLine(expectedLine);
				const normalizedCurrent = normalizeLine(
					`${heading.indent}${heading.hashes} ${heading.content}`.trimEnd(),
				);
				if (normalizedCurrent !== normalizedExpected) {
					return expectedLine;
				}
				return null;
			}
		}
	}

	// Check if numbering matches (considering trailing separator)
	// When expectedNumbering is "2." and parsed.numbering is "2", they should match
	const expectedNumberingCore = expectedNumbering.endsWith(separator)
		? expectedNumbering.slice(0, -separator.length)
		: expectedNumbering;
	const parsedNumberingCore = parsed.numbering;
	const numberingMatches = parsed.isValid && parsedNumberingCore === expectedNumberingCore;
	
	if (debugMode) {
		console.log("[HeadIndex Debug] Numbering comparison:", {
			expectedNumbering,
			expectedNumberingCore,
			parsedNumbering: parsed.numbering,
			parsedNumberingCore,
			numberingMatches,
		});
	}

	// If no numbering found or numbering doesn't match, add/update it
	if (!parsed.isValid || !numberingMatches) {
		const cleanContent = parsed.isValid
			? stripNumberingRecursive(parser, parsed.content, MAX_STRIP_ITERATIONS, debugMode)
			: heading.content;
		
		if (debugMode) {
			console.log("[HeadIndex Debug] Updating heading:", {
				original: heading.content,
				cleanContent,
				newLine: `${heading.indent}${heading.hashes} ${expectedNumbering}${spacing}${cleanContent}`.trimEnd(),
			});
		}
		
		return `${heading.indent}${heading.hashes} ${expectedNumbering}${spacing}${cleanContent}`.trimEnd();
	}

	// Numbering matches, check if format is correct
	const expectedLine = `${heading.indent}${heading.hashes} ${expectedNumbering}${spacing}${parsed.content}`.trimEnd();
	const normalizedExpected = normalizeLine(expectedLine);
	const normalizedCurrent = normalizeLine(
		`${heading.indent}${heading.hashes} ${heading.content}`.trimEnd(),
	);

	if (debugMode) {
		console.log("[HeadIndex Debug] Format check:", {
			expectedLine,
			normalizedExpected,
			currentLine: `${heading.indent}${heading.hashes} ${heading.content}`,
			normalizedCurrent,
			matches: normalizedCurrent === normalizedExpected,
		});
	}

	// If format differs, reformat
	if (normalizedCurrent !== normalizedExpected) {
		if (debugMode) {
			console.log("[HeadIndex Debug] Format differs, reformatting to:", expectedLine);
		}
		return expectedLine;
	}

	// Line is already correct
	return null;
}

function stripNumberingRecursive(
	parser: NumberingParser,
	content: string,
	maxIterations: number,
	debugMode: boolean = false,
): string {
	let result = content.trim();
	let changed = true;
	let iteration = 0;

	if (debugMode) {
		console.log("[HeadIndex Debug] stripNumberingRecursive start:", { content, result });
	}

	while (changed && iteration < maxIterations) {
		iteration++;
		changed = false;

		const parsed = parser.parse(result);

		if (debugMode) {
			console.log(`[HeadIndex Debug] stripNumberingRecursive iteration ${iteration}:`, {
				result,
				parsed: {
					isValid: parsed.isValid,
					numbering: parsed.numbering,
					content: parsed.content,
				},
			});
		}

		if (parsed.isValid && parsed.content.length > 0) {
			// Check if content after numbering doesn't start with a digit
			// to avoid matching cases like "1.5" as numbering
			if (!/^\s*\d/.test(parsed.content)) {
				result = parsed.content;
				changed = true;
			}
		}
	}

	if (iteration >= maxIterations) {
		console.warn(
			`[HeadIndex] WARNING: Reached iteration limit while stripping numbering!`,
		);
	}

	if (debugMode) {
		console.log("[HeadIndex Debug] stripNumberingRecursive end:", { result, iterations: iteration });
	}

	return result;
}

