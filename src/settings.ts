import { App, PluginSettingTab, Setting } from "obsidian";
import type HeadIndexPlugin from "../main";
import { DebugSettings, DEFAULT_DEBUG_SETTINGS } from "./debug";

export interface HeadIndexSettings {
	autoNumberOnFileOpen: boolean;
	startFromZero: boolean;
	autoTriggerMode: "off" | "on-edit" | "on-save";
	separator: string;
	trailingMode: "all" | "root-only" | "none";
	spaceAfterNumber: boolean;
	debug: DebugSettings;
	// 向后兼容：保留旧的 debugMode 字段（已废弃）
	debugMode?: boolean;
}

export const DEFAULT_SETTINGS: HeadIndexSettings = {
	autoNumberOnFileOpen: false,
	startFromZero: false,
	autoTriggerMode: "off",
	separator: ".",
	trailingMode: "all",
	spaceAfterNumber: true,
	debug: DEFAULT_DEBUG_SETTINGS,
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

		// 主调试开关
		const debugMainSetting = new Setting(containerEl)
			.setName("调试模式")
			.setDesc("开启后会在控制台输出详细的调试信息，用于定位问题。")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debug.enabled)
					.onChange(async (value) => {
						this.plugin.settings.debug.enabled = value;
						await this.plugin.saveSettings();
						// 更新调试系统
						await this.updateDebugSettings();
						// 重新渲染以更新子开关显示状态
						this.display();
					}),
			);

		// 子模块开关容器（可折叠）
		const debugModulesContainer = containerEl.createDiv({
			cls: "head-index-debug-modules",
			attr: {
				style: this.plugin.settings.debug.enabled
					? "display: block; margin-top: 10px;"
					: "display: none;",
			},
		});

		// 模块配置
		type DebugModuleKey = keyof typeof this.plugin.settings.debug.modules;
		const moduleConfigs: Array<{
			key: DebugModuleKey;
			name: string;
			desc: string;
		}> = [
			{
				key: "core",
				name: "核心编号逻辑",
				desc: "标题编号的主要处理流程",
			},
			{
				key: "parser",
				name: "编号解析器",
				desc: "解析现有编号格式",
			},
			{
				key: "cursor",
				name: "光标恢复",
				desc: "光标位置恢复逻辑",
			},
			{
				key: "strip",
				name: "内容清理",
				desc: "递归清理编号内容",
			},
			{
				key: "events",
				name: "事件处理",
				desc: "自动触发相关的事件处理",
			},
			{
				key: "format",
				name: "格式检查",
				desc: "格式匹配和规范化",
			},
		];

		// 创建子模块开关
		moduleConfigs.forEach((config) => {
			new Setting(debugModulesContainer)
				.setName(config.name)
				.setDesc(config.desc)
				.addToggle((toggle) => {
					const moduleKey: DebugModuleKey = config.key;
					toggle
						.setValue(this.plugin.settings.debug.modules[moduleKey])
						.setDisabled(!this.plugin.settings.debug.enabled)
						.onChange(async (value) => {
							this.plugin.settings.debug.modules[moduleKey] = value;
							await this.plugin.saveSettings();
							await this.updateDebugSettings();
						});
				});
		});
	}

	private async updateDebugSettings(): Promise<void> {
		const { Debug } = await import("./debug");
		Debug.init(this.plugin.settings.debug);
	}
}
