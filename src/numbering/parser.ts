import { Editor } from "obsidian";
import { MarkdownState } from "./types";

export function isFenceLine(line: string): boolean {
	return /^\s*(```|~~~)/.test(line);
}

export function parseMarkdownState(
	editor: Editor,
	lineNumber: number,
	currentState: MarkdownState,
): MarkdownState {
	const line = editor.getLine(lineNumber);
	const newState = { ...currentState };

	// Handle front matter
	if (lineNumber === 0 && line.trim() === "---") {
		newState.inFrontMatter = true;
		return newState;
	}

	if (newState.inFrontMatter) {
		if (line.trim() === "---" || line.trim() === "...") {
			newState.inFrontMatter = false;
		}
		return newState;
	}

	// Handle code fences
	if (isFenceLine(line)) {
		newState.inFence = !newState.inFence;
		return newState;
	}

	return newState;
}

export function isInCodeBlock(state: MarkdownState): boolean {
	return state.inFence || state.inFrontMatter;
}

export interface HeadingMatch {
	indent: string;
	hashes: string;
	level: number;
	content: string;
}

export function parseHeading(line: string): HeadingMatch | null {
	const match = line.match(/^(\s{0,3})(#{1,6})(\s+)(.+)$/);
	if (!match) {
		return null;
	}

	const [, indent, hashes, , rawContent] = match;
	const content = rawContent.trim();
	
	if (!content) {
		return null;
	}

	return {
		indent,
		hashes,
		level: hashes.length,
		content,
	};
}

export function findBaseHeadingLevel(editor: Editor): number | null {
	let state: MarkdownState = { inFence: false, inFrontMatter: false };
	let minLevel: number | null = null;
	const lineCount = editor.lineCount();

	for (let lineNumber = 0; lineNumber < lineCount; lineNumber++) {
		state = parseMarkdownState(editor, lineNumber, state);

		if (isInCodeBlock(state)) {
			continue;
		}

		const heading = parseHeading(editor.getLine(lineNumber));
		if (heading) {
			minLevel = minLevel === null ? heading.level : Math.min(minLevel, heading.level);
		}
	}

	return minLevel;
}

