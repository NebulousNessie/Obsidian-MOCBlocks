import { Plugin, TFile, MarkdownView, parseYaml } from "obsidian";

import { loadMarkerDataMD, saveUpdatedMarker, refreshMOCBlock, deleteMarkerFromFile } from "./helpers";
import { MOCBlockSettings, DEFAULT_SETTINGS, MOCBlockSettingTab } from "./settings";
import { NewMocBlockModal } from "./modals";
import { renderPinMarker, renderPolylineMarker } from "./renderMarkers";
import { addPinButton, addPolylineButton } from "./actionButtons";

export default class MOCBlockPlugin extends Plugin {
	settings: MOCBlockSettings;
	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MOCBlockSettingTab(this.app, this));

		// Ensure data folder exists
		const dataFolderPath = this.settings.dataFolder;
		const folder = this.app.vault.getAbstractFileByPath(dataFolderPath);
		if (!folder) {
			await this.app.vault.createFolder(dataFolderPath);
			////console.log(`Created data folder: ${dataFolderPath}`);
		}

		this.addCommand({
			id: "insert-mocblock",
			name: "Insert MOC Block",
				editorCallback: (editor, view) => {
					new NewMocBlockModal(this.app, async (mocblockText) => {
					editor.replaceSelection(mocblockText);
					}).open();
				},
		});

		this.addRibbonIcon("image", "Insert MOC Block", () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView) return;

			new NewMocBlockModal(this.app, async (mocblockText) => {
				activeView.editor.replaceSelection(mocblockText);
			}).open();
		});

		//console.log("✅ MOC Plugin loaded");
		//console.log("Current MOC plugin settings:", this.settings);

		this.registerMarkdownCodeBlockProcessor("moc", async (source, el, ctx) => {
			//console.log("Processing MOC block:", source);

			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			const isEditMode: boolean = !!(view && view.getMode && view.getMode() === "source");

		// Parse YAML MOC Block Data
			let config: any;
			try {
				config = parseYaml(source);
				
				// Normalize keys to lowercase
				const normalizedConfig: Record<string, any> = {};
				for (const key in config) {
					normalizedConfig[key.toLowerCase()] = config[key];
				}
				config = normalizedConfig;

            } catch (e) {
                console.error("Invalid YAML in moc block", e);
                el.createEl("pre", { text: "Invalid YAML in MOC block." });
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

					const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
					if (!(file instanceof TFile)) return;

					// get the block’s line positions
					const section = ctx.getSectionInfo(el);
					if (!section) return;

					const content = await this.app.vault.read(file);
					const lines = content.split("\n");
					const blockLines = lines.slice(section.lineStart + 1, section.lineEnd);
					blockLines.push(`moc_id: ${moc_id}`);
					const newBlock = ["```moc", ...blockLines, "```"].join("\n");
					
					const newContent = [
					...lines.slice(0, section.lineStart),
					newBlock,
					...lines.slice(section.lineEnd + 1),
					].join("\n");

					await this.app.vault.modify(file, newContent);
				}

				// moc_id config defined in check if statement above.
				const imageRef = config.image;
				const imageWidth = config.image_width;
				const isFullscreen = config.fullscreen === true || config.fullscreen === "false";
				
				// debug log, check yaml parsed correctly.
				//console.log("Width:", imageWidth);
				//console.log("Image:", imageRef);
				//console.log("ID:", moc_id);
				////console.log("is Fullscreen?:", isFullscreen);
			// --------------------------------

			// Check for image field. Cannot auto-generate, notify user to add one.
				if (!imageRef) {
					el.createEl("pre", { text: "Missing 'image' field. Cannot create MOC Block." });
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


			// Resizing handle
			if (isEditMode) {
				const resizeHandle = container.createDiv({ cls: "mocblockRenderer-resize-handle" });	// Render resize handle

				let isResizing = false;
				let startX = 0;
				let startWidth = 0;
				let pendingAnimation = false;
				let latestEvent: MouseEvent | null = null;

				resizeHandle.addEventListener("mousedown", (e) => {
					e.preventDefault();
					isResizing = true;
					startX = e.clientX;
					startWidth = img.offsetWidth;
					document.body.classList.add("mocblockRenderer-userselect-none"); // prevent text selection while resizing
				});

				const handleResizeFrame = () => {
					if (!isResizing || !latestEvent) {
						pendingAnimation = false;
						return;
					}
					const e = latestEvent;
					const dx = e.clientX - startX;
					const newWidth = Math.max(50, startWidth + dx); // minimum width 50px
					img.style.width = newWidth + "px";
					img.style.maxWidth = newWidth + "px";
					container.style.width = newWidth + "px";
					container.style.maxWidth = newWidth + "px";

					// For future use when attr(data-width px) becomes usable, instead of inline styles. Use corresponding css in styles.css.
						// const newWidth = Math.max(50, startWidth + dx);
						// container.setAttr("data-width", newWidth);
						// img.setAttr("data-width", newWidth);
						// container.addClass("has-width");
						// img.addClass("has-width");

					// Remove old markers (pins and polylines)
					container.querySelectorAll(".mocblockRenderer-marker-pin, .mocblockRenderer-marker-polyline, svg.moc-overlay").forEach(el => el.remove());

					// Re-render all markers
					if (markerData && markerData.markers) {
						for (const marker of markerData.markers) {
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
									refreshMOCBlock, 
									saveUpdatedMarker, 
									deleteMarkerFromFile
								);
							}
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
									refreshMOCBlock, 
									saveUpdatedMarker, 
									deleteMarkerFromFile
								);
							}
						}
					}
					pendingAnimation = false;
				}

				window.addEventListener("mousemove", (e) => {
					if (!isResizing) return;
					latestEvent = e;
					if (!pendingAnimation) {
						pendingAnimation = true;
						requestAnimationFrame(handleResizeFrame);
					}
				});

				window.addEventListener("mouseup", async () => {
					if (isResizing) {
						isResizing = false;
						// document.body.style.userSelect = "";
						document.body.classList.remove("mocblockRenderer-userselect-none");

						// --- Save new width to the MOC block YAML ---
						const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
						if (!(file instanceof TFile)) return;

						const content = await this.app.vault.read(file);
						const section = ctx.getSectionInfo(el);
						if (!section) return;

						// Find the code block lines
						const lines = content.split("\n");
						const blockLines = lines.slice(section.lineStart + 1, section.lineEnd);

						// Update or add image_width in the block YAML
						let found = false;
						for (let i = 0; i < blockLines.length; i++) {
							if (blockLines[i].trim().startsWith("image_width:")) {
								blockLines[i] = `image_width: ${img.offsetWidth}`;
								found = true;
								break;
							}
						}
						if (!found) {
							blockLines.push(`image_width: ${img.offsetWidth}`);
						}

						// Rebuild the code block and file content
						const newBlock = ["```moc", ...blockLines, "```"].join("\n");
						const newContent = [
							...lines.slice(0, section.lineStart),
							newBlock,
							...lines.slice(section.lineEnd + 1),
						].join("\n");

						await this.app.vault.modify(file, newContent);
					}
				});
			}
			// --------------------------------


			// Action buttons
			if (isEditMode) {
				const actions = container.createEl("div", { cls: "mocblockRenderer-actions-buttons" });

				const pinBtn = actions.createEl("button", { text: "+ Pin" });
				const polyBtn = actions.createEl("button", { text: "✎ Area" });

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
					markerFilePath
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
					markerFilePath
				);
			}
			//--------------------------------
		// --------------------------------


		// Load marker data from JSON data file into 'markerData' object.
			const markerFilePath = `${this.settings.dataFolder}/${moc_id}.md`;
			let markerFile = this.app.vault.getAbstractFileByPath(markerFilePath);
			if (!markerFile) {
				const initialContent = "```json\n{\n  \"markers\": []\n}\n```";
				await this.app.vault.create(markerFilePath, initialContent);
				// Try to get the file again after creation
				markerFile = this.app.vault.getAbstractFileByPath(markerFilePath);
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
						refreshMOCBlock, 
						saveUpdatedMarker, 
						deleteMarkerFromFile
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
						refreshMOCBlock, 
						saveUpdatedMarker, 
						deleteMarkerFromFile
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
}
