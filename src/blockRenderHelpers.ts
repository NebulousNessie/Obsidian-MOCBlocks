import { TFile, Component, App, Vault, MarkdownPostProcessorContext } from "obsidian";

import { PinMarker, PolylineMarker, getCodeBlockContainer, Marker, MarkerData } from "./helpers";
import { MOCBlockSettings } from "./settings";
import { getStyledIconSVG } from "./icons";
import { PinEditModal, PolylineEditModal } from "./modals";


export function renderPinMarker(
    pin: PinMarker, 
    container: HTMLElement, 
    img: HTMLImageElement,
    settings: MOCBlockSettings, 
    isEditMode: boolean, 
    ctx: MarkdownPostProcessorContext, 
    app: App,
    moc_id: string, 
    markerFile: TFile | string | null, 
    source: string, 
    el: HTMLElement, 
    refreshMOCBlock: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void> | void,
    saveUpdatedMarker: (vault: Vault, path: string, marker: Marker) => Promise<void>,
    deleteMarkerFromFile: (vault: Vault, file: string | TFile, markerId: string) => Promise<void>,
    parentComponent: Component) {

    
    // Position marker on MOC Block image
        const markerEl = container.createDiv({ cls: "mocblockRenderer-marker-pin" });
        markerEl.style.left = `${pin.x}%`;
        markerEl.style.top = `${pin.y}%`;
        // markerEl.setAttr("style", `left: ${pin.x}%; top: ${pin.y}%;`);

    // Get SVG styles from style settings. If not defined, use defaults from below.
        const styleName = pin.styleName ?? "Default";
        const config = settings.styleNames[styleName];
        const iconName = config?.icon ?? "map-pin";
        const fillColour = config?.fillColour ?? "#705dcf";
        const strokeColour = config?.strokeColour ?? "#555454";
        const opacity = settings.pinsAlwaysOpaque ? "1" : (config?.opacity ?? "0.5");  

    const svgMarkup = getStyledIconSVG(iconName, { fill: fillColour, stroke: strokeColour, opacity: opacity, strokeWidth: 0.75 });
    //console.log("Resolved icon settings:", { StyleName, iconName, fillColour, strokeColour });

    // Render the marker SVGs (polyline and pins)
        if (svgMarkup) {

            // Parse SVG safely (no innerHTML)
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgMarkup, "image/svg+xml");
            const svgNode = svgDoc.documentElement;

            if (!svgNode || svgNode.tagName.toLowerCase() !== "svg") {
                console.warn("SVG element not found");
                return;
            }

            // Resolve link target
            const linkTarget = pin.link?.replace(/^\[\[|\]\]$/g, "") ?? null;

            // Create Obsidian internal link wrapper
            const linkEl = markerEl.createEl("a", {
                cls: "internal-link mocblock-pin-link"
            });

            if (linkTarget) {
                linkEl.setAttribute("data-href", linkTarget);
                linkEl.setAttribute("href", linkTarget);
            }

            // Mount SVG inside link
            linkEl.appendChild(svgNode);

            // Interaction root (IMPORTANT: everything binds here now)
            const rootEl = linkEl;

            const svgEl = linkEl.querySelector("svg");

            const suppressClick = (evt: MouseEvent) => {
                if (wasDragged) {
                    evt.preventDefault();
                    evt.stopImmediatePropagation();
                }
            };

            if (!svgEl) {
                console.warn("SVG element not found after insertion");
                return;
            }

            // Drag to reposition marker
            let isDragging = false;
            let wasDragged = false;

            const onMouseDown = (evt: MouseEvent) => {
                if (evt.button !== 0) return;
                if (!isEditMode) return;

                evt.preventDefault();
                evt.stopPropagation();

                isDragging = true;
                wasDragged = false;
            };

            const onDocMouseMove = (evt: MouseEvent) => {
                if (!isDragging) return;

                wasDragged = true;

                const imgRect = img.getBoundingClientRect();

                const mouseX = evt.clientX - imgRect.left;
                const mouseY = evt.clientY - imgRect.top;

                const clampedX = Math.max(0, Math.min(mouseX, imgRect.width));
                const clampedY = Math.max(0, Math.min(mouseY, imgRect.height));

                pin.x = (clampedX / imgRect.width) * 100;
                pin.y = (clampedY / imgRect.height) * 100;

                markerEl.style.left = `${pin.x}%`;
                markerEl.style.top = `${pin.y}%`;
            };

            const onDocMouseUp = () => {
                void (async () => {
                    if (!isDragging) return;

                    isDragging = false;

                    if (wasDragged) {
                        await saveUpdatedMarker(
                            app.vault,
                            `${settings.dataFolder}/${moc_id}.md`,
                            pin
                        );
                    }
                })();
            };

            // Edit menu (right click)
            const onContext = (evt: MouseEvent) => {
                if (!isEditMode) return;

                evt.preventDefault();
                evt.stopPropagation();

                const modal = new PinEditModal(
                    app,
                    pin,
                    settings.styleNames,
                    async (updated) => {
                        pin.styleName = updated.styleName;
                        pin.link = updated.link;

                        await saveUpdatedMarker(
                            app.vault,
                            `${settings.dataFolder}/${moc_id}.md`,
                            pin
                        );

                        await refreshMOCBlock(source, el, ctx);
                    },
                    async (markerToDelete) => {
                        if (markerFile instanceof TFile) {
                            await deleteMarkerFromFile(
                                app.vault,
                                markerFile,
                                markerToDelete.markerId
                            );

                            await refreshMOCBlock(source, el, ctx);
                            void app.workspace.trigger("moc-block-refresh");
                        }
                    }
                );

                modal.open();
            };

            // Register events (ALL on rootEl)
            parentComponent.registerDomEvent(rootEl as unknown as HTMLElement, "mousedown", onMouseDown);
            parentComponent.registerDomEvent(rootEl as unknown as HTMLElement, "contextmenu", onContext);
            parentComponent.registerDomEvent(document, "mousemove", onDocMouseMove);
            parentComponent.registerDomEvent(document, "mouseup", onDocMouseUp);
            parentComponent.registerDomEvent(rootEl as unknown as HTMLElement, "click", suppressClick, true);
        }
}

export function renderPolylineMarker(
    poly: PolylineMarker,
    container: HTMLElement,
    img: HTMLImageElement,
    settings: MOCBlockSettings,
    isEditMode: boolean,
    ctx: MarkdownPostProcessorContext,
    app: App,
    moc_id: string,
    markerFile: TFile | string | null,
    source: string,
    el: HTMLElement,
    refreshMOCBlock: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void> | void,
    saveUpdatedMarker: (vault: Vault, path: string, marker: Marker) => Promise<void>,
    deleteMarkerFromFile: (vault: Vault, file: string | TFile, markerId: string) => Promise<void>,
    parentComponent: Component
) {

    // Style config
    const styleName = poly.styleName ?? "Default";
    const config = settings.styleNames[styleName];

    const fillColour = config?.fillColour ?? "#705dcf";
    const strokeColour = config?.strokeColour ?? "#555454";
    const opacity = config?.opacity ?? "0.5";

    // SVG overlay (visual only)
    let svgOverlay = container.querySelector("svg.moc-overlay") as SVGSVGElement;

    if (!svgOverlay) {
        const rect = img.getBoundingClientRect();

        svgOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgOverlay.classList.add("moc-overlay");
        svgOverlay.setAttribute("width", rect.width.toString());
        svgOverlay.setAttribute("height", rect.height.toString());

        container.appendChild(svgOverlay);
    }

    const rect = img.getBoundingClientRect();

    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");

    const pointString = poly.points
        .map(([px, py]) => `${px * rect.width},${py * rect.height}`)
        .join(" ");

    polygon.setAttribute("points", pointString);
    polygon.setAttribute("stroke", strokeColour);
    polygon.setAttribute("stroke-width", "2");
    polygon.setAttribute("fill", fillColour);
    polygon.setAttribute("opacity", opacity);

    // IMPORTANT: visual only
    polygon.style.pointerEvents = "none";

    svgOverlay.appendChild(polygon);

    // Hover anchor (Obsidian-native preview)
    const linkTarget = poly.link?.replace(/^\[\[|\]\]$/g, "") ?? null;

    const anchorEl = container.createEl("a", {
        cls: "internal-link mocblock-polyline-anchor"
    });

    if (linkTarget) {
        anchorEl.setAttribute("data-href", linkTarget);
        anchorEl.setAttribute("href", linkTarget);
    }

    // Compute bounding box for safe hover region
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const [x, y] of poly.points) {
        const px = x * rect.width;
        const py = y * rect.height;

        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
    }

    // Expand so hover NEVER sits directly on geometry
    const padding = 14;

    const width = (maxX - minX) + padding * 2;
    const height = (maxY - minY) + padding * 2;

    anchorEl.style.position = "absolute";
    anchorEl.style.left = `${minX - padding}px`;
    anchorEl.style.top = `${minY - padding}px`;
    anchorEl.style.width = `${width}px`;
    anchorEl.style.height = `${height}px`;

    // Invisible but interactive
    anchorEl.style.opacity = "0";
    anchorEl.style.pointerEvents = "auto";

    container.appendChild(anchorEl);

    // Right-click → edit modal
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

    // Event binding
    parentComponent.registerDomEvent(
        anchorEl as unknown as HTMLElement,
        "contextmenu",
        onPolyContext
    );
}

export function addResizeHandle(
    container: HTMLElement,
    img: HTMLImageElement,
    isEditMode: boolean,
    markerData: MarkerData,
    settings: MOCBlockSettings,
    ctx: MarkdownPostProcessorContext,
    app: App,
    moc_id: string,
    markerFile: TFile | string | null,
    source: string,
    el: HTMLElement,
    refreshMOCBlock: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void> | void,
    saveUpdatedMarker: (vault: Vault, path: string, marker: Marker) => Promise<void>,
    deleteMarkerFromFile: (vault: Vault, file: string | TFile, markerId: string) => Promise<void>,
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
        void (async () => {
            if (isResizing) {
                isResizing = false;
                document.body.classList.remove("mocblockRenderer-userselect-none");

                // --- Save new width to the MOC block YAML ---
                const file = app.vault.getFileByPath(ctx.sourcePath);
                if (!(file instanceof TFile)) return;

                const content = await app.vault.cachedRead(file);
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