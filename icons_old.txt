import {
    faMapMarkerAlt,
    faFlagCheckered,
    faPlay,
    faStickyNote,
    faArrowRight,
    faCircle,
    faStar,
    faHome,
    faAnchor,
    faCompass,
} from "@fortawesome/free-solid-svg-icons";

import { icon, library } from "@fortawesome/fontawesome-svg-core";
library.add(
    faMapMarkerAlt,
    faFlagCheckered,
    faPlay,
    faStickyNote,
    faArrowRight,
    faCircle,
    faStar,
    faHome,
    faAnchor,
    faCompass
);


export const AVAILABLE_ICONS = [
	"faMapMarkerAlt",
	"faFlagCheckered",
	"faPlay",
	"faStickyNote",
	"faArrowRight",
	"faCircle",
	"faStar",
	"faHome",
	"faAnchor",
	"faCompass",
];


// Map icon name to its SVG markup
const ICON_SVGS: Record<string, string> = {
    faMapMarkerAlt: icon(faMapMarkerAlt).html[0],
    faFlagCheckered: icon(faFlagCheckered).html[0],
    faPlay: icon(faPlay).html[0],
    faStickyNote: icon(faStickyNote).html[0],
    faArrowRight: icon(faArrowRight).html[0],
    faCircle: icon(faCircle).html[0],
    faStar: icon(faStar).html[0],
    faHome: icon(faHome).html[0],
    faAnchor: icon(faAnchor).html[0],
    faCompass: icon(faCompass).html[0],
};

export function getIconSVG(iconName: string): string | null {
    return ICON_SVGS[iconName] ?? null;
}
