import { Editor } from "obsidian";
import { MarkdownState, LineChange } from "./types";
import {
	parseMarkdownState,
	isInCodeBlock,
	parseHeading,
} from "./parser";

export interface LevelShiftResult {
	changed: boolean;
	processedHeadings: number;
	skippedHeadings: number;
}

export type ShiftDirection = "increase" | "decrease";

export function shiftHeadingLevels(
	editor: Editor,
	direction: ShiftDirection,
): LevelShiftResult {
	let state: MarkdownState = { inFence: false, inFrontMatter: false };
	let processedHeadings = 0;
	let skippedHeadings = 0;

	const lineCount = editor.lineCount();
	const changes: LineChange[] = [];

	// Save cursor position before making changes
	const cursor = editor.getCursor();
	const cursorLine = cursor.line;
	const cursorCh = cursor.ch;
	const oldCursorLineContent = cursorLine < lineCount ? editor.getLine(cursorLine) : "";

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

		processedHeadings++;

		// Determine new level based on direction
		let newLevel: number;
		if (direction === "increase") {
			// Can't increase beyond level 6
			if (heading.level >= 6) {
				skippedHeadings++;
				continue;
			}
			newLevel = heading.level + 1;
		} else {
			// Can't decrease below level 1
			if (heading.level <= 1) {
				skippedHeadings++;
				continue;
			}
			newLevel = heading.level - 1;
		}

		// Create new hashes string
		const newHashes = "#".repeat(newLevel);

		// Build new line: preserve indent, new hashes, space, and content (with numbering preserved)
		const newLine = `${heading.indent}${newHashes} ${heading.content}`.trimEnd();

		// Only add change if the line actually differs
		if (line.trimEnd() !== newLine.trimEnd()) {
			changes.push({ lineNumber, newContent: newLine });
		}
	}

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
		);
	} else if (changed) {
		// Line wasn't modified, but other lines were - restore original position
		editor.setCursor(cursor);
	}

	return { changed, processedHeadings, skippedHeadings };
}

function restoreCursorPosition(
	editor: Editor,
	cursorLine: number,
	cursorCh: number,
	oldLine: string,
	newLine: string,
): void {
	// Parse the old and new heading to understand the change
	const oldHeading = parseHeading(oldLine);
	const newHeading = parseHeading(newLine);

	if (oldHeading && newHeading) {
		// Calculate where the actual content (after hashes and space) starts
		const oldPrefix = `${oldHeading.indent}${oldHeading.hashes} `;
		const newPrefix = `${newHeading.indent}${newHeading.hashes} `;

		// Calculate where actual text content starts (after prefix)
		const oldContentStart = oldPrefix.length;
		const newContentStart = newPrefix.length;

		// If cursor was in the content area (after prefix), preserve relative position
		if (cursorCh >= oldContentStart) {
			// Cursor was in content area - preserve offset within content
			const offsetInContent = cursorCh - oldContentStart;
			const newCh = newContentStart + offsetInContent;
			// Ensure cursor doesn't go beyond line length
			const finalCh = Math.min(newCh, newLine.length);
			editor.setCursor({ line: cursorLine, ch: finalCh });
		} else {
			// Cursor was in prefix area - move to start of content
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

