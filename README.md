# (re)Mix — 3D Scene Builder

**(re)Mix** is a browser-based 3D scene builder built with **Three.js**.  
It lets you import a multi-part `.fbx` file, drag and drop individual meshes into a scene, adjust their position, rotation, and scale, then export everything as an `.stl` file — all directly in your web browser.


## 🚀 Features
- Import `.fbx` files with multiple meshes.
- Drag and drop parts to build your scene.
- Click or Shift+Click to select parts.
- Rotate in 90° steps or around object center.
- Full move, rotate, and scale tools in Advanced Mode.
- Undo/Redo history for all changes.
- Export the entire layout as `.stl` for 3D printing.


## 🧱 FBX Setup
Use naming conventions like:
```
Group__PartName
```
Example:
```
Walls__Corner
Floors__Tile
Props__Torch
```
- `Group` becomes a category in the sidebar.
- `PartName` is shown as the mesh name.
- Unnamed parts go to *Uncategorized*.

Export from Blender or Nomad Sculpt with object names set like above.


## 🕹️ Controls

| Action | Key / Mouse |
|--------|--------------|
| Rotate Camera | LMB Drag |
| Pan | RMB Drag |
| Zoom | Mouse Wheel |
| Select | Click |
| Multi-Select | Shift + Click |
| Delete | Delete / Backspace |
| Undo / Redo | Ctrl+Z / Ctrl+Y |
| Recenter View | H or Home |

**Basic Mode**
| Function | Shortcut |
|-----------|-----------|
| Rotate 90° | Q / E |
| Rotate Around Center | Shift+Q / Shift+E |

**Advanced Mode**
| Function | Shortcut |
|-----------|-----------|
| Move | G |
| Rotate | R |
| Scale | S |


## ⚙️ Setup
1. Clone or download the repo.
2. Run a local server (example using Python):
   ```bash
   python -m http.server
   ```
3. Open [http://localhost:8000](http://localhost:8000)
4. Click **Import Parts** and load your `.fbx` file.

Or just use the github pages version :)
https://shawn-makes-stuff.github.io/re-mix/

## 📄 License
MIT License — free to use, modify, and share.
