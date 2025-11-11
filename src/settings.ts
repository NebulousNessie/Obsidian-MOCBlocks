import { PluginSettingTab, App, Setting, normalizePath } from "obsidian";
import { renameDataFolder } from "./helpers";
import MOCBlockPlugin from "./main";
import { AVAILABLE_ICONS } from "./icons";

export interface styleNamesSetting {
	styleName: string;
	icon: string;
	fillColour: string;
	strokeColour: string;
	opacity: string;
}

export interface MOCBlockSettings {
	styleNames: Record<string, styleNamesSetting>;
    dataFolder: string;
	pinsAlwaysOpaque: boolean;
}

export const DEFAULT_SETTINGS: MOCBlockSettings = {
	styleNames: {
		Default: {
			styleName: "Default",
			icon: "map-pin",
			fillColour: "#2faf15",
			strokeColour: "#555454",
			opacity: "0.5",
		}
	},
	pinsAlwaysOpaque: false,
	dataFolder: "MOCData",
};

export class MOCBlockSettingTab extends PluginSettingTab {
	plugin: MOCBlockPlugin;

	constructor(app: App, plugin: MOCBlockPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		//containerEl.createEl("h2", { text: "Data file settings" });
		//new Setting(containerEl).setName('Data file settings').setHeading();

		// Add data folder setting
		new Setting(containerEl)
			.setName("Data folder")
			.setDesc("Folder in your vault where marker data files will be stored.")
			.addText(text => {
				text.setPlaceholder("e.g. mocdata");
				text.setValue(this.plugin.settings.dataFolder || "mocdata");

				// Track value but don't save yet: annoying workaround to prevent save on every keystroke.
				let pendingValue = this.plugin.settings.dataFolder || "mocdata";
				text.onChange((value) => {
					pendingValue = value.trim();
				});
				text.inputEl.addEventListener("blur", async () => {
					const oldPath = normalizePath(this.plugin.settings.dataFolder);
					const newPath = normalizePath(pendingValue || "mocdata");
					this.plugin.settings.dataFolder = newPath;
					await this.plugin.saveSettings();
					await renameDataFolder(this.app, oldPath, newPath);

					// Create the folder if it doesn't exist
					const folderExists = await this.app.vault.adapter.exists(newPath);
					if (!folderExists) {
						await this.app.vault.createFolder(newPath);
					}

					this.display();
				});
			});
		// ---------------------------------

	// containerEl.createEl("h2", { text: "Style settings" });
	new Setting(containerEl).setName('Marker & Polyline Styles').setHeading();

		// Toggle for opaque pins
		new Setting(containerEl)
			.setName("Opaque pins")
			.setDesc("If enabled, all pins are fully opaque regardless of style opacity.")
			.addToggle(toggle => 
				toggle
					.setValue(this.plugin.settings.pinsAlwaysOpaque)
					.onChange(async (value) => {
						this.plugin.settings.pinsAlwaysOpaque = value;
						await this.plugin.saveSettings();
					})
			);
		// ---------------------------------

		// For each unique styleName in the plugin data (settings data), create a dropdown.
			Object.entries(this.plugin.settings.styleNames).forEach(([styleName, config]) => {
			
			// Container for the row
			const row = containerEl.createDiv({ cls: "mocblock-settings-style-row" });

			// Toggle button
			const toggleBtn = row.createEl("button", {
				text: "▼",
				cls: "mocblock-settings-style-toggle"
			});

			// Style name (always visible)
			//const styleNameEl = row.createEl("span", { text: styleName, cls: "mocblock-settings-style-title" });

			// Details div (hidden by default)
			const detailsDiv = containerEl.createDiv({ cls: "mocblock-settings-style-details" });

			// Icon dropdown
			new Setting(detailsDiv)
				.setName("Icon")
				.addDropdown(drop => {
					AVAILABLE_ICONS.forEach(iconName => drop.addOption(iconName, iconName));
					drop.setValue(config.icon);
					drop.onChange(async (value) => {
						config.icon = value;
						await this.plugin.saveSettings();
					});
				});

			// Stroke color picker
			new Setting(detailsDiv)
				.setName("Stroke colour")
				.addColorPicker(picker => {
					picker.setValue(config.strokeColour);
					picker.onChange(async value => {
						config.strokeColour = value;
						await this.plugin.saveSettings();
					});
				});

			// Fill color picker
			new Setting(detailsDiv)
				.setName("Fill colour")
				.addColorPicker(picker => {
					picker.setValue(config.fillColour);
					picker.onChange(async value => {
						config.fillColour = value;
						await this.plugin.saveSettings();
					});
				});

			// Opacity input
			new Setting(detailsDiv)
				.setName("Opacity (0–1)")
				.addText(text => {
					text.inputEl.type = "number";
					text.inputEl.min = "0";
					text.inputEl.max = "1";
					text.inputEl.step = "0.05";
					text.setValue(config.opacity ?? "1");
					text.onChange(async value => {
						const val = Math.max(0, Math.min(1, parseFloat(value) || 1)).toString();
						config.opacity = val;
						await this.plugin.saveSettings();
					});
				});

			// Trash icon
			new Setting(detailsDiv)
				.addExtraButton(button => {
					button.setIcon("trash");
					button.setTooltip("Delete style");
					button.extraSettingsEl.classList.add("mocblock-trash-hover");
					button.onClick(async () => {
						delete this.plugin.settings.styleNames[styleName];
						await this.plugin.saveSettings();
						this.display(); // re-render
					});
				});

			// Toggle logic
			let expanded = false;
			toggleBtn.onclick = () => {
				expanded = !expanded;
				detailsDiv.style.display = expanded ? "block" : "none";
				toggleBtn.textContent = expanded ? "▲" : "▼";
			};
		});
		// ---------------------------------


	// Adding a new style
		// Setting the new style inputs to the defaults, defined in DEFAULT_SETTINGS
		let styleValue = "";
		let iconValue = AVAILABLE_ICONS[0];
		let fillColourValue = DEFAULT_SETTINGS.styleNames.Default.fillColour;
		let strokeColourValue = DEFAULT_SETTINGS.styleNames.Default.strokeColour;
		let opacityValue = DEFAULT_SETTINGS.styleNames.Default.opacity;

		const addSetting = new Setting(containerEl)
			.setName("Add new style")
			//.setDesc("Define a new style and choose an icon.");

		// Style input
		addSetting.addText(text => {
			text.setPlaceholder("e.g. style1");
			text.onChange(value => { styleValue = value; });
		});

		// Icon input
		addSetting.addDropdown(drop => {
			AVAILABLE_ICONS.forEach(iconName => drop.addOption(iconName, iconName));
			drop.setValue(iconValue);
			drop.onChange(value => { iconValue = value; });
		});

		// Stroke Colour input
		addSetting.addColorPicker(picker => {
			picker.setValue(strokeColourValue);
			picker.onChange(value => { strokeColourValue = value; });
		});

		// Fill Colour input
		addSetting.addColorPicker(picker => {
			picker.setValue(fillColourValue);
			picker.onChange(value => { fillColourValue = value; });
		});

		// Opacity input
		addSetting.addText(text => {
			text.inputEl.type = "number";
			text.inputEl.min = "0";
			text.inputEl.max = "1";
			text.inputEl.step = "0.05";
			text.setValue(opacityValue);
			text.onChange(value => {
				opacityValue = Math.max(0, Math.min(1, parseFloat(value) || 1)).toString();
			});
		});

		addSetting.addButton(btn => {
			btn.setButtonText("Add").onClick(async () => {
				const trimmed = styleValue.trim();
				if (!trimmed) return;

				this.plugin.settings.styleNames[trimmed] = {
					styleName: styleValue,
					icon: iconValue,
					fillColour: fillColourValue,
					strokeColour: strokeColourValue,
					opacity: opacityValue,
				};

				//console.log("New style added:", styleValue, iconValue, fillColourValue, strokeColourValue);
				await this.plugin.saveSettings();
				this.display(); // re-render UI
			});
		});

	// Prevent auto focus on data input folder
	window.setTimeout(() => {
		(document.activeElement as HTMLElement)?.blur();
	}, 0);

	}
}