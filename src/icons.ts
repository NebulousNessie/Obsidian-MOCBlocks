import { getIcon } from "obsidian";

// A curated list of Obsidian built-in icon ids to present to users.
export const AVAILABLE_ICONS = [
    "pin",
    "map-pin",
    "flag-triangle-right",
    "brush",
    "brackets",
    "brackets-curly",
    "circle",
    "star",
    "home",
    "pen",
    "anchor",
    "test-tube",
    "puzzle",
];

export function getIconSVG(iconName: string): string | null {
    try {
        const el = getIcon(iconName);
        if (el && el.outerHTML) return el.outerHTML;
    } catch (e) {
        console.warn("getIconSVG failed for", iconName, e);
    }
    return null;
}

export function getStyledIconSVG(
    iconName: string,
    opts?: {
        width?: number | string;
        height?: number | string;
        fill?: string;
        stroke?: string;
        opacity?: string | number;
        strokeWidth?: string | number;
    }
): string | null {
    try {
        const raw = getIconSVG(iconName);
        if (!raw) return null;
        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, "image/svg+xml");
        const svg = doc.documentElement as unknown as SVGSVGElement | null;
        if (!svg) return null;

        if (opts?.width !== undefined) svg.setAttribute("width", String(opts.width));
        if (opts?.height !== undefined) svg.setAttribute("height", String(opts.height));
        if (opts?.strokeWidth !== undefined) svg.setAttribute("stroke-width", String(opts.strokeWidth));

        const fill = opts?.fill;
        const stroke = opts?.stroke;
        const opacity = opts?.opacity;

        doc.querySelectorAll("path, circle, rect, polygon, line, polyline").forEach((node: Element) => {
            if (fill !== undefined) node.setAttribute("fill", String(fill));
            if (stroke !== undefined) node.setAttribute("stroke", String(stroke));
            if (opacity !== undefined) node.setAttribute("opacity", String(opacity));
        });

        return svg.outerHTML;
    } catch (e) {
        return null;
    }
}

export function getIconIds(): string[] {
    return AVAILABLE_ICONS.slice();
}