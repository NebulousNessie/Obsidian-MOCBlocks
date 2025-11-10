import { TFile, Vault, MarkdownRenderer, MarkdownPostProcessorContext, App, Component, Notice} from "obsidian";

export interface BaseMarker {
  markerId: string;
  link: string;
  styleName: string;
}


export interface PinMarker extends BaseMarker {
  x: number;
  y: number;
  type: "pin";
}

export interface PolylineMarker extends BaseMarker {
  points: [number, number][]; // percentage coords
  type: "polyline";
}

export type Marker = PinMarker | PolylineMarker;

export interface MarkerData {
	markers: Marker[];
}

export async function loadMarkerDataMD(
  vault: Vault,
  path: string
): Promise<MarkerData | null> {
  // const { fileName } = parseObsidianLink(path);
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    console.warn(`📁 Marker file not found: ${path}`);
    return null;
  }

  try {
    const content = await vault.read(file);
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      console.warn(`❌ No JSON block in ${path}`);
      return null;
    }

    const json = JSON.parse(jsonMatch[1]);
    if (!Array.isArray(json.markers)) {
      throw new Error("Missing or invalid 'markers' array.");
    }

    return json;
  } catch (err) {
    console.error(`❌ Failed to load marker data from ${path}:`, err);
    return null;
  }
}

export async function saveUpdatedMarker(
  vault: Vault,
  path: string,
  updatedMarker: Marker
): Promise<void> {
  // const { fileName } = parseObsidianLink(path);
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return;

  const content = await vault.read(file);
  const match = content.match(/```json\s*([\s\S]*?)```/);
  if (!match) return;

  const markerData: MarkerData = JSON.parse(match[1]);

  // Replace existing marker by ID
  const index = markerData.markers.findIndex(
    (m) => m.markerId === updatedMarker.markerId
  );
  // if (index !== -1) {
  //   markerData.markers[index] = updatedMarker;
  // }
  if (index !== -1) {
  markerData.markers[index] = {
    ...markerData.markers[index],
    ...updatedMarker,
  };
}

  const newJson =
    "```json\n" + JSON.stringify(markerData, null, 2) + "\n```";
  const newContent = content.replace(/```json\s*[\s\S]*?```/, newJson);

  await vault.process(file, () => newContent);
  //console.log("📝 Marker updated and saved to file:", updatedMarker);
}

export async function addMarkerToFile(
  vault: Vault,
  path: string,
  newMarker: Marker
): Promise<void> {
  // const { fileName } = parseObsidianLink(path);
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) throw new Error(`File not found: ${path}`);

  const content = await vault.read(file);
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) throw new Error(`No JSON block found in ${path}`);

  const json: MarkerData = JSON.parse(jsonMatch[1]);
  if (!Array.isArray(json.markers)) json.markers = [];

  json.markers.push(newMarker);

  const updatedJsonBlock =
    "```json\n" + JSON.stringify(json, null, 2) + "\n```";
  const newContent = content.replace(/```json\s*[\s\S]*?```/, updatedJsonBlock);

  await vault.process(file, () => newContent);
  //console.log("Marker added:", newMarker);
}

export async function refreshMOCBlock(
	app: App,
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
  parentComponent: Component
): Promise<void> {
	// Clear the existing block content
	el.empty();

  // Re-run the code block's processing logic
  await MarkdownRenderer.render(
    app,
    "```moc\n" + source + "\n```", // simulate block
    el,
    ctx.sourcePath,
    parentComponent
  );
}

export async function deleteMarkerFromFile(
  vault: Vault,
  file: string | TFile,   // Supports path or TFile
  markerId: string
): Promise<void> {
  const tfile = typeof file === "string" 
    ? vault.getAbstractFileByPath(file) 
    : file;

  if (!(tfile instanceof TFile)) return;

  const content = await vault.read(tfile);
  const match = content.match(/```json\s*([\s\S]*?)```/);
  if (!match) return;

  const markerData: MarkerData = JSON.parse(match[1]);
  markerData.markers = markerData.markers.filter(m => m.markerId !== markerId);

  const newJson = "```json\n" + JSON.stringify(markerData, null, 2) + "\n```";
  const newContent = content.replace(/```json\s*[\s\S]*?```/, newJson);

  await vault.process(tfile, () => newContent);
  //console.log("🗑️ Marker deleted:", markerId);
}

export async function renameDataFolder(app: App, oldPath: string, newPath: string) {
	const oldFolder = app.vault.getAbstractFileByPath(oldPath);
	const newFolder = app.vault.getAbstractFileByPath(newPath);
	if (oldFolder && oldPath !== newPath) {
		if (newFolder) {
			//console.log("Destination folder already exists, cannot rename.");
			new Notice(`Destination folder "${newPath}" already exists.`);
			return;
		}
		await app.fileManager.renameFile(oldFolder, newPath);
	}
}

export function getCodeBlockContainer(container: HTMLElement): HTMLElement | null {
    let el: HTMLElement | null = container;
    while (el) {
        if (
            el.classList.contains("cm-preview-code-block") &&
            el.classList.contains("cm-embed-block") &&
            el.classList.contains("markdown-rendered") &&
            el.classList.contains("cm-lang-moc")
        ) {
            return el;
        }
        el = el.parentElement;
    }
    return null;
}