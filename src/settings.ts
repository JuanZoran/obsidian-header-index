import { App, PluginSettingTab, Setting } from "obsidian";
import type HeadIndexPlugin from "../main";

export interface HeadIndexSettings {
	autoNumberOnFileOpen: boolean;
	startFromZero: boolean;
	autoTriggerMode: "off" | "on-edit" | "on-save";
	separator: string;
	trailingMode: "all" | "root-only" | "none";
	spaceAfterNumber: boolean;
	debugMode: boolean;
}

export const DEFAULT_SETTINGS: HeadIndexSettings = {
	autoNumberOnFileOpen: false,
	startFromZero: false,
	autoTriggerMode: "off",
	separator: ".",
	trailingMode: "all",
	spaceAfterNumber: true,
	debugMode: false,
};

export class HeadIndexSettingTab extends PluginSettingTab {
	plugin: HeadIndexPlugin;

	constructor(app: App, plugin: HeadIndexPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "标题编号" });

		new Setting(containerEl)
			.setName("打开文件时自动编号")
			.setDesc("在打开 Markdown 笔记时自动为标题添加层级编号。")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoNumberOnFileOpen)
					.onChange(async (value) => {
						this.plugin.settings.autoNumberOnFileOpen = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("编号从 0 开始")
			.setDesc("开启后，最外层标题从 0 开始计数（否则从 1 开始）。")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.startFromZero)
					.onChange(async (value) => {
						this.plugin.settings.startFromZero = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("自动编号触发方式")
			.setDesc("选择自动运行编号的时机：实时去抖或保存时。")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("off", "关闭自动编号")
					.addOption("on-edit", "编辑时（去抖）")
					.addOption("on-save", "保存时")
					.setValue(this.plugin.settings.autoTriggerMode)
					.onChange(async (value: "off" | "on-edit" | "on-save") => {
						this.plugin.settings.autoTriggerMode = value;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl("h3", { text: "编号格式" });

		new Setting(containerEl)
			.setName("分隔符")
			.setDesc("数字之间使用的分隔符（留空则使用.）。")
			.addText((text) =>
				text
					.setPlaceholder(".")
					.setValue(this.plugin.settings.separator)
					.onChange(async (value) => {
						const trimmed = value.trim();
						this.plugin.settings.separator = trimmed.length > 0 ? trimmed : ".";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("末尾添加分隔符")
			.setDesc("选择末尾分隔符策略：全部/仅顶级/不保留。")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("all", "全部保留")
					.addOption("root-only", "仅顶级")
					.addOption("none", "不保留")
					.setValue(this.plugin.settings.trailingMode)
					.onChange(async (value: "all" | "root-only" | "none") => {
						this.plugin.settings.trailingMode = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("编号后加空格")
			.setDesc("编号和标题之间插入一个空格。")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.spaceAfterNumber)
					.onChange(async (value) => {
						this.plugin.settings.spaceAfterNumber = value;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl("h3", { text: "调试" });

		new Setting(containerEl)
			.setName("调试模式")
			.setDesc("开启后会在控制台输出详细的调试信息，用于定位问题。")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
