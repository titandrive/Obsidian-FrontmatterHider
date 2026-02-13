import { App, Notice, PluginSettingTab, Setting, TextComponent } from "obsidian";
import type FrontmatterHiderPlugin from "./main";

export interface FrontmatterHiderSettings {
	hideSource: boolean;
	hideLivePreview: boolean;
	hideReading: boolean;
	showRibbonIcon: boolean;
	customDataPath: string;
	hiddenFiles: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: FrontmatterHiderSettings = {
	hideSource: true,
	hideLivePreview: true,
	hideReading: true,
	showRibbonIcon: true,
	customDataPath: "",
	hiddenFiles: {},
};

export class FrontmatterHiderSettingTab extends PluginSettingTab {
	plugin: FrontmatterHiderPlugin;

	constructor(app: App, plugin: FrontmatterHiderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("frontmatter-hider-settings");

		// --- View modes ---
		new Setting(containerEl).setName("View modes").setHeading();
		containerEl.createEl("p", {
			text: "Choose which view modes frontmatter should be hidden in when toggled.",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Source mode")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.hideSource)
					.onChange(async (value) => {
						this.plugin.settings.hideSource = value;
						await this.plugin.saveSettings();
						this.plugin.refreshAllLeaves();
					})
			);

		new Setting(containerEl)
			.setName("Live Preview")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.hideLivePreview)
					.onChange(async (value) => {
						this.plugin.settings.hideLivePreview = value;
						await this.plugin.saveSettings();
						this.plugin.refreshAllLeaves();
					})
			);

		new Setting(containerEl)
			.setName("Reading mode")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.hideReading)
					.onChange(async (value) => {
						this.plugin.settings.hideReading = value;
						await this.plugin.saveSettings();
						this.plugin.refreshAllLeaves();
					})
			);

		// --- Interface ---
		new Setting(containerEl).setName("Interface").setHeading();

		new Setting(containerEl)
			.setName("Show ribbon icon")
			.setDesc("Show the toggle button in the left ribbon.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showRibbonIcon)
					.onChange(async (value) => {
						this.plugin.settings.showRibbonIcon = value;
						await this.plugin.saveSettings();
						this.plugin.updateRibbonVisibility();
					})
			);

		// --- Data storage ---
		new Setting(containerEl).setName("Data storage").setHeading();

		let pathInput: TextComponent;
		new Setting(containerEl)
			.setName("Custom data folder")
			.setDesc(
				createFragment((frag) => {
					frag.appendText(
						"Change where the settings .json gets stored. Only necessary for cross-device sync. "
					);
					const link = frag.createEl("a", {
						text: "Learn more",
						href: "https://github.com/titandrive/Obsidian-FrontmatterHider#data-storage",
					});
					link.setAttr("target", "_blank");
				})
			)
			.addText((text) => {
				pathInput = text;
				text.setPlaceholder(".obsidian")
					.setValue(this.plugin.settings.customDataPath);
			})
			.addButton((btn) =>
				btn.setButtonText("Save").onClick(async () => {
					try {
						const oldPath =
							this.plugin.settings.customDataPath;
						const newPath = pathInput.getValue().trim();
						this.plugin.settings.customDataPath = newPath;
						await this.plugin.migrateDataFile(
							oldPath,
							newPath
						);
						await this.plugin.saveSettings();
						btn.setButtonText("Saved!");
						setTimeout(
							() => btn.setButtonText("Save"),
							1500
						);
					} catch (e) {
						new Notice(`Save failed: ${e}`);
						btn.setButtonText("Error");
						setTimeout(
							() => btn.setButtonText("Save"),
							1500
						);
					}
				})
			)
			.addButton((btn) =>
				btn.setButtonText("Reset").onClick(async () => {
					try {
						const oldPath =
							this.plugin.settings.customDataPath;
						this.plugin.settings.customDataPath = "";
						await this.plugin.migrateDataFile(oldPath, "");
						await this.plugin.saveSettings();
						pathInput.setValue("");
						btn.setButtonText("Done!");
						setTimeout(
							() => btn.setButtonText("Reset"),
							1500
						);
					} catch (e) {
						new Notice(`Reset failed: ${e}`);
						btn.setButtonText("Error");
						setTimeout(
							() => btn.setButtonText("Reset"),
							1500
						);
					}
				})
			);
	}
}
