import { TFile, Component } from "obsidian";

import { PinMarker, PolylineMarker, getCodeBlockContainer } from "./helpers";
import { MOCBlockSettings } from "./settings";
import { getStyledIconSVG } from "./icons";
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
    refreshMOCBlock: (source: string, el: HTMLElement, ctx: any) => Promise<void> | void,
    saveUpdatedMarker: (vault: any, path: string, marker: any) => Promise<void>,
    deleteMarkerFromFile: (vault: any, file: any, markerId: string) => Promise<void>,
    parentComponent: Component) {

    
    // Position marker on MOC Block image
        const markerEl = container.createDiv({ cls: "mocblockRenderer-marker-pin" });
        markerEl.style.left = `${pin.x}%`;
        markerEl.style.top = `${pin.y}%`;
        // markerEl.setAttr("style", `left: ${pin.x}%; top: ${pin.y}%;`);
    //--------------------------------

    // Get SVG styles from style settings. If not defined, use defaults from below.
        const styleName = pin.styleName ?? "Default";
        const config = settings.styleNames[styleName];
        const iconName = config?.icon ?? "map-pin";
        const fillColour = config?.fillColour ?? "#705dcf";
        const strokeColour = config?.strokeColour ?? "#555454";
        const opacity = settings.pinsAlwaysOpaque ? "1" : (config?.opacity ?? "0.5");  
    //--------------------------------

    // const iconSize = (config as any)?.iconSize ? Number((config as any).iconSize) : 24;
    // markerEl.style.width = `${iconSize}px`;
    // markerEl.style.height = `${iconSize}px`;

    const svgMarkup = getStyledIconSVG(iconName, { fill: fillColour, stroke: strokeColour, opacity: opacity, strokeWidth: 0.75 });
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

                // Left Click Navigation to linked note
                const onClick = (evt: MouseEvent) => {
                    if (wasDragged) {
                        wasDragged = false; // reset for next time
                        return; // Suppress navigation
                    }
                    evt.stopPropagation();
                    const linkTarget = pin.link?.replace(/^\[\[|\]\]$/g, '') ?? null;
                    if (linkTarget) {
                        app.workspace.openLinkText(linkTarget, ctx.sourcePath);
                    }
                };
                parentComponent.registerDomEvent(svgEl as unknown as HTMLElement, "click", onClick);
                //--------------------------------

                // Right Click to open Edit Modal
                const onContext = (evt: MouseEvent) => {
                    if (!isEditMode) return; // If not in edit mode, ignore input.
                    evt.preventDefault(); // prevent default browser context menu
                    evt.stopPropagation();

                    const modal = new PinEditModal(
                        app,
                        pin,
                        settings.styleNames,
                        async (updated) => {
                            pin.styleName = updated.styleName;
                            pin.link = updated.link;
                            await saveUpdatedMarker(app.vault, `${settings.dataFolder}/${moc_id}.md`, pin);
                            await refreshMOCBlock(source, el, ctx); // refresh just the block
                        },
                        async (markerToDelete) => {
                            if (markerFile instanceof TFile) {
                                await deleteMarkerFromFile(
                                    app.vault,
                                    markerFile,
                                    markerToDelete.markerId
                                );
                                await refreshMOCBlock(source, el, ctx);
                                app.workspace.trigger("moc-block-refresh");
                            }
                        }
                    );
                    modal.open();
                };
                parentComponent.registerDomEvent(svgEl as unknown as HTMLElement, "contextmenu", onContext);
                //--------------------------------
            
                // Drag to reposition marker
                    let isDragging = false;
                    let wasDragged = false;

                    const onMouseDown = (evt: MouseEvent) => {
                        if (evt.button !== 0) return; // only left click
                        if (!isEditMode) return; // If not in edit mode, ignore input.

                        evt.preventDefault();
                        isDragging = true;
                        wasDragged = false;
                    };

                    const onDocMouseUp = () => {
                        // Wrap async logic in an IIFE so the registered handler returns void
                        (async () => {
                            if (isDragging) {
                                isDragging = false;

                                // Save to JSON config file when the marker is dropped
                                if (wasDragged) {
                                    await saveUpdatedMarker(
                                        app.vault,
                                        `${settings.dataFolder}/${moc_id}.md`,
                                        pin
                                    );
                                }
                            }
                        })();
                    };

                    const onDocMouseMove = (evt: MouseEvent) => {
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
                    };

                    parentComponent.registerDomEvent(svgEl as unknown as HTMLElement, "mousedown", onMouseDown);
                    parentComponent.registerDomEvent(document, "mouseup", onDocMouseUp);
                    parentComponent.registerDomEvent(document, "mousemove", onDocMouseMove);
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
    refreshMOCBlock: (source: string, el: HTMLElement, ctx: any) => Promise<void> | void,
    saveUpdatedMarker: (vault: any, path: string, marker: any) => Promise<void>,
    deleteMarkerFromFile: (vault: any, file: any, markerId: string) => Promise<void>,
    parentComponent: Component) {

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
    const onPolyClick = (evt: MouseEvent) => {
        evt.stopPropagation();
        const linkTarget = poly.link?.replace(/^\[\[|\]\]$/g, "") ?? null;
        if (linkTarget) {
            app.workspace.openLinkText(linkTarget, ctx.sourcePath);
        }
    };

    // Right Click → Open Polyline Edit Modal
    const onPolyContext = (evt: MouseEvent) => {
        if (!isEditMode) return;
        evt.preventDefault();
        evt.stopPropagation();

        const modal = new PolylineEditModal(
            app,
            poly,
            settings.styleNames,
                async (updated: PolylineMarker) => {
                poly.link = updated.link;
                poly.points = updated.points;
                poly.styleName = updated.styleName;
                await saveUpdatedMarker(
                    app.vault,
                    `${settings.dataFolder}/${moc_id}.md`,
                    poly
                );
                await refreshMOCBlock(source, el, ctx);
            },
            async (markerToDelete: PolylineMarker) => {
                if (markerFile instanceof TFile) {
                    await deleteMarkerFromFile(app.vault, markerFile, markerToDelete.markerId);
                    await refreshMOCBlock(source, el, ctx);
                }
            }
        );
        modal.open();
    };

    parentComponent.registerDomEvent(polygon as unknown as HTMLElement, "click", onPolyClick);
    parentComponent.registerDomEvent(polygon as unknown as HTMLElement, "contextmenu", onPolyContext);
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
    refreshMOCBlock: (source: string, el: HTMLElement, ctx: any) => Promise<void> | void,
    saveUpdatedMarker: (vault: any, path: string, marker: any) => Promise<void>,
    deleteMarkerFromFile: (vault: any, file: any, markerId: string) => Promise<void>,
    parentComponent: Component
) {
    if (!isEditMode) return;

    const resizeHandle = container.createDiv({ cls: "mocblockRenderer-resize-handle" });

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let pendingAnimation = false;
    let latestEvent: MouseEvent | null = null;

    const onResizeMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startWidth = img.offsetWidth;
        document.body.classList.add("mocblockRenderer-userselect-none");
    };

    parentComponent.registerDomEvent(resizeHandle as unknown as HTMLElement, "mousedown", onResizeMouseDown);

    const handleResizeFrame = () => {
        if (!isResizing || !latestEvent) {
            pendingAnimation = false;
            return;
        }
        const e = latestEvent;
        const dx = e.clientX - startX;

        const codeBlockContainer = getCodeBlockContainer(container);
        let maxWidth = Infinity;
        if (codeBlockContainer) {
            maxWidth = codeBlockContainer.getBoundingClientRect().width;
        }

        let newWidth = Math.max(50, startWidth + dx);
        if (isFinite(maxWidth)) {
            newWidth = Math.min(newWidth, maxWidth);
        }

        // const newWidth = Math.max(50, startWidth + dx);
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
                        marker, container, img, settings, isEditMode, ctx, app, moc_id, markerFile, source, el, refreshMOCBlock, saveUpdatedMarker, deleteMarkerFromFile, parentComponent
                    );
                }
                if (marker.type === "polyline") {
                    renderPolylineMarker(
                        marker, container, img, settings, isEditMode, ctx, app, moc_id, markerFile, source, el, refreshMOCBlock, saveUpdatedMarker, deleteMarkerFromFile, parentComponent
                    );
                }
            }
        }
        pendingAnimation = false;
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        latestEvent = e;
        if (!pendingAnimation) {
            pendingAnimation = true;
            requestAnimationFrame(handleResizeFrame);
        }
    };

    const onMouseUp = () => {
        // Wrap async logic in an IIFE so the registered handler returns void
        (async () => {
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

                await app.vault.process(file, () => newContent);
            }
        })();
    };

    parentComponent.registerDomEvent(window, "mousemove", onMouseMove);
    parentComponent.registerDomEvent(window, "mouseup", onMouseUp);
}