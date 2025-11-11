import { App, Modal, Setting, setIcon, TFile, SuggestModal, Notice } from "obsidian";
import { PinMarker, PolylineMarker } from "./helpers";
import { styleNamesSetting } from "./settings";
import { v4 as uuidv4 } from "uuid";


type LinkSuggestion = { file: TFile; heading?: string };

class LinkSuggestModal extends SuggestModal<LinkSuggestion> {
	onChoose: (file: TFile, heading?: string) => void;

	constructor(app: App, onChoose: (file: TFile, heading?: string) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder("Type to search for a note or heading...");
	}

	getSuggestions(query: string): LinkSuggestion[] {
		const files = this.app.vault.getMarkdownFiles();
		const lowerQuery = query.toLowerCase();
		const suggestions: LinkSuggestion[] = [];

		for (const file of files) {
			const fileName = file.basename.toLowerCase();

			// Match file by name
			if (fileName.includes(lowerQuery)) {
				suggestions.push({ file });
			}

			// Match headings from metadata cache
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.headings) {
				for (const h of cache.headings) {
					if (h.heading.toLowerCase().includes(lowerQuery) || fileName.includes(lowerQuery)) {
						suggestions.push({ file, heading: h.heading });
					}
				}
			}
		}

		return suggestions;
	}

	renderSuggestion(suggestion: LinkSuggestion, el: HTMLElement) {
		if (suggestion.heading) {
			const container = el.createDiv({ cls: "link-suggest-heading" });
			container.createEl("div", { text: suggestion.file.basename, cls: "suggestion-title" });
			container.createEl("div", { text: `#${suggestion.heading}`, cls: "suggestion-subtitle" });
		} else {
			el.createEl("div", { text: suggestion.file.basename, cls: "suggestion-title" });
		}
	}

	onChooseSuggestion(suggestion: LinkSuggestion) {
		this.onChoose(suggestion.file, suggestion.heading);
	}
}

class ImageSuggestModal extends SuggestModal<TFile> {
  onChoose: (file: TFile) => void;

  constructor(app: App, onChoose: (file: TFile) => void) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder("Type to search for an image...");
  }

  getSuggestions(query: string): TFile[] {
    return this.app.vault
      .getFiles()
      .filter(file => {
        const ext = file.extension.toLowerCase();
        return ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext);
      })
      .filter(file =>
        file.basename.toLowerCase().includes(query.toLowerCase())
      );
  }

  renderSuggestion(file: TFile, el: HTMLElement) {
    el.setText(file.path); // show full path so user knows which file
  }

  onChooseSuggestion(file: TFile) {
    this.onChoose(file);
  }
}

export class NewPinModal extends Modal {
	styleNames: Record<string, styleNamesSetting>;
	percentX: number;
	percentY: number;
	onSubmit: (marker: PinMarker) => Promise<void>;
	onCancel?: () => void;
	onCloseRefresh?: () => void;

	constructor(
		app: App,
		styleNames: Record<string, styleNamesSetting>,
		x: number,
		y: number,
		onSubmit: (marker: PinMarker) => Promise<void>,
		onCancel?: () => void,
		onCloseRefresh?: () => void
	) {
		super(app);
		this.styleNames = styleNames;
		this.percentX = x;
		this.percentY = y;
		this.onSubmit = onSubmit;
		this.onCancel = onCancel;
		this.onCloseRefresh = onCloseRefresh;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// contentEl.createEl("h3", { text: "Add new pin" });
		new Setting(contentEl).setName('Add new pin').setHeading();

		let selectedstyleName = Object.keys(this.styleNames)[0] || "Default";
		let linkValue = "";

		new Setting(contentEl)
		.setName("Link")
		.addButton(btn => {
			btn.setButtonText(linkValue ? linkValue : "Add note link");
			btn.onClick(() => {
				new LinkSuggestModal(this.app, (file, heading) => {
					if (heading) {
						linkValue = `[[${file.basename}#${heading}]]`;
					} else {
						linkValue = `[[${file.basename}]]`;
					}
					btn.setButtonText(linkValue);
				}).open();
			});
		});

		new Setting(contentEl)
			.setName("Style")
			.addDropdown(drop => {
				Object.keys(this.styleNames).forEach(styleName => drop.addOption(styleName, styleName));
				drop.setValue(selectedstyleName);
				drop.onChange(value => selectedstyleName = value);
			});

		new Setting(contentEl)
			.addButton(btn => {
				btn.setButtonText("Add pin")
					.setCta()
					.onClick(async () => {
					if (!selectedstyleName || !linkValue.trim()) {
                    	new Notice("All fields are required.");
                    	return;
                	}
						const newMarker: PinMarker = {
							markerId: uuidv4(),
							x: this.percentX,
							y: this.percentY,
							type: "pin",
							styleName: selectedstyleName,
							link: linkValue.trim(),
						};
						await this.onSubmit(newMarker);
						this.close();
					});
			});
	}

	onClose() {
		this.contentEl.empty();
		if (this.onCancel) this.onCancel();
		if (this.onCloseRefresh) this.onCloseRefresh();
	}
}

export class PinEditModal extends Modal {
	marker: PinMarker;
	onSave: (updated: PinMarker) => void;
	onDelete?: (marker: PinMarker) => void;
	styleNames: Record<string, styleNamesSetting>;
	onCloseRefresh?: () => void;

	constructor(
		app: App,
		marker: PinMarker,
		styleNames: Record<string, styleNamesSetting>,
		onSave: (updated: PinMarker) => void,
		onDelete?: (marker: PinMarker) => void
		, onCloseRefresh?: () => void
	) {
		super(app);
		this.marker = { ...marker }; // clone to avoid mutating original until save
		this.styleNames = styleNames;
		this.onSave = onSave;
		this.onDelete = onDelete;
		this.onCloseRefresh = onCloseRefresh;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		// contentEl.createEl("h2", { text: "Edit marker" });
		new Setting(contentEl).setName('Edit marker').setHeading();


			let linkValue = this.marker.link ?? "";
			new Setting(contentEl)
			.setName("Link")
			.addButton(btn => {
				btn.setButtonText(linkValue ? linkValue : "Change note link");
				btn.onClick(() => {
				new LinkSuggestModal(this.app, (file, heading) => {
						if (heading) {
							linkValue = `[[${file.basename}#${heading}]]`;
						} else {
							linkValue = `[[${file.basename}]]`;
						}
						btn.setButtonText(linkValue);
					}).open();

					
				});
			});

			let selectedstyleName = this.marker.styleName ?? "Default";
			new Setting(contentEl)
				.setName("Style")
				.addDropdown((drop) => {
					// Populate dropdown from styleNames
					Object.keys(this.styleNames).forEach((styleKey) => {
						drop.addOption(styleKey, this.styleNames[styleKey].styleName ?? styleKey);
					});
					drop.setValue(selectedstyleName);
					drop.onChange((value) => {
						selectedstyleName = value;
					});
				});

		const buttonSetting = new Setting(contentEl);
		// Save button
		buttonSetting.addButton((button) => {
			button
				.setButtonText("Save")
				.setCta()
				.onClick(() => {
					// Update common fields
					this.marker.link = linkValue.trim();
					if (this.marker.type === "pin") {
						this.marker.styleName = selectedstyleName;
					}
					this.onSave(this.marker);
					this.close();
				});
		});

		// Trash (delete) button
		buttonSetting.addExtraButton((btn) => {
			setIcon(btn.extraSettingsEl, "trash-2"); // Obsidian's trash icon
			btn.extraSettingsEl.setAttr("aria-label", "Delete marker");
			btn.extraSettingsEl.classList.add("mocblock-trash-hover");
			btn.extraSettingsEl.addEventListener("click", async () => {
				if (this.onDelete) {
					await this.onDelete(this.marker);
				}
				this.close();
			});
		});
	}

	onClose() {
		this.contentEl.empty();
		if (this.onCloseRefresh) this.onCloseRefresh();
	}
}

export class NewPolylineModal extends Modal {
	private points: [number, number][];
	styleNames: Record<string, styleNamesSetting>;
	onSubmit: (marker: PolylineMarker) => Promise<void>;
	onCancel: () => void;
	onCloseRefresh?: () => void;


	constructor(
		app: App,
		points: [number, number][],
		styleNames: Record<string, styleNamesSetting>,
		onSubmit: (marker: PolylineMarker) => Promise<void>,
		onCancel: () => void,
		onCloseRefresh?: () => void
	) {
		super(app);
		this.points = points;
		this.styleNames = styleNames;
		this.onSubmit = onSubmit;
		this.onCancel = onCancel;
		this.onCloseRefresh = onCloseRefresh;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		// contentEl.createEl("h2", { text: "Add new polyline" });
		new Setting(contentEl).setName('Add new polyline').setHeading();

		let linkValue = "";
		let selectedstyleName = Object.keys(this.styleNames)[0] || "Default";

		new Setting(contentEl)
		.setName("Link")
		.addButton(btn => {
				btn.setButtonText(linkValue ? linkValue : "Add note link");
				btn.onClick(() => {
				new LinkSuggestModal(this.app, (file, heading) => {
						if (heading) {
							linkValue = `[[${file.basename}#${heading}]]`;
						} else {
							linkValue = `[[${file.basename}]]`;
						}
						btn.setButtonText(linkValue);
					}).open();

				});
			});

        // Style dropdown
        new Setting(contentEl)
            .setName("Style")
            .addDropdown(drop => {
                Object.keys(this.styleNames).forEach(style => drop.addOption(style, style));
                drop.setValue(selectedstyleName);
                drop.onChange(value => selectedstyleName = value);
            });

		new Setting(contentEl).addButton(btn => {
			btn.setButtonText("Add polyline")
				.setCta()
				.onClick(async () => {
				if (!selectedstyleName || !linkValue.trim()) {
                    new Notice("All fields are required.");
                    return;
                }
					const newMarker: PolylineMarker = {
						markerId: uuidv4(),
						type: "polyline",
						points: this.points,
						link: linkValue.trim(),
						styleName: selectedstyleName,
					};
					await this.onSubmit(newMarker);
					this.close();
				});
		});

	}

	onClose() {
		this.contentEl.empty();
		if (this.onCancel) this.onCancel();
		if (this.onCloseRefresh) this.onCloseRefresh();
	}
}

export class PolylineEditModal extends Modal {
	marker: PolylineMarker;
	onSave: (updated: PolylineMarker) => void;
	onDelete?: (marker: PolylineMarker) => void;
    styleNames: Record<string, styleNamesSetting>;
	onCloseRefresh?: () => void;

	constructor(
		app: App,
		marker: PolylineMarker,
		styleNames: Record<string, styleNamesSetting>,
		onSave: (updated: PolylineMarker) => void,
		onDelete?: (marker: PolylineMarker) => void
		, onCloseRefresh?: () => void
	) {
		super(app);
		this.marker = { ...marker }; // clone so we don't mutate original until save
		this.styleNames = styleNames;
		this.onSave = onSave;
		this.onDelete = onDelete;
		this.onCloseRefresh = onCloseRefresh;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		//contentEl.createEl("h2", { text: "Edit polyline" });
		new Setting(contentEl).setName('Edit polyline').setHeading();

		// Edit Link
		let linkValue = this.marker.link ?? "";
		new Setting(contentEl)
			.setName("Link")
			.addButton((btn) => {
				btn.setButtonText(linkValue ? linkValue : "Change note link");
				btn.onClick(() => {
				new LinkSuggestModal(this.app, (file, heading) => {
						if (heading) {
							linkValue = `[[${file.basename}#${heading}]]`;
						} else {
							linkValue = `[[${file.basename}]]`;
						}
						btn.setButtonText(linkValue);
					}).open();

				});
			});

		// Edit Style
		let selectedstyleName = this.marker.styleName ?? Object.keys(this.styleNames)[0] ?? "Default";
		new Setting(contentEl)
			.setName("Style")
			.addDropdown((drop) => {
				// Populate dropdown from styleNames
				Object.keys(this.styleNames).forEach((styleKey) => {
					drop.addOption(styleKey, this.styleNames[styleKey].styleName ?? styleKey);
				});
				drop.setValue(selectedstyleName);
				drop.onChange((value) => {
					selectedstyleName = value;
				});
			});

		// Buttons
		const buttonSetting = new Setting(contentEl);

		// Save
		buttonSetting.addButton((button) => {
			button
				.setButtonText("Save")
				.setCta()
				.onClick(() => {
					this.marker.link = linkValue.trim();
					this.marker.styleName = selectedstyleName;
					this.onSave(this.marker);
					this.close();
					//console.log("MARKER: ", this.marker);
				});
		});

		// Delete
		buttonSetting.addExtraButton((btn) => {
			setIcon(btn.extraSettingsEl, "trash-2");
			btn.extraSettingsEl.setAttr("aria-label", "Delete polyline");
			btn.extraSettingsEl.classList.add("mocblock-trash-hover");
			btn.extraSettingsEl.addEventListener("click", async () => {
				if (this.onDelete) {
					await this.onDelete(this.marker);
				}
				this.close();
			});
		});
	}

	onClose() {
		this.contentEl.empty();
		if (this.onCloseRefresh) this.onCloseRefresh();
	}
}

export class NewMocBlockModal extends Modal {
  onSubmit: (result: string) => void;
	onCloseRefresh?: () => void;

  constructor(app: App, onSubmit: (result: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    // contentEl.createEl("h2", { text: "New MOC Block" });
	new Setting(contentEl).setName('New MOC Block').setHeading();

	let imageLink = "";
	let moc_id = `moc-${Math.random().toString(36).slice(2, 10)}`;

    //const imageInput = contentEl.createEl("input", { type: "text", placeholder: "Image path" });
	new Setting(contentEl)
	.setName("Image")
	.addButton(btn => {
		btn.setButtonText(imageLink ? imageLink : "Select image to use");
		btn.onClick(() => {
			new ImageSuggestModal(this.app, (file) => {
				//imageLink = `[[${file.basename}]]`;
				imageLink = file.path;
				btn.setButtonText(imageLink);
			}).open();
		});
	});

    const submitBtn = contentEl.createEl("button", { text: "Insert" });
    submitBtn.addEventListener("click", () => {
      const block = [
        "```moc",
        `image: ${imageLink}`,
        `moc_id: ${moc_id}`,
        "```",
      ].join("\n");

      this.onSubmit(block);
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
		if (this.onCloseRefresh) this.onCloseRefresh();
  }
}