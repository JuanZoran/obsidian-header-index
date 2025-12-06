import { Editor, Notice, Plugin } from "obsidian";
import { shiftHeadingLevels } from "./numbering/level-shift";

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

	plugin.addCommand({
		id: "increase-heading-levels",
		name: "提升所有标题级别",
		editorCallback: (editor) => {
			const result = shiftHeadingLevels(editor, "increase");
			if (result.processedHeadings === 0) {
				new Notice("未找到可调整的标题。");
			} else if (result.changed) {
				if (result.skippedHeadings > 0) {
					new Notice(`已提升 ${result.processedHeadings - result.skippedHeadings} 个标题级别，${result.skippedHeadings} 个标题已达到最大级别（6级）。`);
				} else {
					new Notice(`已提升 ${result.processedHeadings} 个标题级别。`);
				}
			} else {
				new Notice("所有标题已达到最大级别（6级），无法继续提升。");
			}
		},
	});

	plugin.addCommand({
		id: "decrease-heading-levels",
		name: "降低所有标题级别",
		editorCallback: (editor) => {
			const result = shiftHeadingLevels(editor, "decrease");
			if (result.processedHeadings === 0) {
				new Notice("未找到可调整的标题。");
			} else if (result.changed) {
				if (result.skippedHeadings > 0) {
					new Notice(`已降低 ${result.processedHeadings - result.skippedHeadings} 个标题级别，${result.skippedHeadings} 个标题已达到最小级别（1级）。`);
				} else {
					new Notice(`已降低 ${result.processedHeadings} 个标题级别。`);
				}
			} else {
				new Notice("所有标题已达到最小级别（1级），无法继续降低。");
			}
		},
	});
}
