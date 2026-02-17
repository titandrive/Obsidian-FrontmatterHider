import { MarkdownView, Plugin, TAbstractFile, TFile, TFolder, WorkspaceLeaf, setIcon } from "obsidian";
import {
	FrontmatterHiderSettings,
	DEFAULT_SETTINGS,
	FrontmatterHiderSettingTab,
} from "./settings";
import {
	FRONTMATTER_HIDDEN_CLASS,
	FRONTMATTER_HIDDEN_SOURCE_CLASS,
	FRONTMATTER_HIDDEN_LIVE_PREVIEW_CLASS,
	FRONTMATTER_HIDDEN_READING_CLASS,
	ICON_VISIBLE,
	ICON_HIDDEN,
	TOOLTIP_SHOW,
	TOOLTIP_HIDE,
} from "./constants";

const ALL_CLASSES = [
	FRONTMATTER_HIDDEN_CLASS,
	FRONTMATTER_HIDDEN_SOURCE_CLASS,
	FRONTMATTER_HIDDEN_LIVE_PREVIEW_CLASS,
	FRONTMATTER_HIDDEN_READING_CLASS,
];

export default class FrontmatterHiderPlugin extends Plugin {
	settings: FrontmatterHiderSettings;
	ribbonIconEl: HTMLElement;
	private explorerObserver: MutationObserver | null = null;
	private currentIconName: string = "";

	async onload(): Promise<void> {

		await this.loadSettings();

		this.ribbonIconEl = this.addRibbonIcon(
			ICON_VISIBLE,
			TOOLTIP_HIDE,
			() => {
				this.toggleFrontmatter();
			}
		);

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				this.updateRibbonIcon();
				if (leaf) {
					this.applyClassToLeaf(leaf);
				}
			})
		);

		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.refreshAllLeaves();
			})
		);

		// When frontmatter changes (local toggle or cross-device sync), refresh UI
		this.registerEvent(
			this.app.metadataCache.on("changed", () => {
				this.refreshAllLeaves();
				this.updateRibbonIcon();
			})
		);

		// Single file/folder context menu
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				const mdFiles = this.getMarkdownFiles([file]);
				if (mdFiles.length === 0) return;

				const filesWithFrontmatter = mdFiles.filter((f) =>
					this.fileHasFrontmatter(f)
				);
				if (filesWithFrontmatter.length === 0) return;

				const allHidden = mdFiles.every(
					(f) => this.isFileHidden(f)
				);
				menu.addItem((item) => {
					item.setTitle(allHidden ? "Show frontmatter" : "Hide frontmatter")
						.setIcon(allHidden ? ICON_VISIBLE : ICON_HIDDEN)
						.onClick(async () => {
							await this.setFilesHidden(mdFiles, !allHidden);
						});
				});
			})
		);

		// Multi-file context menu
		this.registerEvent(
			this.app.workspace.on("files-menu", (menu, files) => {
				const mdFiles = this.getMarkdownFiles(files);
				if (mdFiles.length === 0) return;

				const filesWithFrontmatter = mdFiles.filter((f) =>
					this.fileHasFrontmatter(f)
				);
				if (filesWithFrontmatter.length === 0) return;

				const allHidden = mdFiles.every(
					(f) => this.isFileHidden(f)
				);

				menu.addItem((item) => {
					item.setTitle(
						allHidden
							? "Show frontmatter"
							: "Hide frontmatter"
					)
						.setIcon(allHidden ? ICON_VISIBLE : ICON_HIDDEN)
						.onClick(async () => {
							await this.setFilesHidden(mdFiles, !allHidden);
						});
				});
			})
		);

		this.addSettingTab(new FrontmatterHiderSettingTab(this.app, this));

		this.addCommand({
			id: "toggle-frontmatter-visibility",
			name: "Toggle frontmatter visibility",
			callback: () => {
				this.toggleFrontmatter();
			},
		});

		this.app.workspace.onLayoutReady(() => {
			this.refreshAllLeaves();
			this.updateRibbonIcon();
			this.updateRibbonVisibility();
			this.observeExplorerSelection();
		});
	}

	onunload(): void {
		this.removeAllClasses();
		this.explorerObserver?.disconnect();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private isFileHidden(file: TFile): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		const value = cache?.frontmatter?.["hide_frontmatter"];
		return value === true || value === "true";
	}

	private async setFilesHidden(files: TFile[], hidden: boolean): Promise<void> {
		for (const file of files) {
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				if (hidden) {
					frontmatter["hide_frontmatter"] = true;
				} else {
					delete frontmatter["hide_frontmatter"];
				}
			});
		}
	}

	private getActiveFile(): TFile | null {
		return this.app.workspace.getActiveFile();
	}

	private isCurrentNoteHidden(): boolean {
		const file = this.getActiveFile();
		if (!file) return false;
		return this.isFileHidden(file);
	}

	private fileHasFrontmatter(file: TFile): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		return !!cache?.frontmatter;
	}

	private activeFileHasFrontmatter(): boolean | null {
		const file = this.getActiveFile();
		if (!file) return null;
		return this.fileHasFrontmatter(file);
	}

	private getExplorerSelectedFiles(): TFile[] {
		const explorerLeaf =
			this.app.workspace.getLeavesOfType("file-explorer")[0];
		if (!explorerLeaf) return [];

		const containerEl = explorerLeaf.view.containerEl;
		const selectedEls = containerEl.querySelectorAll(
			".tree-item-self.is-selected"
		);
		if (selectedEls.length === 0) return [];

		const items: TAbstractFile[] = [];
		for (const el of Array.from(selectedEls)) {
			const path = (el as HTMLElement).dataset.path;
			if (path) {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file) items.push(file);
			}
		}

		return this.getMarkdownFiles(items);
	}

	private async toggleFrontmatter(): Promise<void> {
		// Check file explorer selection first
		const explorerFiles = this.getExplorerSelectedFiles();
		if (explorerFiles.length > 0) {
			const allHidden = explorerFiles.every(
				(f) => this.isFileHidden(f)
			);
			await this.setFilesHidden(explorerFiles, !allHidden);
			return;
		}

		// Fall back to active note
		const file = this.getActiveFile();
		if (!file) return;

		await this.setFilesHidden([file], !this.isFileHidden(file));
	}

	updateRibbonVisibility(): void {
		this.ribbonIconEl.style.display = this.settings.showRibbonIcon
			? ""
			: "none";
	}

	private updateRibbonIcon(): void {
		const explorerFiles = this.getExplorerSelectedFiles();
		let disabled: boolean;
		let hidden: boolean;
		if (explorerFiles.length > 0) {
			disabled = !explorerFiles.some((f) => this.fileHasFrontmatter(f));
			hidden = explorerFiles.every(
				(f) => this.isFileHidden(f)
			);
		} else {
			const hasFrontmatter = this.activeFileHasFrontmatter();
			disabled = hasFrontmatter === false;
			hidden = this.isCurrentNoteHidden();
		}
		const iconName = hidden ? ICON_HIDDEN : ICON_VISIBLE;
		if (iconName !== this.currentIconName) {
			setIcon(this.ribbonIconEl, iconName);
			this.currentIconName = iconName;
		}
		if (disabled) {
			this.ribbonIconEl.setAttribute(
				"aria-label",
				"No frontmatter present"
			);
		} else {
			this.ribbonIconEl.setAttribute(
				"aria-label",
				hidden ? TOOLTIP_SHOW : TOOLTIP_HIDE
			);
		}
		this.ribbonIconEl.toggleClass(
			"frontmatter-hider-disabled",
			disabled
		);
	}

	private observeExplorerSelection(): void {
		const explorerLeaf =
			this.app.workspace.getLeavesOfType("file-explorer")[0];
		if (!explorerLeaf) return;

		const containerEl = explorerLeaf.view.containerEl;
		this.explorerObserver = new MutationObserver(() => {
			this.updateRibbonIcon();
		});
		this.explorerObserver.observe(containerEl, {
			attributes: true,
			attributeFilter: ["class"],
			subtree: true,
		});
	}

	private applyClassToLeaf(leaf: WorkspaceLeaf): void {
		const view = leaf.view;
		if (!(view instanceof MarkdownView)) return;

		const file = view.file;
		const containerEl = view.contentEl;
		if (!file || !containerEl) return;

		const isHidden = this.isFileHidden(file);

		containerEl.classList.remove(...ALL_CLASSES);

		if (!isHidden) return;

		containerEl.classList.add(FRONTMATTER_HIDDEN_CLASS);

		if (this.settings.hideSource) {
			containerEl.classList.add(FRONTMATTER_HIDDEN_SOURCE_CLASS);
		}
		if (this.settings.hideLivePreview) {
			containerEl.classList.add(FRONTMATTER_HIDDEN_LIVE_PREVIEW_CLASS);
		}
		if (this.settings.hideReading) {
			containerEl.classList.add(FRONTMATTER_HIDDEN_READING_CLASS);
		}
	}

	refreshAllLeaves(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			this.applyClassToLeaf(leaf);
		});
	}

	private getMarkdownFiles(items: TAbstractFile[]): TFile[] {
		const files: TFile[] = [];
		for (const item of items) {
			if (item instanceof TFile && item.extension === "md") {
				files.push(item);
			} else if (item instanceof TFolder) {
				this.app.vault.getMarkdownFiles().forEach((f) => {
					if (f.path.startsWith(item.path + "/")) {
						files.push(f);
					}
				});
			}
		}
		return files;
	}

	private removeAllClasses(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.contentEl) {
				view.contentEl.classList.remove(...ALL_CLASSES);
			}
		});
	}
}
