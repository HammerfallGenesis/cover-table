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
  
  interface CoverTablePluginSettings {
	design: DesignOptions;
  }
  
  const DEFAULT_SETTINGS: CoverTablePluginSettings = {
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
  
  export default class CoverTablePlugin extends Plugin {
	settings: CoverTablePluginSettings;
  
	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
	}
  
	async onload() {
		console.log("Cover Table Plugin onload()");
  
		if (!(globalThis as any).coverTable) {
			(globalThis as any).coverTable = {};
		}
	
		// dataview‐style 에러 억제
		const originalConsoleError = console.error;
		console.error = (...args: any[]) => {
		try {
			const msg = args[0] instanceof Error ? args[0].message : String(args[0]);
			if (msg.includes("coverTable is not defined")) return;
		} catch {}
		originalConsoleError(...args);
		};

		await this.loadSettings();

		this.app.workspace.onLayoutReady(async () => {
		console.log("Cover Table Plugin onLayoutReady()");

		this.applyDesignSettings();
		this.registerEvent(
			this.app.workspace.on("css-change", () => {
			this.applyDesignSettings();
			})
		);

		// 전역에 API 노출
		(globalThis as any).coverTable.obsidian = {
			Notice,
			Modal,
			SuggestModal,
		};
		(globalThis as any).coverTable.engine = new InteractiveTable(this.app);
		(globalThis as any).coverTable.gantt = new GanttTable(this.app);

		//
		//  ★ 새로 추가: Markdown Post-Processor
		//    코드 블록 언어가 `language-interactive-table` 인 경우
		//    renderAutoView 를 호출합니다.
		//
		this.registerMarkdownPostProcessor(
			async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				el.querySelectorAll("pre > code.language-gantt-table").forEach(async (code) => {
					let settings = {};
					try { settings = JSON.parse(code.textContent || "{}"); } catch {}
					const dvApi = (window as any).dataviewApi || (window as any).dvAPI;
					await (globalThis as any).coverTable.gantt.renderView(dvApi, settings);
				});
			}
		);
		});
	
		this.addSettingTab(new CoverTableSettingTab(this.app, this));
		}
  
	onunload() {
		console.log("Cover Table Plugin onunload()");
	}
  
	async loadSettings() {
	  const data = await this.loadData();
	  this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}
  
	async saveSettings() {
	  await this.saveData(this.settings);
	  this.applyDesignSettings();
	}
  
	private applyDesignSettings() {
	  const rootStyle = document.documentElement.style;
	  const d = this.settings.design;
	  const isDark = document.body.classList.contains("theme-dark");
	  const c = isDark ? d.dark : d.light;
  
	  rootStyle.setProperty("--cover-table-button-color", c.buttonColor);
	  rootStyle.setProperty("--cover-table-button-hover-color", c.buttonHoverColor);
	  rootStyle.setProperty("--cover-table-header-bg-color", c.tableHeaderBgColor);
	  rootStyle.setProperty("--cover-table-border-color", c.tableBorderColor);
	}
  }
  
  /*****************************************************
   * 4. [설정 탭 클래스]
   *****************************************************/
  class CoverTableSettingTab extends PluginSettingTab {
	plugin: CoverTablePlugin;
  
	constructor(app: App, plugin: CoverTablePlugin) {
	  super(app, plugin);
	  this.plugin = plugin;
	}
  
	display(): void {
	  const { containerEl } = this;
	  containerEl.empty();
  
	  containerEl.createEl("h2", { text: "Cover Table Plugin Settings" });
  
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
  