THIS PLUGIN IS IN BETA! It is my first plugin so take with a pinch of salt. Any bugs, please report it on the [git repository](https://github.com/NebulousNessie/Obsidian-MOCBlocks-Dev/issues), thank you!

This is a plugin for creating simple Maps of Content, with a background image, using new 'MOC Block' code blocks.

---
## How the Plugin Works

1. Click the ribbon icon.
2. Choose an image, and click 'insert'.
3. A 'moc block' code block is created, using the syntax below. This will render your chosen image into obsidian.
4. In editor mode, you can click one of two buttons:
	  - Add pin: clicking on the image now drops a pin on the image, and allows you to edit the pin attributes (label, link) within a popup.
	  - Add polyline: allows you to draw a polygon on the image, within which will be clickable. Polygon attributed are added in the popup.
5. Each marker (pin or polygon) has a marker style attributed to it. You can add, change, or delete marker styles in the plugin settings. NOTE: If a previously used marker style is deleted, any markers which used that style will revert to the default style (light green), until changed or another marker with the same name is added in settings again.

---
## The Syntax
````markdown
``` moc
image: Image1.png
moc_id: [AUTOMATICALLY GENERATED]
image_width: [Image Px width, AUTOMATICALLY GENERATED]
```
````

---

# Known issues

- For up-to-date issues, see the [Git repository](https://github.com/NebulousNessie/Obsidian-MOCBlocks)
- The [image converter](https://github.com/xryul/obsidian-image-converter) plugin breaks the MOC Block resizing feature.

---
# Inspiration

- This plugin is inspired in part by the excellent [leaflet](https://github.com/javalent/obsidian-leaflet) plugin, which allows a similar interface specific to maps. Check out that plugin to see if they have better features for your use case!

---
# Support

If you feel you would like to support my work (thank you!), please [buymeacoffee](https://buymeacoffee.com/nebulousnessie).
