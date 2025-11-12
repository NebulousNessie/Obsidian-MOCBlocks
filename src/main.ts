import { Plugin, TFile, MarkdownView, parseYaml, Component, MarkdownPostProcessorContext } from "obsidian";

import { loadMarkerDataMD, saveUpdatedMarker, refreshMOCBlock, deleteMarkerFromFile } from "./helpers";
import { MOCBlockSettings, DEFAULT_SETTINGS, MOCBlockSettingTab } from "./settings";
import { NewMocBlockModal } from "./modals";
import { renderPinMarker, renderPolylineMarker, addResizeHandle } from "./blockRenderHelpers";
import { addPinButton, addPolylineButton } from "./actionButtons";

export default class MOCBlockPlugin extends Plugin {
	settings!: MOCBlockSettings;
	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MOCBlockSettingTab(this.app, this));

		// Ensure data folder exists
		const dataFolderPath = this.settings.dataFolder;
		const folder = this.app.vault.getFolderByPath(dataFolderPath);
		if (!folder) {
			try {
				await this.app.vault.createFolder(dataFolderPath);
			} catch (e) {
				if (!(e instanceof Error) || !e.message || !e.message.includes("Folder already exists")) {
					console.error("Failed to create data folder:", e);
					throw e;
				}
				// else: folder already exists, safe to ignore
			}
		}

		this.addCommand({
			id: "insert-mocblock",
			name: "Insert moc block",
				editorCallback: (editor) => {
					new NewMocBlockModal(this.app, (mocblockText) => {
						editor.replaceSelection(mocblockText);
					}).open();
				},
		});

		this.addRibbonIcon("image", "Insert moc block", () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView) return;

			new NewMocBlockModal(this.app, (mocblockText) => {
				activeView.editor.replaceSelection(mocblockText);
			}).open();
		});

		//console.log("✅ MOC Plugin loaded");
		//console.log("Current MOC plugin settings:", this.settings);

		this.registerMarkdownCodeBlockProcessor("moc", async (source, el, ctx) => {
            const mocBlockComponent = new Component();
            this.addChild(mocBlockComponent);
			//console.log("Processing MOC block:", source);

			let view: MarkdownView | undefined = undefined;
			for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
				const candidate = leaf.view as MarkdownView | undefined;
				if (candidate && candidate.file && candidate.file.path === ctx.sourcePath) {
					view = candidate;
					break;
				}
			} 	// Fix for getting correct view in multi-pane setup, and if page refreshes without being selected (i.e. file explorer clicked)

				const isEditMode = !!(view && typeof view.getMode === "function" && view.getMode() === "source");

		// Parse YAML MOC Block Data
			type MocConfig = Record<string, unknown> & {
				image?: string;
				image_width?: number | string;
				fullscreen?: boolean | string;
				moc_id?: string;
			};

			let config: MocConfig;
			try {
				config = parseYaml(source);
				
				// Normalize keys to lowercase
				const normalizedConfig: Record<string, unknown> = {};
				for (const key in config) {
					normalizedConfig[key.toLowerCase()] = (config as Record<string, unknown>)[key];
				}
				config = normalizedConfig as MocConfig;

            } catch (e) {
                console.error("Invalid YAML in moc block.", e);
                el.createEl("pre", { text: "Invalid YAML in moc block." });
                return;
            }
		// --------------------------------


		// Validate MOC Block required fields

			// Check for moc_id, generate if missing
				let moc_id = config.moc_id;
				if (!moc_id) {
					//console.log("No moc_id found, generating a new one...");
					moc_id = `moc-${Math.random().toString(36).slice(2, 10)}`;
					config.moc_id = moc_id;

					const file = this.app.vault.getFileByPath(ctx.sourcePath);
					if (!(file instanceof TFile)) return;

					// get the block’s line positions
					const section = ctx.getSectionInfo(el);
					if (!section) return;

					const content = await this.app.vault.cachedRead(file);	// preferred over vault.read for read-only use cases.
					const lines = content.split("\n");
					const blockLines = lines.slice(section.lineStart + 1, section.lineEnd);
					blockLines.push(`moc_id: ${moc_id}`);
					const newBlock = ["```moc", ...blockLines, "```"].join("\n");
					
					const newContent = [
					...lines.slice(0, section.lineStart),
					newBlock,
					...lines.slice(section.lineEnd + 1),
					].join("\n");

					await this.app.vault.process(file, () => newContent);
				}

				// moc_id config defined in check if statement above.
				const imageRef = config.image;
				const imageWidth = config.image_width;
				// fullscreen flag currently unused
				
				// debug log, check yaml parsed correctly.
				//console.log("Width:", imageWidth);
				//console.log("Image:", imageRef);
				//console.log("ID:", moc_id);
				////console.log("is Fullscreen?:", isFullscreen);
			// --------------------------------

			// Check for image field. Cannot auto-generate, notify user to add one.
				if (!imageRef) {
					el.createEl("pre", { text: "Missing 'image' field. Cannot create moc block." });
					return;
				}
			// --------------------------------
		// --------------------------------


		// Resolve image file link
				const imageFile = this.app.metadataCache.getFirstLinkpathDest(imageRef, ctx.sourcePath);
				if (!imageFile) {
					el.createEl("pre", { text: `Image not found: ${imageRef}` });
					return;
				}
		// --------------------------------


		// Render MOC Block Container, Image, Hidden Heading, and Action Buttons
			// Render Container
			const container = el.createDiv({cls: "mocblockRenderer-container"});


			// Scale image by width
			let newWidth: number;
			if (imageWidth && !isNaN(Number(imageWidth))) {
				newWidth = Number(imageWidth);
			} else {
				newWidth = 400; // fallback default width
			}


			// Render Image
			const img = container.createEl("img", {
				attr: { src: this.app.vault.getResourcePath(imageFile) },
			});


			// Set image and container widths.
				// Note: attr(data-width px) doesn't seem to be supported. 
				// Consider adding in future if it becomes supported, so styles can target it instead.
			img.style.width = newWidth + "px";
			img.style.maxWidth = newWidth + "px";
			container.style.width = newWidth + "px";
			container.style.maxWidth = newWidth + "px";

			// Load marker data from JSON data file into 'markerData' object.
			const markerFilePath = `${this.settings.dataFolder}/${moc_id}.md`;
			let markerFile = this.app.vault.getFileByPath(markerFilePath);
			if (!markerFile) {
				const initialContent = "```json\n{\n  \"markers\": []\n}\n```";
				await this.app.vault.create(markerFilePath, initialContent);
				// Try to get the file again after creation
				markerFile = this.app.vault.getFileByPath(markerFilePath);
			}
			if (!markerFile) {
				el.createEl("pre", { text: `Could not load marker data for ID: ${moc_id}` });
				el.createEl("pre", { text: `Could not create marker file: ${markerFilePath}` });
				return;
			}
			const markerData = await loadMarkerDataMD(this.app.vault, markerFile.path);

			if (!markerData) {
				el.createEl("pre", { text: `Could not load marker data for ID: ${moc_id}` });
				return;
			}
			// --------------------------------

			addResizeHandle(
				container,
				img,
				isEditMode,
				markerData,
				this.settings,
				ctx,
				this.app,
				moc_id,
				markerFile,
				source,
				el,
				(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => refreshMOCBlock(this.app, source, el, ctx, mocBlockComponent),
				saveUpdatedMarker,
				deleteMarkerFromFile,
				mocBlockComponent
			);

			// --------------------------------


			// Action buttons
			if (isEditMode) {
				const actions = container.createEl("div", { cls: "mocblockRenderer-actions-buttons" });

				const pinBtn = actions.createEl("button", { text: "+ pin" });
				const polyBtn = actions.createEl("button", { text: "✎ area" });

				// Prepare marker file path for action buttons
				const markerFilePath = `${this.settings.dataFolder}/${moc_id}.md`;

				// Render Pin Button, add event listeners
				addPinButton(
					container,
					img,
					pinBtn,
					polyBtn,
					this.settings,
					this.app,
					source,
					el,
					ctx,
					markerFilePath,
					mocBlockComponent
				);

				// Render Polyline Button, add event listeners
				addPolylineButton(
					container,
					img,
					pinBtn,
					polyBtn,
					this.settings,
					this.app,
					source,
					el,
					ctx,
					markerFilePath,
					mocBlockComponent
				);
			}
			//--------------------------------
		// --------------------------------


		// Render markers
			for (const marker of markerData.markers) {

				// Render pins
				if (marker.type === "pin") {
					renderPinMarker(
						marker, 
						container, 
						img, 
						this.settings, 
						isEditMode, 
						ctx, 
						this.app, 
						moc_id, 
						markerFile, 
						source, 
						el, 
						(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => refreshMOCBlock(this.app, source, el, ctx, mocBlockComponent), 
						saveUpdatedMarker, 
						deleteMarkerFromFile,
						mocBlockComponent
					);
				}

				// Render polylines
				if (marker.type === "polyline") {
					renderPolylineMarker(
						marker, 
						container, 
						img, 
						this.settings, 
						isEditMode, 
						ctx, 
						this.app, 
						moc_id, 
						markerFile, 
						source, 
						el, 
						(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => refreshMOCBlock(this.app, source, el, ctx, mocBlockComponent), 
						saveUpdatedMarker, 
						deleteMarkerFromFile,
						mocBlockComponent
					);
				}

			}
		// --------------------------------

		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload(): void {
		// no-op placeholder; keep method non-empty to satisfy lint rules
		void 0;
	}
}
