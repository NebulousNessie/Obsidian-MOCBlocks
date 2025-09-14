import { TFile } from "obsidian";

import { PinMarker, PolylineMarker} from "./helpers";
import { MOCBlockSettings } from "./settings";
import { getIconSVG } from "./icons";
import { PinEditModal, PolylineEditModal } from "./modals";


export function renderPinMarker(
    pin: PinMarker, 
    container: HTMLElement, 
    img: HTMLImageElement,
    settings: MOCBlockSettings, 
    isEditMode: boolean, 
    ctx: any, 
    app: any, 
    moc_id: string, 
    markerFile: any, 
    source: string, 
    el: HTMLElement, 
    refreshMOCBlock: Function, 
    saveUpdatedMarker: Function, 
    deleteMarkerFromFile: Function) {

    
    // Position marker on MOC Block image
        const markerEl = container.createDiv({ cls: "mocblockRenderer-marker-pin" });
        markerEl.style.left = `${pin.x}%`;
        markerEl.style.top = `${pin.y}%`;
        // markerEl.setAttr("style", `left: ${pin.x}%; top: ${pin.y}%;`);
    //--------------------------------

    // Get SVG styles from style settings. If not defined, use defaults from below.
        const styleName = pin.styleName ?? "Default";
        const config = settings.styleNames[styleName];
        const StyleName = config?.styleName ?? "";
        const iconName = config?.icon ?? "faMapMarkerAlt";
        const fillColour = config?.fillColour ?? "#705dcf";
        const strokeColour = config?.strokeColour ?? "#555454";
        const opacity = settings.pinsAlwaysOpaque ? "1" : (config?.opacity ?? "0.5");  
    //--------------------------------

    const svgMarkup = getIconSVG(iconName);		// Get SVG file to be rendered from fontawesome
    //console.log("Resolved icon settings:", { StyleName, iconName, fillColour, strokeColour });

    // Render the marker SVGs (polyline and pins)
        if (svgMarkup) {

            // Deprecated innerHTML approach. Not allowed in obsidian plugins:
                // markerEl.innerHTML = svgMarkup;
                // const svgEl = markerEl.querySelector("svg");

            // Parse SVG markup without using innerHTML/outerHTML
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgMarkup, "image/svg+xml");
            const svgNode = svgDoc.documentElement;
            if (svgNode && svgNode.tagName.toLowerCase() === "svg") {
                markerEl.appendChild(svgNode);
            }
            const svgEl = markerEl.querySelector("svg");

            if (svgEl) {

                // Styling SVG based on marker's style settings.
                    svgEl.setAttribute("width", "24");
                    svgEl.setAttribute("height", "24");
                    svgEl.setAttribute("stroke-width", "1.5");
                    svgEl.querySelectorAll("path").forEach(path => {
                        path.setAttribute("fill", fillColour);
                        path.setAttribute("stroke", strokeColour);
                        path.setAttribute("opacity", opacity);
                    });
                    //console.log("Styled paths in SVG with:", { fillColour, strokeColour });
                //--------------------------------

                // Left Click Navigation to linked note
                    svgEl.addEventListener("click", (evt) => {
                        if (wasDragged) {
                            wasDragged = false; // reset for next time
                            return; // Suppress navigation
                        }
                        evt.stopPropagation();
                        const linkTarget = pin.link?.replace(/^\[\[|\]\]$/g, '') ?? null;
                        if (linkTarget) {
                            this.app.workspace.openLinkText(linkTarget, ctx.sourcePath);
                        }
                    });
                //--------------------------------

                // Right Click to open Edit Modal
                    svgEl.addEventListener("contextmenu", (evt) => {
                        if (!isEditMode) return;	// If not in edit mode, ignore input.
                        evt.preventDefault(); // prevent default browser context menu
                        evt.stopPropagation();

                        //console.log(`🛠️ Opening edit modal for marker: ${pin.markerId}`);
                        const modal = new PinEditModal(
                            this.app, 
                            pin, 
                            settings.styleNames, 
                            async (updated) => {
                                pin.styleName = updated.styleName;
                                pin.link = updated.link;
                                await saveUpdatedMarker(this.app.vault, `${settings.dataFolder}/${moc_id}.md`, pin);
                                await refreshMOCBlock(this.app, source, el, ctx); // refresh just the block
                                //this.app.workspace.trigger("moc-block-refresh"); // Optionally re-render
                            },
                            async (markerToDelete) => {
                                if (markerFile instanceof TFile) {
                                    await deleteMarkerFromFile(
                                        this.app.vault, 
                                        markerFile,
                                        markerToDelete.markerId
                                    );
                                    await refreshMOCBlock(this.app, source, el, ctx);
                                    this.app.workspace.trigger("moc-block-refresh");
                                }
                            }
                        );
                        modal.open();
                    });
                //--------------------------------
            
                // Drag to reposition marker
                    let isDragging = false;
                    let wasDragged = false;

                    svgEl.addEventListener("mousedown", (evt) => {
                    if (evt.button !== 0) return; // only left click
                    if (!isEditMode) return;	// If not in edit mode, ignore input.

                    evt.preventDefault();
                    isDragging = true;
                    wasDragged = false;
                    });

                    document.addEventListener("mouseup", async () => {
                    if (isDragging) {
                        isDragging = false;

                        // Save to JSON config file when the marker is dropped
                        if (wasDragged) {
                            await saveUpdatedMarker(
                                this.app.vault,
                                `${settings.dataFolder}/${moc_id}.md`,
                                pin
                            );
                        }
                    }
                    });

                    document.addEventListener("mousemove", (evt) => {
                        if (!isDragging) return;

                        wasDragged = true;

                        const imgRect = img.getBoundingClientRect();

                        const mouseX = evt.clientX - imgRect.left;
                        const mouseY = evt.clientY - imgRect.top;

                        // Clamp values
                        const clampedX = Math.max(0, Math.min(mouseX, imgRect.width));
                        const clampedY = Math.max(0, Math.min(mouseY, imgRect.height));

                        // Convert to percentages
                        const percentX = (clampedX / imgRect.width) * 100;
                        const percentY = (clampedY / imgRect.height) * 100;

                        pin.x = percentX;
                        pin.y = percentY;

                        // 🔹 Only update UI live
                        markerEl.style.left = `${percentX}%`;
                        markerEl.style.top = `${percentY}%`;
                    });
                //--------------------------------
            } else {
                console.warn("SVG element not found");
            }
        }
    //--------------------------------
}

export function renderPolylineMarker(
    poly: PolylineMarker, 
    container: HTMLElement, 
    img: HTMLImageElement,
    settings: MOCBlockSettings, 
    isEditMode: boolean, 
    ctx: any, 
    app: any, 
    moc_id: string, 
    markerFile: any, 
    source: string, 
    el: HTMLElement, 
    refreshMOCBlock: Function, 
    saveUpdatedMarker: Function, 
    deleteMarkerFromFile: Function) {

    // Get style config for this polyline
    const styleName = poly.styleName ?? "Default";
    const config = settings.styleNames[styleName];
    const fillColour = config?.fillColour ?? "#705dcf";
    const strokeColour = config?.strokeColour ?? "#555454";
    const opacity = config?.opacity ?? "0.5";

    // Create SVG overlay if it doesn't exist yet
    let svgOverlay = container.querySelector("svg.moc-overlay") as SVGSVGElement;
    if (!svgOverlay) {
        const rect = img.getBoundingClientRect();
        svgOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgOverlay.classList.add("moc-overlay");
        svgOverlay.setAttribute("width", rect.width.toString());
        svgOverlay.setAttribute("height", rect.height.toString());
        container.appendChild(svgOverlay);
    }

    // Create a wrapper div for the polyline marker
    const polylineEl = container.createDiv({ cls: "mocblockRenderer-marker-polyline" });

    // Build polygon from normalized points
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const rect = img.getBoundingClientRect();
    const pointString = poly.points
        .map(([px, py]) => `${px * rect.width},${py * rect.height}`)
        .join(" ");

    polygon.setAttribute("points", pointString);
    polygon.setAttribute("stroke", strokeColour);
    polygon.setAttribute("stroke-width", "2");
    polygon.setAttribute("fill", fillColour);
    polygon.setAttribute("opacity", opacity);

    svgOverlay.appendChild(polygon);
    polylineEl.appendChild(svgOverlay);
    container.appendChild(polylineEl);

    // Left Click → Open linked note
    polygon.addEventListener("click", (evt) => {
        evt.stopPropagation();
        const linkTarget = poly.link?.replace(/^\[\[|\]\]$/g, "") ?? null;
        if (linkTarget) {
            this.app.workspace.openLinkText(linkTarget, ctx.sourcePath);
        }
    });

    // Right Click → Open Polyline Edit Modal
    polygon.addEventListener("contextmenu", (evt) => {
        if (!isEditMode) return;
        evt.preventDefault();
        evt.stopPropagation();

        //console.log(`Opening edit modal for polyline: ${poly.markerId}`);
        const modal = new PolylineEditModal(
            this.app,
            poly,
            settings.styleNames,
            async (updated: PolylineMarker) => {
                poly.link = updated.link;
                poly.points = updated.points;
                poly.styleName = updated.styleName;
                await saveUpdatedMarker(
                    this.app.vault,
                    `${settings.dataFolder}/${moc_id}.md`,
                    poly
                );
                await refreshMOCBlock(this.app, source, el, ctx);
            },
            async (markerToDelete: PolylineMarker) => {
                if (markerFile instanceof TFile) {
                    await deleteMarkerFromFile(this.app.vault, markerFile, markerToDelete.markerId);
                    await refreshMOCBlock(this.app, source, el, ctx);
                }
            }
        );
        modal.open();
    });
}

export function addResizeHandle(
    container: HTMLElement,
    img: HTMLImageElement,
    isEditMode: boolean,
    markerData: any,
    settings: any,
    ctx: any,
    app: any,
    moc_id: string,
    markerFile: any,
    source: string,
    el: HTMLElement,
    refreshMOCBlock: any,
    saveUpdatedMarker: any,
    deleteMarkerFromFile: any
) {
    if (!isEditMode) return;

    const resizeHandle = container.createDiv({ cls: "mocblockRenderer-resize-handle" });

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
        document.body.classList.add("mocblockRenderer-userselect-none");
    });

    const handleResizeFrame = () => {
        if (!isResizing || !latestEvent) {
            pendingAnimation = false;
            return;
        }
        const e = latestEvent;
        const dx = e.clientX - startX;
        const newWidth = Math.max(50, startWidth + dx);
        img.style.width = newWidth + "px";
        img.style.maxWidth = newWidth + "px";
        container.style.width = newWidth + "px";
        container.style.maxWidth = newWidth + "px";

        // Remove old markers (pins and polylines)
        container.querySelectorAll(".mocblockRenderer-marker-pin, .mocblockRenderer-marker-polyline, svg.moc-overlay").forEach(el => el.remove());

        // Re-render all markers
        if (markerData && markerData.markers) {
            for (const marker of markerData.markers) {
                if (marker.type === "pin") {
                    renderPinMarker(
                        marker, container, img, settings, isEditMode, ctx, app, moc_id, markerFile, source, el, refreshMOCBlock, saveUpdatedMarker, deleteMarkerFromFile
                    );
                }
                if (marker.type === "polyline") {
                    renderPolylineMarker(
                        marker, container, img, settings, isEditMode, ctx, app, moc_id, markerFile, source, el, refreshMOCBlock, saveUpdatedMarker, deleteMarkerFromFile
                    );
                }
            }
        }
        pendingAnimation = false;
    };

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
            document.body.classList.remove("mocblockRenderer-userselect-none");

            // --- Save new width to the MOC block YAML ---
            const file = app.vault.getFileByPath(ctx.sourcePath);
            if (!(file instanceof TFile)) return;

            const content = await app.vault.read(file);
            const section = ctx.getSectionInfo(el);
            if (!section) return;

            const lines = content.split("\n");
            const blockLines = lines.slice(section.lineStart + 1, section.lineEnd);

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

            const newBlock = ["```moc", ...blockLines, "```"].join("\n");
            const newContent = [
                ...lines.slice(0, section.lineStart),
                newBlock,
                ...lines.slice(section.lineEnd + 1),
            ].join("\n");

            await app.vault.modify(file, newContent);
        }
    });
}