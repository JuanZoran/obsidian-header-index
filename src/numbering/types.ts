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
	debugMode?: boolean;
}

export interface ParsedNumbering {
	numbering: string;
	content: string;
	hasSpace: boolean;
	isValid: boolean;
	startIndex: number;
	endIndex: number;
}

export interface LineChange {
	lineNumber: number;
	newContent: string;
}

export interface MarkdownState {
	inFence: boolean;
	inFrontMatter: boolean;
}

