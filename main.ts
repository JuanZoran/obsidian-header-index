import { Editor, MarkdownView, Notice, Plugin, debounce } from "obsidian";
import { registerCommands } from "./src/commands";
import { applyHeadingNumbering } from "./src/numbering";
import { DEFAULT_SETTINGS, HeadIndexSettingTab, HeadIndexSettings } from "./src/settings";
import { AUTO_NUMBER_DEBOUNCE_MS, AUTO_NUMBER_EVENT_THRESHOLD } from "./src/numbering/constants";

export default class HeadIndexPlugin extends Plugin {
	settings: HeadIndexSettings;
	private numberingInProgress = false;
	private changeEventsSinceLastNumbering = 0;
	private lastNumberingTimestamp = 0;
	private debouncedAutoNumber = debounce(
		(editor: Editor) => {
			if (this.settings.autoTriggerMode !== "on-edit") return;
			if (this.numberingInProgress) return;

			const shouldRun =
				this.isHeadingContext(editor) ||
				this.changeEventsSinceLastNumbering >= AUTO_NUMBER_EVENT_THRESHOLD;

			if (!shouldRun) {
				return;
			}

			this.applyNumbering(editor, { silent: true });
		},
		AUTO_NUMBER_DEBOUNCE_MS,
	);

	async onload() {
		await this.loadSettings();

		registerCommands(this);
		this.addSettingTab(new HeadIndexSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on("file-open", () => {
				if (this.settings.autoNumberOnFileOpen) {
					this.applyNumbering(undefined, { silent: true });
				}
			}),
		);

		this.registerEvent(
			this.app.workspace.on("editor-change", (editor, view) => {
				if (!view) return;
				if (this.settings.autoTriggerMode !== "on-edit") return;
				// Ignore editor-change events triggered by our own numbering updates
				if (this.numberingInProgress) return;
				// Ignore events within 100ms of last numbering to prevent loop
				const now = Date.now();
				if (now - this.lastNumberingTimestamp < 100) return;
				this.changeEventsSinceLastNumbering += 1;
				this.debouncedAutoNumber(editor);
			}),
		);

		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (this.settings.autoTriggerMode !== "on-save") return;
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile || file.path !== activeFile.path) return;
				this.applyNumbering(undefined, { silent: true });
			}),
		);
	}

	async loadSettings() {
		const loaded = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);

		// Migration: Convert old autoNumberOnEdit setting to autoTriggerMode
		// Only migrate if autoTriggerMode was not explicitly set (i.e., it's using default value)
		// and the old autoNumberOnEdit setting exists
		if (loaded && "autoNumberOnEdit" in loaded && loaded.autoNumberOnEdit === true) {
			// Only migrate if autoTriggerMode is not explicitly set in saved data
			// This means it's either missing or using the default value
			if (!("autoTriggerMode" in loaded) || loaded.autoTriggerMode === DEFAULT_SETTINGS.autoTriggerMode) {
				this.settings.autoTriggerMode = "on-edit";
				// Remove the old field and save the migrated settings
				const settingsWithOldField = this.settings as HeadIndexSettings & { autoNumberOnEdit?: boolean };
				delete settingsWithOldField.autoNumberOnEdit;
				await this.saveSettings();
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async applyNumbering(editor?: Editor, options: { silent?: boolean } = {}): Promise<boolean> {
		if (this.numberingInProgress) {
			return false;
		}
		this.numberingInProgress = true;

		const silent = options.silent ?? false;

		try {
			const targetEditor = editor ?? this.getActiveEditor();

			if (!targetEditor) {
				if (!silent) {
					new Notice("请打开一个 Markdown 笔记后再进行标题编号。");
				}
				return false;
			}

			const startFrom = this.settings.startFromZero ? 0 : 1;
			const result = applyHeadingNumbering(targetEditor, {
				startFrom,
				separator: this.settings.separator,
				trailingMode: this.settings.trailingMode,
				spaceAfterNumber: this.settings.spaceAfterNumber,
				debugMode: this.settings.debugMode,
			});
			this.changeEventsSinceLastNumbering = 0;
			if (result.changed) {
				this.lastNumberingTimestamp = Date.now();
			}

			if (!silent) {
				if (result.processedHeadings === 0) {
					new Notice("未找到可编号的标题。");
				} else if (result.changed) {
					new Notice("已完成标题编号。");
				} else {
					new Notice("标题已是最新编号。");
				}
			}

			return result.changed;
		} finally {
			this.numberingInProgress = false;
		}
	}

	private getActiveEditor(): Editor | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.editor ?? null;
	}

	private isHeadingContext(editor: Editor): boolean {
		const total = editor.lineCount();
		const cursor = editor.getCursor();
		const indices = new Set<number>([cursor.line, cursor.line - 1, cursor.line + 1].filter((n) => n >= 0 && n < total));
		for (const idx of indices) {
			const text = editor.getLine(idx);
			if (/^\s{0,3}#{1,6}\s/.test(text)) {
				return true;
			}
		}
		return false;
	}
}
