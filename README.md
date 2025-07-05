# Obsidian-MOCBlocks
A plugin for obsidian which adds 'MOC Blocks': simple code blocks to add clickable links to images in a note.

---
# Usage
- A MOC Block (Map of Content code Block) is a code block which displays an image which can have clickable markers added.

## Adding a MOC Block
- To use the plugin, write out a code block (see syntax below) which references the image you want to use, and a unique ID. (note: this ID is for the marker data, and doesn't store the image data at all.)
- The MOC Block should render your image.
- In editor mode, you can right click on the image to open up the 'New Marker' window. You must include a linked note, and a select a marker type from the dropdown.
- Marker types are globally defined in the plugin settings. To add more, navigate to the plugin settings.
  - Note: If you delete a marker type, wherever you have used it will default to the default marker type (orange map pin).
 
## Behind the Scenes
- The way the MOC Block plugin works is by reading the MOC Block JSON (the syntax you put in your note), and fetching the marker data from the linked data note. 

## Syntax
````markdown
```moc
{
"moc_id": "UniqueID1234",
"image": "Image1.png"
}
```
````
Note: this is the minimum syntax. Every character here is <ins>**required**</ins>, just substitute in your note and unique moc ID.

### Functions
- moc_id: the unique ID which links to the marker data file in your vault.
- image: the image (already saved somewhere in your vault) to display in the MOC Block.
---
# Bugs/ Feature Requests
- If you have found a bug, or have any feature requests please raise the issue in the 'Issues' section of this Git Repo.

## In the pipeline
- Remove the requirement for manually adding a MOC Block code block, streamlining additions. (Using a ribbon icon and/or commands and/or hotkeys).
- Make MOC Block ID generation automatic (so a MOCBlock ID doesn't have to be made up).
- Hide marker ID files in an obsidian-invisible folder. Persists on plugin removal.
- Allow for marker type resizing.
- Allow for polyline and/or shape drawing for links.
- Make MOC Block marker links create normal obsidian backlinks, to allow connections to be viewed in graph view or backlinks tab.
- Add editor tools in MOC Blocks, like zoom level and multi-select.
- Add drag-and drop into empty mocblock of image to display.

---
# Support
If you feel you would like to support my work (thank you!), please head over to my buymeacoffee page: https://buymeacoffee.com/nebulousnessie
