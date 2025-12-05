import { Editor, Plugin } from "obsidian";

export interface NumberingHost {
	applyNumbering: (editor?: Editor, options?: { silent?: boolean }) => Promise<boolean> | boolean;
	addCommand: Plugin["addCommand"];
}

export function registerCommands(plugin: NumberingHost) {
	plugin.addCommand({
		id: "number-headings-in-note",
		name: "为当前笔记添加标题编号",
		editorCallback: async (editor) => {
			await plugin.applyNumbering(editor);
		},
	});
}
