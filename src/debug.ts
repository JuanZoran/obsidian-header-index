/**
 * 调试工具类 - 提供模块化的调试日志输出
 */

export type DebugModule = "core" | "parser" | "cursor" | "strip" | "events" | "format";

export interface DebugSettings {
	enabled: boolean;
	modules: {
		core: boolean;
		parser: boolean;
		cursor: boolean;
		strip: boolean;
		events: boolean;
		format: boolean;
	};
}

export const DEFAULT_DEBUG_SETTINGS: DebugSettings = {
	enabled: false,
	modules: {
		core: false,
		parser: false,
		cursor: false,
		strip: false,
		events: false,
		format: false,
	},
};

/**
 * 调试工具类
 * 提供统一的调试日志输出接口，支持按模块控制调试输出
 */
export class Debug {
	private static settings: DebugSettings = DEFAULT_DEBUG_SETTINGS;

	/**
	 * 初始化调试设置
	 */
	static init(settings: DebugSettings): void {
		this.settings = settings;
	}

	/**
	 * 检查指定模块的调试是否启用
	 */
	static isEnabled(module: DebugModule): boolean {
		return this.settings.enabled && this.settings.modules[module] === true;
	}

	/**
	 * 输出调试日志
	 * @param module 模块名称
	 * @param args 日志参数
	 */
	static log(module: DebugModule, ...args: any[]): void {
		if (this.isEnabled(module)) {
			console.log(`[HeadIndex:${module}]`, ...args);
		}
	}

	/**
	 * 输出警告日志
	 * @param module 模块名称
	 * @param args 日志参数
	 */
	static warn(module: DebugModule, ...args: any[]): void {
		if (this.isEnabled(module)) {
			console.warn(`[HeadIndex:${module}]`, ...args);
		}
	}

	/**
	 * 输出错误日志
	 * @param module 模块名称
	 * @param args 日志参数
	 */
	static error(module: DebugModule, ...args: any[]): void {
		if (this.isEnabled(module)) {
			console.error(`[HeadIndex:${module}]`, ...args);
		}
	}

	/**
	 * 获取当前调试设置（用于调试工具类自身）
	 */
	static getSettings(): Readonly<DebugSettings> {
		return this.settings;
	}
}

