import { ParsedNumbering } from "./types";

enum ParserState {
	START,
	READING_DIGIT,
	READING_SEPARATOR,
	READING_SPACE,
	READING_CONTENT,
	DONE,
}

export class NumberingParser {
	private separator: string;
	private state: ParserState = ParserState.START;
	private numbering: string = "";
	private content: string = "";
	private hasSpace: boolean = false;
	private startIndex: number = 0;
	private currentIndex: number = 0;
	private digits: string[] = [];

	constructor(separator: string) {
		this.separator = separator;
	}

	parse(text: string): ParsedNumbering {
		this.reset();
		const trimmed = text.trim();
		
		if (trimmed.length === 0) {
			return this.createResult(false);
		}

		for (let i = 0; i < trimmed.length; i++) {
			this.currentIndex = i;
			const char = trimmed[i];
			
			if (!this.processChar(char)) {
				break;
			}
		}

		// Finalize parsing
		if (this.state === ParserState.READING_DIGIT && this.digits.length > 0) {
			this.finalizeNumbering();
		}

		// If we have numbering but no content, try to extract content from remaining text
		if (this.numbering && !this.content && this.currentIndex < trimmed.length) {
			this.content = trimmed.substring(this.currentIndex).trim();
		}

		return this.createResult(this.numbering.length > 0 && this.content.length > 0);
	}

	private reset(): void {
		this.state = ParserState.START;
		this.numbering = "";
		this.content = "";
		this.hasSpace = false;
		this.startIndex = 0;
		this.currentIndex = 0;
		this.digits = [];
	}

	private processChar(char: string): boolean {
		switch (this.state) {
			case ParserState.START:
				return this.handleStart(char);
			case ParserState.READING_DIGIT:
				return this.handleReadingDigit(char);
			case ParserState.READING_SEPARATOR:
				return this.handleReadingSeparator(char);
			case ParserState.READING_SPACE:
				return this.handleReadingSpace(char);
			case ParserState.READING_CONTENT:
				return this.handleReadingContent(char);
			case ParserState.DONE:
				return false;
		}
	}

	private handleStart(char: string): boolean {
		if (this.isDigit(char)) {
			this.startIndex = this.currentIndex;
			this.digits.push(char);
			this.state = ParserState.READING_DIGIT;
			return true;
		}
		return false;
	}

	private handleReadingDigit(char: string): boolean {
		if (this.isDigit(char)) {
			this.digits.push(char);
			return true;
		} else if (char === this.separator) {
			this.finalizeDigit();
			this.state = ParserState.READING_SEPARATOR;
			return true;
		} else if (this.isWhitespace(char)) {
			// Single digit followed by space (e.g., "1 内容")
			if (this.digits.length === 1) {
				this.finalizeNumbering();
				this.hasSpace = true;
				this.state = ParserState.READING_CONTENT;
				return true;
			}
			// Multi-digit followed by space (e.g., "12 内容")
			this.finalizeNumbering();
			this.hasSpace = true;
			this.state = ParserState.READING_CONTENT;
			return true;
		} else {
			// Single digit followed by non-digit, non-separator, non-space (e.g., "1内容")
			if (this.digits.length === 1) {
				this.finalizeNumbering();
				this.state = ParserState.READING_CONTENT;
				return true;
			}
			// Multi-digit without separator - not a valid numbering pattern
			return false;
		}
	}

	private handleReadingSeparator(char: string): boolean {
		if (this.isDigit(char)) {
			this.digits.push(char);
			this.state = ParserState.READING_DIGIT;
			return true;
		} else if (this.isWhitespace(char)) {
			// Separator followed by space (e.g., "2.1 内容")
			this.finalizeNumbering();
			this.hasSpace = true;
			this.state = ParserState.READING_SPACE;
			return true;
		} else if (char === this.separator) {
			// Trailing separator (e.g., "2.1.内容")
			this.finalizeNumbering();
			this.state = ParserState.READING_CONTENT;
			return true;
		} else {
			// Separator followed by content (e.g., "2.1内容" or "2.布局")
			// Important: finalize numbering first, then add the current char to content
			this.finalizeNumbering();
			this.state = ParserState.READING_CONTENT;
			// Add the current character to content immediately
			this.content += char;
			return true;
		}
	}

	private handleReadingSpace(char: string): boolean {
		if (!this.isWhitespace(char)) {
			this.state = ParserState.READING_CONTENT;
			return this.handleReadingContent(char);
		}
		return true;
	}

	private handleReadingContent(char: string): boolean {
		this.content += char;
		return true;
	}
	
	// Debug method to log parser state
	public getState(): { numbering: string; content: string; state: string } {
		return {
			numbering: this.numbering,
			content: this.content,
			state: ParserState[this.state],
		};
	}

	private finalizeDigit(): void {
		if (this.digits.length > 0) {
			if (this.numbering) {
				this.numbering += this.separator;
			}
			this.numbering += this.digits.join("");
			this.digits = [];
		}
	}

	private finalizeNumbering(): void {
		if (this.digits.length > 0) {
			this.finalizeDigit();
		}
	}

	private createResult(isValid: boolean): ParsedNumbering {
		return {
			numbering: this.numbering,
			content: this.content.trim(),
			hasSpace: this.hasSpace,
			isValid,
			startIndex: this.startIndex,
			endIndex: this.currentIndex,
		};
	}

	private isDigit(char: string): boolean {
		return /^\d$/.test(char);
	}

	private isWhitespace(char: string): boolean {
		return /^\s$/.test(char);
	}
}

