import { NewPinModal, NewPolylineModal } from "./modals";
import { addMarkerToFile, refreshMOCBlock } from "./helpers";
import { PolylineMarker } from "./helpers";
import { MOCBlockSettings } from "./settings";

export function addPinButton(
    container: HTMLElement,
    img: HTMLImageElement,
    pinBtn: HTMLButtonElement,
    polyBtn: HTMLButtonElement,
    settings: MOCBlockSettings,
    app: any,
    source: string,
    el: HTMLElement,
    ctx: any,
    markerFilePath: string
) {
    pinBtn.addEventListener("click", () => {

        // Add outline to image
        img.classList.add("mocblockRenderer-editing-outline");

        // Add overlay to image
        let overlay = container.querySelector(".mocblockRenderer-editing-overlay") as HTMLDivElement;
        if (!overlay) {
            overlay = container.createDiv({ cls: "mocblockRenderer-editing-overlay" });
        }


        // Create SVG overlay exactly matching image dimensions
        const svgNS = "http://www.w3.org/2000/svg";	// SVG namespace
        const svg = document.createElementNS(svgNS, "svg");
        svg.classList.add("mocblockRenderer-overlay");
        container.appendChild(svg);

        // Disable the button while waiting (prevents duplicate listeners)
        pinBtn.setAttribute("disabled", "true");
        polyBtn.setAttribute("disabled", "true");

        // Click handler attached to container (so overlay/SVG won't block)
        const clickHandler = async (evt: MouseEvent) => {
            // compute image rect once at click time
            const imgRect = img.getBoundingClientRect();

            // Constrain click events to image bounds
            if (
                evt.clientX < imgRect.left ||
                evt.clientX > imgRect.right ||
                evt.clientY < imgRect.top ||
                evt.clientY > imgRect.bottom
            ) {
                return;
            }

            // Prevent default behavior
            evt.preventDefault();

            const clickX = evt.clientX - imgRect.left;
            const clickY = evt.clientY - imgRect.top;

            const percentX = (clickX / imgRect.width) * 100;
            const percentY = (clickY / imgRect.height) * 100;

            // Open modal with coordinates
            const newPinModal = new NewPinModal(
                this.app,
                settings.styleNames,
                percentX,
                percentY,
                async (newMarker) => {
                    await addMarkerToFile(this.app.vault, markerFilePath, newMarker);
                    await refreshMOCBlock(this.app, source, el, ctx);
                    this.app.workspace.trigger("markdown-code-block-processed");
                },
                cleanup // call cleanup on cancel
            );
            newPinModal.open();
        };

        // Escape cancels placement
        const escHandler = (ev: KeyboardEvent) => {
            if (ev.key === "Escape") {
                cleanup();
            }
        };

        // Cleanup removes listeners and restores UI
        function cleanup() {
            img.classList.remove("mocblockRenderer-editing-outline");
            img.style.cursor = "";
            pinBtn.removeAttribute("disabled");
            polyBtn.removeAttribute("disabled");
            container.removeEventListener("click", clickHandler, true);
            window.removeEventListener("keydown", escHandler, true);
            svg.remove(); // remove SVG overlay
        }

        // Use capture so we see the click before other handlers; remove with cleanup
        container.addEventListener("click", clickHandler, true);
        window.addEventListener("keydown", escHandler, true);
    });
}

export function addPolylineButton(
    container: HTMLElement,
    img: HTMLImageElement,
    pinBtn: HTMLButtonElement,
    polyBtn: HTMLButtonElement,
    settings: MOCBlockSettings,
    app: any,
    source: string,
    el: HTMLElement,
    ctx: any,
    markerFilePath: string
) {
    polyBtn.addEventListener("click", () => {

        // Visual cues for editing: crosshair cursor and moc block outline.
        img.classList.add("mocblockRenderer-editing-outline");

        // disable buttons while waiting (prevents duplicate listeners)
        pinBtn.setAttribute("disabled", "true");
        pinBtn.setAttribute("cursor", "")
        polyBtn.setAttribute("disabled", "true");

    // Variables setup
        const svgNS = "http://www.w3.org/2000/svg";	// SVG namespace
        const points: [number, number][] = [];	// Array to hold points as [x%, y%]
        let polygon: SVGPolygonElement | null = null;	// Object to hold drawn polygon
        const rect = img.getBoundingClientRect();	// get image dimensions

    // Create SVG overlay exactly matching image dimensions
        const svg = document.createElementNS(svgNS, "svg");
        svg.classList.add("mocblockRenderer-overlay");
        container.appendChild(svg);

    // Click handler to add points
        const clickHandler = (evt: MouseEvent) => {
            const imgRect = img.getBoundingClientRect();
            const x = evt.clientX - imgRect.left;
            const y = evt.clientY - imgRect.top;

            // Constrain click events to image bounds
            if (
                evt.clientX < imgRect.left ||
                evt.clientX > imgRect.right ||
                evt.clientY < imgRect.top ||
                evt.clientY > imgRect.bottom
            ) {
                return;
            }
            
            // Store as percentages (allows scaling)
            const percentX = x / rect.width;
            const percentY = y / rect.height;
            points.push([percentX, percentY]);

            // Draw/update polygon
            if (!polygon) {
                polygon = document.createElementNS(svgNS, "polygon");
                polygon.classList.add("mocblockRenderer-polygon-preview");
                svg.appendChild(polygon);
            }
            polygon.setAttribute(
                "points",
                points.map(([px, py]) => `${px * rect.width},${py * rect.height}`).join(" ")
            );

            // Draw small dot at each point
            const dot = document.createElementNS(svgNS, "circle");
            dot.setAttribute("cx", (percentX * rect.width).toString());
            dot.setAttribute("cy", (percentY * rect.height).toString());
            dot.setAttribute("r", "2");
            dot.classList.add("mocblockRenderer-polygon-preview");
            svg.appendChild(dot);
        };


        // Escape cancels placement
        const escHandler = (ev: KeyboardEvent) => {
            if (ev.key === "Escape") {
                cleanup();
            }
        };


        // Cleanup removes listeners and restores UI
        function cleanup() {
            img.classList.remove("mocblockRenderer-editing-outline");
            pinBtn.removeAttribute("disabled");
            polyBtn.removeAttribute("disabled");
            img.removeEventListener("click", clickHandler, true);
            img.removeEventListener("contextmenu", rightClickHandler, true);
            window.removeEventListener("keydown", escHandler, true);
            svg.remove(); // remove SVG overlay
        }


        // Right-click handler to finish polyline
        const rightClickHandler = (evt: MouseEvent) => {
            evt.preventDefault();
            evt.stopPropagation();
            // img.removeEventListener("click", clickHandler);
            // img.removeEventListener("contextmenu", rightClickHandler);

            // Ensure polygon is properly closed
            if (polygon) {
                polygon.setAttribute(
                    "points",
                    points.map(([px, py]) => `${px * rect.width},${py * rect.height}`).join(" ")
                );
            }

            // Open modal
            const newPolylineModal = new NewPolylineModal(
                this.app,
                points,
                settings.styleNames,
                async (newMarker: PolylineMarker) => {
                    newMarker.type = "polyline";
                    newMarker.points = points; // normalized percentages, for scaling
                    await addMarkerToFile(this.app.vault, markerFilePath, newMarker);
                    await refreshMOCBlock(this.app, source, el, ctx);
                    this.app.workspace.trigger("markdown-code-block-processed");
                },
                cleanup // call cleanup on cancel
            );
            newPolylineModal.open();
        };

        img.addEventListener("click", clickHandler);
        img.addEventListener("contextmenu", rightClickHandler);
        window.addEventListener("keydown", escHandler, true);
    });
}