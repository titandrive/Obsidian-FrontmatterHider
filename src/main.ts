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
	private lastSaveTime: number = 0;

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

		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view?.file?.path === file.path) {
					this.updateRibbonIcon();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (this.settings.hiddenFiles[oldPath]) {
					this.settings.hiddenFiles[file.path] = true;
					delete this.settings.hiddenFiles[oldPath];
					this.saveSettings();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (this.settings.hiddenFiles[file.path]) {
					delete this.settings.hiddenFiles[file.path];
					this.saveSettings();
				}
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
					(f) => this.settings.hiddenFiles[f.path] === true
				);
				menu.addItem((item) => {
					item.setTitle(allHidden ? "Show frontmatter" : "Hide frontmatter")
						.setIcon(allHidden ? ICON_VISIBLE : ICON_HIDDEN)
						.onClick(async () => {
							for (const f of mdFiles) {
								if (allHidden) {
									delete this.settings.hiddenFiles[f.path];
								} else {
									this.settings.hiddenFiles[f.path] = true;
								}
							}
							await this.saveSettings();
							this.updateRibbonIcon();
							this.refreshAllLeaves();
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
					(f) => this.settings.hiddenFiles[f.path] === true
				);

				menu.addItem((item) => {
					item.setTitle(
						allHidden
							? "Show frontmatter"
							: "Hide frontmatter"
					)
						.setIcon(allHidden ? ICON_VISIBLE : ICON_HIDDEN)
						.onClick(async () => {
							for (const f of mdFiles) {
								if (allHidden) {
									delete this.settings.hiddenFiles[f.path];
								} else {
									this.settings.hiddenFiles[f.path] = true;
								}
							}
							await this.saveSettings();
							this.updateRibbonIcon();
							this.refreshAllLeaves();
						});
				});
			})
		);

		this.addSettingTab(new FrontmatterHiderSettingTab(this.app, this));

		this.addCommand({
			id: "toggle-frontmatter-visibility",
			name: "Toggle frontmatter visibility",
			checkCallback: (checking: boolean) => {
				const hasExplorerSelection =
					this.getExplorerSelectedFiles().length > 0;
				const hasActiveNote = !!this.getActiveFilePath();
				if (hasExplorerSelection || hasActiveNote) {
					if (!checking) {
						this.toggleFrontmatter();
					}
					return true;
				}
				return false;
			},
		});

		this.app.workspace.onLayoutReady(() => {
			this.refreshAllLeaves();
			this.updateRibbonIcon();
			this.updateRibbonVisibility();
			this.observeExplorerSelection();
			this.watchCustomDataFile();
		});
	}

	onunload(): void {
		this.removeAllClasses();
		this.explorerObserver?.disconnect();
	}

	private static readonly DATA_FILENAME = "frontmatter-hider.json";

	private getCustomFilePath(): string | null {
		if (!this.settings.customDataPath) return null;
		return `${this.settings.customDataPath}/${FrontmatterHiderPlugin.DATA_FILENAME}`;
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);

		// If custom data path is set, load hiddenFiles from vault file
		const customFile = this.getCustomFilePath();
		if (customFile) {
			try {
				const exists =
					await this.app.vault.adapter.exists(customFile);
				if (exists) {
					const raw =
						await this.app.vault.adapter.read(customFile);
					const data = JSON.parse(raw);
					if (data && typeof data === "object") {
						this.settings.hiddenFiles = data;
					}
				}
			} catch {
				// File missing or invalid JSON — use default empty
			}
		}
	}

	async saveSettings(): Promise<void> {
		const customFile = this.getCustomFilePath();
		if (customFile) {
			// Ensure the directory exists
			const dir = this.settings.customDataPath;
			const dirExists = await this.app.vault.adapter.exists(dir);
			if (!dirExists) {
				await this.app.vault.adapter.mkdir(dir);
			}
			// Track when we save to avoid reloading our own changes
			this.lastSaveTime = Date.now();
			// Save hiddenFiles to custom vault file
			await this.app.vault.adapter.write(
				customFile,
				JSON.stringify(this.settings.hiddenFiles, null, "\t")
			);
			// Save plugin settings (without hiddenFiles) to default data.json
			const { hiddenFiles, ...rest } = this.settings;
			await this.saveData(rest);
		} else {
			await this.saveData(this.settings);
		}
	}

	private watchCustomDataFile(): void {
		const customFile = this.getCustomFilePath();
		if (!customFile) return;

		this.registerEvent(
			this.app.vault.on("modify", async (file) => {
				if (!(file instanceof TFile)) return;
				if (file.path !== customFile) return;

				// Ignore changes we just made ourselves (within 1 second)
				const timeSinceLastSave = Date.now() - this.lastSaveTime;
				if (timeSinceLastSave < 1000) return;

				// File was modified by sync from another device - reload it
				try {
					const raw = await this.app.vault.adapter.read(customFile);
					const data = JSON.parse(raw);
					if (data && typeof data === "object") {
						this.settings.hiddenFiles = data;
						this.refreshAllLeaves();
						this.updateRibbonIcon();
					}
				} catch (e) {
					console.error("Frontmatter Hider: Failed to reload synced data", e);
				}
			})
		);
	}

	async migrateDataFile(
		oldDir: string,
		newDir: string
	): Promise<void> {
		const data = JSON.stringify(
			this.settings.hiddenFiles,
			null,
			"\t"
		);

		// Write to new location
		if (newDir) {
			const newFile = `${newDir}/${FrontmatterHiderPlugin.DATA_FILENAME}`;
			const dirExists = await this.app.vault.adapter.exists(newDir);
			if (dirExists) {
				// If a file (not folder) exists at this path, remove it first
				const stat = await this.app.vault.adapter.stat(newDir);
				if (stat && stat.type === "file") {
					await this.app.vault.adapter.remove(newDir);
					await this.app.vault.adapter.mkdir(newDir);
				}
			} else {
				await this.app.vault.adapter.mkdir(newDir);
			}

			// If the file already exists (e.g. synced from another device),
			// load from it instead of overwriting
			if (await this.app.vault.adapter.exists(newFile)) {
				try {
					const raw =
						await this.app.vault.adapter.read(newFile);
					const existing = JSON.parse(raw);
					if (existing && typeof existing === "object") {
						this.settings.hiddenFiles = existing;
						return;
					}
				} catch {
					// Invalid JSON — overwrite with current data
				}
			}

			await this.app.vault.adapter.write(newFile, data);
		}

		// Clean up old custom file if it existed
		if (oldDir && oldDir !== newDir) {
			const oldFile = `${oldDir}/${FrontmatterHiderPlugin.DATA_FILENAME}`;
			try {
				if (await this.app.vault.adapter.exists(oldFile)) {
					await this.app.vault.adapter.remove(oldFile);
				}
			} catch {
				// Ignore cleanup errors
			}
		}
	}

	private getActiveFilePath(): string | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file) return null;
		return view.file.path;
	}

	private isCurrentNoteHidden(): boolean {
		const path = this.getActiveFilePath();
		if (!path) return false;
		return this.settings.hiddenFiles[path] === true;
	}

	private fileHasFrontmatter(file: TFile): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		return !!cache?.frontmatter;
	}

	private activeFileHasFrontmatter(): boolean | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file) return null; // no markdown view active
		return this.fileHasFrontmatter(view.file);
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
				(f) => this.settings.hiddenFiles[f.path] === true
			);
			for (const f of explorerFiles) {
				if (allHidden) {
					delete this.settings.hiddenFiles[f.path];
				} else {
					this.settings.hiddenFiles[f.path] = true;
				}
			}
			await this.saveSettings();
			this.updateRibbonIcon();
			this.refreshAllLeaves();
			return;
		}

		// Fall back to active note
		const path = this.getActiveFilePath();
		if (!path) return;

		if (this.settings.hiddenFiles[path]) {
			delete this.settings.hiddenFiles[path];
		} else {
			this.settings.hiddenFiles[path] = true;
		}

		await this.saveSettings();
		this.updateRibbonIcon();
		this.refreshAllLeaves();
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
				(f) => this.settings.hiddenFiles[f.path] === true
			);
		} else {
			const hasFrontmatter = this.activeFileHasFrontmatter();
			disabled = hasFrontmatter === false;
			hidden = this.isCurrentNoteHidden();
		}
		setIcon(this.ribbonIconEl, hidden ? ICON_HIDDEN : ICON_VISIBLE);
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

		const filePath = view.file?.path;
		const containerEl = view.contentEl;
		if (!filePath || !containerEl) return;

		const isHidden = this.settings.hiddenFiles[filePath] === true;

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
