import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginManifest,
	PluginSettingTab,
	Setting,
	SuggestModal,
	MarkdownPostProcessorContext,
} from "obsidian";
import { InteractiveTable } from "./interactive_table";
import { GanttTable } from "./gantt_table";

/*****************************************************
 * 1. [설정 인터페이스] Dark / Light
 *****************************************************/
interface ModeColorConfig {
	buttonColor: string;
	buttonHoverColor: string;
	tableHeaderBgColor: string;
	tableBorderColor: string;
}
interface DesignOptions {
	dark: ModeColorConfig;
	light: ModeColorConfig;
}

/**
 * 플러그인 전체 설정
 */
interface MiniTablePluginSettings {
	design: DesignOptions;
}

/*****************************************************
 * 2. 기본 설정
 *****************************************************/
const DEFAULT_SETTINGS: MiniTablePluginSettings = {
	design: {
		dark: {
			buttonColor: "#3c3c3c",
			buttonHoverColor: "#555555",
			tableHeaderBgColor: "#444444",
			tableBorderColor: "#000000",
		},
		light: {
			buttonColor: "#cccccc",
			buttonHoverColor: "#dddddd",
			tableHeaderBgColor: "#bbbbbb",
			tableBorderColor: "#666666",
		},
	},
};

/*****************************************************
 * 3. 메인 플러그인 클래스
 *****************************************************/
export default class MiniTablePlugin extends Plugin {
	settings: MiniTablePluginSettings;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
	}

	async onload() {
		console.log("Mini Table Plugin onload()");

		if (!(globalThis as any).miniTableGlobal) {
			(globalThis as any).miniTableGlobal = {};
		}

		const originalConsoleError = console.error;
		console.error = (...args: any[]) => {
			try {
				if (args && args[0]) {
					let msg = args[0] instanceof Error ? args[0].message : String(args[0]);
					if (msg.includes("miniTableGlobal is not defined")) {
						return;
					}
				}
			} catch {}
			originalConsoleError(...args);
		};

		await this.loadSettings();

		this.app.workspace.onLayoutReady(async () => {
			console.log("Mini Table Plugin onLayoutReady() - now applying settings & events.");

			this.applyDesignSettings();
			this.registerEvent(
				this.app.workspace.on("css-change", () => {
					this.applyDesignSettings();
				})
			);

			(globalThis as any).miniTableGlobal.obsidian = {
				Notice,
				Modal,
				SuggestModal,
			};
			(globalThis as any).miniTableGlobal.engine = new InteractiveTable();
			(globalThis as any).miniTableGlobal.gantt = new GanttTable();

			// 기존 inverse fold behavior 기능 제거: 관련 Markdown PostProcessor 코드는 삭제됨.
		});

		this.addSettingTab(new MiniTableSettingTab(this.app, this));
	}

	onunload() {
		console.log("Mini Table Plugin onunload()");
	}

	/**
	 * 플러그인 설정 로드
	 */
	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	/**
	 * 플러그인 설정 저장
	 */
	async saveSettings() {
		await this.saveData(this.settings);
		this.applyDesignSettings();
	}

	/**
	 * 디자인 설정(테마) 적용
	 */
	private applyDesignSettings() {
		const rootStyle = document.documentElement.style;
		const d = this.settings.design;
		const isDark = document.body.classList.contains("theme-dark");
		const c = isDark ? d.dark : d.light;

		rootStyle.setProperty("--mini-table-button-color", c.buttonColor);
		rootStyle.setProperty("--mini-table-button-hover-color", c.buttonHoverColor);
		rootStyle.setProperty("--mini-table-header-bg-color", c.tableHeaderBgColor);
		rootStyle.setProperty("--mini-table-border-color", c.tableBorderColor);
	}
}

/*****************************************************
 * 4. [설정 탭 클래스]
 *****************************************************/
class MiniTableSettingTab extends PluginSettingTab {
	plugin: MiniTablePlugin;

	constructor(app: App, plugin: MiniTablePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Mini Table Plugin Settings" });

		// Dark Mode
		containerEl.createEl("h3", { text: "Dark Mode Colors" });
		new Setting(containerEl)
			.setName("Dark Button Color")
			.addColorPicker((cp) =>
				cp
					.setValue(this.plugin.settings.design.dark.buttonColor)
					.onChange(async (val) => {
						this.plugin.settings.design.dark.buttonColor = val;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Dark Button Hover Color")
			.addColorPicker((cp) =>
				cp
					.setValue(this.plugin.settings.design.dark.buttonHoverColor)
					.onChange(async (val) => {
						this.plugin.settings.design.dark.buttonHoverColor = val;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Dark Table Header BG")
			.addColorPicker((cp) =>
				cp
					.setValue(this.plugin.settings.design.dark.tableHeaderBgColor)
					.onChange(async (val) => {
						this.plugin.settings.design.dark.tableHeaderBgColor = val;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Dark Table Border Color")
			.addColorPicker((cp) =>
				cp
					.setValue(this.plugin.settings.design.dark.tableBorderColor)
					.onChange(async (val) => {
						this.plugin.settings.design.dark.tableBorderColor = val;
						await this.plugin.saveSettings();
					})
			);

		// Light Mode
		containerEl.createEl("h3", { text: "Light Mode Colors" });
		new Setting(containerEl)
			.setName("Light Button Color")
			.addColorPicker((cp) =>
				cp
					.setValue(this.plugin.settings.design.light.buttonColor)
					.onChange(async (val) => {
						this.plugin.settings.design.light.buttonColor = val;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Light Button Hover Color")
			.addColorPicker((cp) =>
				cp
					.setValue(this.plugin.settings.design.light.buttonHoverColor)
					.onChange(async (val) => {
						this.plugin.settings.design.light.buttonHoverColor = val;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Light Table Header BG")
			.addColorPicker((cp) =>
				cp
					.setValue(this.plugin.settings.design.light.tableHeaderBgColor)
					.onChange(async (val) => {
						this.plugin.settings.design.light.tableHeaderBgColor = val;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Light Table Border Color")
			.addColorPicker((cp) =>
				cp
					.setValue(this.plugin.settings.design.light.tableBorderColor)
					.onChange(async (val) => {
						this.plugin.settings.design.light.tableBorderColor = val;
						await this.plugin.saveSettings();
					})
			);
	}
}
