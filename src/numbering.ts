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

	console.log(`[HeadIndex] ===== Starting numbering =====`);
	console.log(`[HeadIndex] Options: startFrom=${startFrom}, separator="${separator}", trailingMode="${trailingMode}", spaceAfterNumber=${spaceAfterNumber}`);
	console.log(`[HeadIndex] Base level: ${baseLevel}, Total lines: ${lineCount}`);

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

		const level = hashes.length;
		const normalizedLevel = Math.max(1, level - baseLevel + 1);

		adjustCountersForLevel(counters, normalizedLevel, startFrom);

		const current = counters[normalizedLevel - 1] ?? startFrom - 1;
		counters[normalizedLevel - 1] = current + 1;

		const numbering = formatNumbering(counters, normalizedLevel, separator, trailingMode);
		const spacing = spaceAfterNumber ? " " : "";
		const escapedSeparator = escapeRegex(separator);

		console.log(`[HeadIndex DEBUG] Line ${lineNumber + 1}:`);
		console.log(`  Original line: "${line}"`);
		console.log(`  Content: "${content}"`);
		console.log(`  Level: ${level}, NormalizedLevel: ${normalizedLevel}`);
		console.log(`  Generated numbering: "${numbering}"`);
		console.log(`  Separator: "${separator}", SpaceAfterNumber: ${spaceAfterNumber}`);

		// FIRST: Check if the line already has the correct numbering
		// This must be done BEFORE calling stripExistingNumbering to prevent infinite loops
		// For multi-level numbering like "2.1", we need to match the full pattern including trailing separator
		// Pattern: "2.1 " or "2.1" (with or without trailing separator and space)
		const numberingWithTrailing = trailingMode === "all" || (trailingMode === "root-only" && normalizedLevel === 1) 
			? `${numbering}${separator}` 
			: numbering;
		
		// Try to match existing numbering with space after the numbering
		// This matches patterns like "2.1 磁盘布局" or "2.1. 磁盘布局"
		// Pattern: number(s) separated by separator, optionally followed by separator, then space and content
		// For "2.1 磁盘布局": matches "2.1" as numbering, "磁盘布局" as content
		const patternWithSpaceStr = `^(\\d+(?:${escapedSeparator}\\d+)*)${escapedSeparator}?\\s+(.+)$`;
		const patternWithSpace = new RegExp(patternWithSpaceStr);
		const matchWithSpace = content.match(patternWithSpace);
		
		// Try to match existing numbering without space
		// This matches patterns like "2.1磁盘布局" (no space after numbering)
		// Pattern: number(s) separated by separator, then separator, then content (no space)
		const patternNoSpaceStr = `^(\\d+(?:${escapedSeparator}\\d+)*)${escapedSeparator}([^\\s].+)$`;
		const patternNoSpace = new RegExp(patternNoSpaceStr);
		const matchNoSpace = content.match(patternNoSpace);
		
		// Try to match single digit at start followed by non-digit content (like "1结构")
		// This handles cases where user wrote "1结构" meaning "1. 结构"
		// Only match if the content after the digit is not a digit and has at least one character
		const patternDigitStartStr = `^(\\d)([^\\d\\s${escapedSeparator}].+)$`;
		const patternDigitStart = new RegExp(patternDigitStartStr);
		const matchDigitStart = content.match(patternDigitStart);
		
		console.log(`  Pattern with space: ${patternWithSpaceStr}`);
		console.log(`  Pattern without space: ${patternNoSpaceStr}`);
		console.log(`  Pattern digit start: ${patternDigitStartStr}`);
		console.log(`  Match with space:`, matchWithSpace ? `found "${matchWithSpace[1]}" -> "${matchWithSpace[2]}"` : 'none');
		console.log(`  Match without space:`, matchNoSpace ? `found "${matchNoSpace[1]}" -> "${matchNoSpace[2]}"` : 'none');
		console.log(`  Match digit start:`, matchDigitStart ? `found "${matchDigitStart[1]}" -> "${matchDigitStart[2]}"` : 'none');
		
		// Check if existing numbering matches expected numbering
		let shouldSkip = false;
		if (matchWithSpace) {
			const existingNumbering = matchWithSpace[1];
			const existingContent = matchWithSpace[2].trim();
			console.log(`  Existing numbering: "${existingNumbering}", Expected: "${numbering}"`);
			console.log(`  Existing content: "${existingContent}"`);
			// If numbering matches exactly, check if the rest of the line matches expected format
			if (existingNumbering === numbering) {
				// Check if the line already matches the expected format
				const expectedLine = `${indent}${hashes} ${numbering}${spacing}${existingContent}`.trimEnd();
				const normalizedLine = line.replace(/\s+/g, ' ').trimEnd();
				const normalizedExpected = expectedLine.replace(/\s+/g, ' ').trimEnd();
				console.log(`  Normalized line: "${normalizedLine}"`);
				console.log(`  Normalized expected: "${normalizedExpected}"`);
				if (normalizedLine === normalizedExpected) {
					console.log(`  -> SKIPPING: Line already has correct numbering`);
					shouldSkip = true;
				} else {
					console.log(`  -> Numbering matches but format differs, will reformat`);
				}
			} else {
				console.log(`  -> Numbering mismatch, will replace`);
			}
		} else if (matchNoSpace) {
			const existingNumbering = matchNoSpace[1];
			const afterSeparator = matchNoSpace[2];
			console.log(`  Existing numbering (no space): "${existingNumbering}", Expected: "${numbering}"`);
			console.log(`  After separator: "${afterSeparator}"`);
			// Only consider it a match if the content after separator doesn't start with a digit
			if (afterSeparator && afterSeparator.trim().length > 0 && !/^\s*\d/.test(afterSeparator)) {
				const existingContent = afterSeparator.trim();
				console.log(`  Existing content: "${existingContent}"`);
				// If numbering matches exactly, check if we should keep it as-is or reformat
				if (existingNumbering === numbering) {
					// If spaceAfterNumber is true, we need to reformat to add space
					// If spaceAfterNumber is false, we can skip if format matches
					if (!spaceAfterNumber) {
						const expectedLine = `${indent}${hashes} ${numbering}${existingContent}`.trimEnd();
						const normalizedLine = line.replace(/\s+/g, ' ').trimEnd();
						const normalizedExpected = expectedLine.replace(/\s+/g, ' ').trimEnd();
						console.log(`  Normalized line: "${normalizedLine}"`);
						console.log(`  Normalized expected: "${normalizedExpected}"`);
						if (normalizedLine === normalizedExpected) {
							console.log(`  -> SKIPPING: Line already has correct numbering (no space mode)`);
							shouldSkip = true;
						} else {
							console.log(`  -> Numbering matches but format differs, will reformat`);
						}
					} else {
						console.log(`  -> Numbering matches but need to add space, will reformat`);
					}
				} else {
					console.log(`  -> Numbering mismatch, will replace`);
				}
			} else {
				console.log(`  -> After separator starts with digit or empty, not a valid numbering match`);
			}
		} else if (matchDigitStart) {
			// Handle case like "1结构" - treat single digit as numbering prefix
			const existingNumbering = matchDigitStart[1];
			const existingContent = matchDigitStart[2];
			console.log(`  Existing numbering (digit start): "${existingNumbering}", Expected: "${numbering}"`);
			console.log(`  Existing content: "${existingContent}"`);
			// Check if the single digit matches the first part of expected numbering
			// For "1." numbering, the digit "1" should match
			const expectedFirstDigit = numbering.split(separator)[0];
			if (existingNumbering === expectedFirstDigit && normalizedLevel === 1) {
				// This is a top-level heading with single digit, treat as numbering
				// Check if line would match expected format after reformatting
				const expectedLine = `${indent}${hashes} ${numbering}${spacing}${existingContent}`.trimEnd();
				const normalizedLine = line.replace(/\s+/g, ' ').trimEnd();
				const normalizedExpected = expectedLine.replace(/\s+/g, ' ').trimEnd();
				console.log(`  Normalized line: "${normalizedLine}"`);
				console.log(`  Normalized expected: "${normalizedExpected}"`);
				if (normalizedLine === normalizedExpected) {
					console.log(`  -> SKIPPING: Line already has correct numbering (digit start)`);
					shouldSkip = true;
				} else {
					console.log(`  -> Digit matches but format differs, will reformat`);
				}
			} else {
				console.log(`  -> Digit doesn't match expected numbering, will replace`);
			}
		} else {
			console.log(`  -> No numbering pattern found in content`);
		}

		if (shouldSkip) {
			processedHeadings++;
			continue;
		}

		// SECOND: Strip existing numbering and generate new line
		const cleanTitle = stripExistingNumbering(content, separator, spaceAfterNumber);
		console.log(`  Clean title after stripExistingNumbering: "${cleanTitle}"`);
		const newLine = `${indent}${hashes} ${numbering}${spacing}${cleanTitle}`.trimEnd();
		console.log(`  New line: "${newLine}"`);

		// Normalize both lines for comparison: collapse multiple spaces to single space
		// This prevents infinite loops when the line has different spacing
		const normalizedLine = line.replace(/\s+/g, ' ').trimEnd();
		const normalizedNewLine = newLine.replace(/\s+/g, ' ').trimEnd();

		console.log(`  Normalized original: "${normalizedLine}"`);
		console.log(`  Normalized new: "${normalizedNewLine}"`);
		console.log(`  Will modify: ${normalizedNewLine !== normalizedLine}`);

		if (normalizedNewLine !== normalizedLine) {
			editor.setLine(lineNumber, newLine);
			changed = true;
			console.log(`  -> MODIFIED line ${lineNumber + 1}`);
		} else {
			console.log(`  -> No change needed`);
		}

		processedHeadings++;
	}

	console.log(`[HeadIndex] ===== Finished numbering =====`);
	console.log(`[HeadIndex] Processed headings: ${processedHeadings}, Changed: ${changed}`);
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

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripExistingNumbering(content: string, separator: string, spaceAfterNumber: boolean): string {
	const escapedSeparator = escapeRegex(separator);
	let result = content.trim();
	let changed = true;
	let iteration = 0;
	
	console.log(`    [stripExistingNumbering] Input: "${result}"`);
	
	// Recursively strip numbering patterns until no more matches
	// This handles cases like "2.1 2.1 2.1 磁盘布局" -> "磁盘布局"
	while (changed && iteration < 10) { // Limit iterations to prevent infinite loops
		iteration++;
		changed = false;
		
		console.log(`    [stripExistingNumbering] Iteration ${iteration}, current: "${result}"`);
		
		// Try matching with space first
		// Match pattern like "2.1 磁盘布局" or "2.1. 磁盘布局"
		// The separator after the last number is optional (for trailing separator)
		const patternWithSpace = new RegExp(`^(\\d+(?:${escapedSeparator}\\d+)*)${escapedSeparator}?\\s+(.+)$`);
		const matchWithSpace = result.match(patternWithSpace);
		if (matchWithSpace) {
			const afterNumbering = matchWithSpace[2].trim();
			console.log(`    [stripExistingNumbering] Matched with space: "${matchWithSpace[1]}" -> "${afterNumbering}"`);
			// Only strip if there's actual content after the numbering
			if (afterNumbering.length > 0) {
				result = afterNumbering;
				changed = true;
				continue;
			}
		}
		
		// Try matching without space
		// Match pattern like "2.1磁盘布局" (no space after numbering)
		const patternNoSpace = new RegExp(`^(\\d+(?:${escapedSeparator}\\d+)*)${escapedSeparator}(.+)$`);
		const matchNoSpace = result.match(patternNoSpace);
		if (matchNoSpace) {
			const afterSeparator = matchNoSpace[2];
			console.log(`    [stripExistingNumbering] Matched without space: "${matchNoSpace[1]}" -> "${afterSeparator}"`);
			// Only strip if:
			// 1. There is content after the separator
			// 2. The content doesn't start with a digit (to avoid matching "1.5" as numbering)
			// 3. The content is not empty after trimming
			if (afterSeparator && afterSeparator.trim().length > 0 && !/^\s*\d/.test(afterSeparator)) {
				result = afterSeparator.trim();
				changed = true;
				console.log(`    [stripExistingNumbering] Stripped to: "${result}"`);
				continue;
			} else {
				console.log(`    [stripExistingNumbering] Rejected: afterSeparator="${afterSeparator}", startsWithDigit=${/^\s*\d/.test(afterSeparator)}`);
			}
		}
		
		// Try matching single digit at start followed by non-digit content (like "1结构")
		// Only do this if we haven't matched anything else yet
		if (!changed) {
			const patternDigitStart = new RegExp(`^(\\d)([^\\d\\s${escapedSeparator}].+)$`);
			const matchDigitStart = result.match(patternDigitStart);
			if (matchDigitStart) {
				const afterDigit = matchDigitStart[2];
				console.log(`    [stripExistingNumbering] Matched digit start: "${matchDigitStart[1]}" -> "${afterDigit}"`);
				// Only strip if there's actual content after the digit
				if (afterDigit && afterDigit.trim().length > 0) {
					result = afterDigit.trim();
					changed = true;
					console.log(`    [stripExistingNumbering] Stripped to: "${result}"`);
					continue;
				}
			}
		}
	}
	
	if (iteration >= 10) {
		console.warn(`    [stripExistingNumbering] WARNING: Reached iteration limit!`);
	}
	
	console.log(`    [stripExistingNumbering] Final result: "${result}"`);
	return result;
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
