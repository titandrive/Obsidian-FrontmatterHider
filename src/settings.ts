import { App, PluginSettingTab, Setting } from "obsidian";
import type FrontmatterHiderPlugin from "./main";

export interface FrontmatterHiderSettings {
	hideSource: boolean;
	hideLivePreview: boolean;
	hideReading: boolean;
	showRibbonIcon: boolean;
	hiddenFiles: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: FrontmatterHiderSettings = {
	hideSource: true,
	hideLivePreview: true,
	hideReading: true,
	showRibbonIcon: true,
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
	}
}
