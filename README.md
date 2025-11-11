# (re)Mix — 3D Scene Builder

**(re)Mix** is a browser-based 3D scene builder built with **Three.js**.
It lets you import a multi-part `.fbx` file, drag and drop individual meshes into a scene, adjust their position, rotation, and scale, then export everything as an `.stl` file — all directly in your web browser.


## 🌟 Feature Overview
### Import & library management
- Load multiple `.fbx` or `.stl` files at once and automatically extract every mesh into a reusable part library.
- Group meshes into sidebar categories by prefix (e.g. `Walls__Corner`) so large kits stay organized.
- Preview part names, drag them into the scene, or tap on touch devices to add them instantly.

### Scene assembly tools
- Place parts with live previews that respect your camera angle and ground plane.
- Toggle rotation between world origin and part center for quick orientation tweaks.
- Duplicate (Advanced Mode) or delete placed parts directly from the Scene Objects panel.
- Maintain a full undo/redo history so you can experiment without fear.

### Precision editing
- Switch to Advanced Mode for move/rotate/scale gizmos plus numeric inputs for exact transforms.
- Flip meshes across X/Y/Z (Advanced Mode), set custom grid size, and define translation and rotation snap increments.
- Optionally enable grid snapping to automatically align everything to a configurable tabletop grid (Advanced Mode for custom values).

### Export & sharing
- Export the entire layout as an `.stl` file sized for 3D printing or additional processing.
- Built-in safety checks warn if exports become too large for the browser to generate reliably.


## 🛠️ Usage Guide
1. **Start the app**  
   Run a simple static server (e.g. `python -m http.server`) inside the project folder and open [http://localhost:8000](http://localhost:8000) — or visit the hosted version at <https://shawn-makes-stuff.github.io/re-mix/>.
2. **Import your parts**  
   Click **Import Parts** and select one or more `.fbx` or `.stl` files. Meshes appear in the sidebar, organized by prefix.
3. **Build the scene**  
   Drag parts from the library (or tap on touch) to drop them into the workspace. Use the Scene Objects list to select, duplicate (Advanced Mode), or delete items.
4. **Adjust placement**  
   Use the bottom toolbar for quick 90° rotations, or enable **Advanced Mode** to access gizmos, numeric fields, flipping controls, and custom snapping values.
5. **Fine-tune alignment**
   Toggle grid snapping on whenever you want pieces locked to the tabletop grid (it's off by default). Adjust the grid size and snap distances from the Advanced panel whenever you need more precision.
6. **Review shortcuts**  
   Open the help overlay from the left toolbar for a full list of mouse, keyboard, and mode shortcuts.
7. **Export your layout**  
   When you're happy with the arrangement, click **Export STL** to download a printable mesh of the entire scene.


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
