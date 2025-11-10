import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://unpkg.com/three@0.165.0/examples/jsm/loaders/FBXLoader.js';
import { STLExporter } from 'https://unpkg.com/three@0.165.0/examples/jsm/exporters/STLExporter.js';

/* -------------------------------------------------------------------------- */
/* DOM REFS                                                                    */
/* -------------------------------------------------------------------------- */

const container = document.getElementById('viewer');
const sidebar = document.getElementById('sidebar');

const menuButton = document.getElementById('menuButton');
const undoButton = document.getElementById('undoButton');
const deleteButton = document.getElementById('deleteButton');
const helpButton = document.getElementById('helpButton');
const advancedModeButton = document.getElementById('advancedModeButton');

const bottomControls = document.getElementById('bottomControls');
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const gridSnapToggle = document.getElementById('gridSnapToggle');
const posXSlider = document.getElementById('posXSlider');
const posYSlider = document.getElementById('posYSlider');
const posZSlider = document.getElementById('posZSlider');
const rotYSlider = document.getElementById('rotYSlider');
const posXValue = document.getElementById('posXValue');
const posYValue = document.getElementById('posYValue');
const posZValue = document.getElementById('posZValue');
const rotYValue = document.getElementById('rotYValue');

/* -------------------------------------------------------------------------- */
/* STATE                                                                       */
/* -------------------------------------------------------------------------- */

const GRID_SIZE = 25; // millimeters per tile
const POSITION_RANGE = GRID_SIZE * 20; // +/- 20 tiles
const HEIGHT_RANGE = GRID_SIZE * 8;

let isAdvancedMode = false;
let gridSnapEnabled = true;

const partLibrary = []; // { name, geometry, category }
const placedPartsGroup = new THREE.Group();
const selectedMeshes = new Set();

let history = [];
let historyIndex = -1;
let nextInstanceId = 1;

posXSlider.min = posZSlider.min = (-POSITION_RANGE).toString();
posXSlider.max = posZSlider.max = POSITION_RANGE.toString();
posXSlider.step = posZSlider.step = '0.5';

posYSlider.min = '0';
posYSlider.max = HEIGHT_RANGE.toString();
posYSlider.step = '0.5';

rotYSlider.min = '0';
rotYSlider.max = '360';
rotYSlider.step = '0.5';
gridSnapToggle.checked = gridSnapEnabled;

const helpOverlay = document.getElementById('helpOverlay');
const helpCloseBtn = document.getElementById('helpCloseBtn');

const fileInput = document.getElementById('fileInput');
const importBtn = document.getElementById('importBtn');
const exportStlBtn = document.getElementById('exportStlBtn');
const fileNameLabel = document.getElementById('fileName');
const partsList = document.getElementById('partsList');

const scenePanel = document.getElementById('scenePanel');
const sceneResizeHandle = document.getElementById('sceneResizeHandle');
const sceneObjectsList = document.getElementById('sceneObjectsList');

const advancedPanel = document.getElementById('advancedPanel');
const advancedResizeHandle = document.getElementById('advancedResizeHandle');
const advancedSelectionLabel = document.getElementById('advancedSelectionLabel');

const posXInput = document.getElementById('posXInput');
const posYInput = document.getElementById('posYInput');
const posZInput = document.getElementById('posZInput');
const rotYInput = document.getElementById('rotYInput');
const scaleXInput = document.getElementById('scaleXInput');
const scaleYInput = document.getElementById('scaleYInput');
const scaleZInput = document.getElementById('scaleZInput');

const sidebarResizeHandle = document.getElementById('sidebarResizeHandle');

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const loader = new FBXLoader();
const exporter = new STLExporter();

/* -------------------------------------------------------------------------- */
/* SIDEBAR & HELP                                                              */
/* -------------------------------------------------------------------------- */

function toggleSidebar(force) {
  if (window.innerWidth > 820) {
    const open = force !== undefined ? force : sidebar.style.transform === 'translateX(100%)';
    sidebar.style.transform = open ? 'translateX(0)' : 'translateX(100%)';
  } else {
    const open = force !== undefined ? force : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', open);
  }
}

menuButton.addEventListener('click', () => toggleSidebar());

container.addEventListener('pointerdown', () => {
  if (window.innerWidth <= 820 && sidebar.classList.contains('open')) {
    toggleSidebar(false);
  }
});

function showHelp(show) {
  helpOverlay.classList.toggle('open', show);
}

helpButton.addEventListener('click', () => showHelp(true));
helpCloseBtn.addEventListener('click', () => showHelp(false));
helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) showHelp(false);
});

/* -------------------------------------------------------------------------- */
/* THREE.JS SETUP                                                              */
/* -------------------------------------------------------------------------- */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 8, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.target.set(0, 0, 0);

let pointerDownPos = null;

// Lights
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight1.position.set(5, 10, 5);
scene.add(dirLight1);

const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight2.position.set(-5, 8, -5);
scene.add(dirLight2);

// Floor
const gridWorldSize = GRID_SIZE * 40;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(gridWorldSize, gridWorldSize),
  new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.DoubleSide
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
scene.add(floor);

const gridHelper = new THREE.GridHelper(
  gridWorldSize,
  gridWorldSize / GRID_SIZE,
  0x3f3f3f,
  0x2b2b2b
);
const gridMaterials = Array.isArray(gridHelper.material)
  ? gridHelper.material
  : [gridHelper.material];
gridMaterials.forEach((mat) => {
  mat.transparent = true;
  mat.opacity = 0.4;
});
gridHelper.position.y = 0.002;
scene.add(gridHelper);

// Shared materials
const normalMaterial = new THREE.MeshStandardMaterial({
  color: 0xaaaaaa,
  roughness: 0.8,
  metalness: 0.2,
  side: THREE.DoubleSide
});

const selectedMaterial = new THREE.MeshStandardMaterial({
  color: 0xf4a259,
  roughness: 0.7,
  metalness: 0.1,
  side: THREE.DoubleSide
});

scene.add(placedPartsGroup);

/* -------------------------------------------------------------------------- */
/* SELECTION & UI                                                              */
/* -------------------------------------------------------------------------- */

function setMeshHighlight(mesh, isSelected) {
  mesh.material = isSelected ? selectedMaterial : normalMaterial;
}

function updateBottomControlsVisibility() {
  const hasSelection = selectedMeshes.size > 0;
  bottomControls.style.display = hasSelection ? 'flex' : 'none';
  if (!hasSelection) {
    posXValue.textContent = '--';
    posYValue.textContent = '--';
    posZValue.textContent = '--';
    rotYValue.textContent = '--';
  }

  // Update rows highlight in scene objects list
  if (sceneObjectsList) {
    [...sceneObjectsList.querySelectorAll('.scene-object-row')].forEach((row) => {
      const id = Number(row.dataset.instanceId);
      const mesh = findMeshByInstanceId(id);
      const isSelected = mesh && selectedMeshes.has(mesh);
      row.classList.toggle('selected', isSelected);
    });
  }

  syncMovementControlsFromSelection();
}

function centerMeshPivot(mesh) {
  if (mesh.userData.pivotCentered) return;
  const geom = mesh.geometry;
  geom.computeBoundingBox();
  const box = geom.boundingBox;
  if (!box) return;
  const center = new THREE.Vector3();
  box.getCenter(center);
  geom.translate(-center.x, -center.y, -center.z);
  mesh.position.add(center);
  mesh.userData.pivotCentered = true;
}

function clearSelection() {
  selectedMeshes.forEach((mesh) => setMeshHighlight(mesh, false));
  selectedMeshes.clear();
  updateBottomControlsVisibility();
  syncAdvancedPanelFromSelection();
}

function handleMeshClick(mesh, shiftKey) {
  if (!mesh || !mesh.isMesh) return;

  if (shiftKey) {
    if (selectedMeshes.has(mesh)) {
      selectedMeshes.delete(mesh);
      setMeshHighlight(mesh, false);
    } else {
      selectedMeshes.add(mesh);
      setMeshHighlight(mesh, true);
    }
  } else {
    const alreadyOnlySelected =
      selectedMeshes.size === 1 && selectedMeshes.has(mesh);
    if (!alreadyOnlySelected) {
      clearSelection();
      selectedMeshes.add(mesh);
      setMeshHighlight(mesh, true);
    }
  }

  updateBottomControlsVisibility();
  syncAdvancedPanelFromSelection();
}

function snapToGrid(value) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function applyGridSnap(mesh) {
  if (!mesh) return;
  mesh.position.x = snapToGrid(mesh.position.x);
  mesh.position.z = snapToGrid(mesh.position.z);
}

function formatMillimeters(value) {
  return `${value.toFixed(1)} mm`;
}

function normalizeDegrees(rad) {
  const deg = THREE.MathUtils.radToDeg(rad);
  return ((deg % 360) + 360) % 360;
}

function ensureSliderBounds(slider, value) {
  if (!slider) return;
  const padding = GRID_SIZE * 2;
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return;
  if (numericValue < Number(slider.min)) {
    slider.min = Math.floor(numericValue - padding).toString();
  }
  if (numericValue > Number(slider.max)) {
    slider.max = Math.ceil(numericValue + padding).toString();
  }
}

function updateMovementLabels(mesh) {
  if (!mesh) return;
  posXValue.textContent = formatMillimeters(mesh.position.x);
  posYValue.textContent = formatMillimeters(mesh.position.y);
  posZValue.textContent = formatMillimeters(mesh.position.z);
  rotYValue.textContent = `${normalizeDegrees(mesh.rotation.y).toFixed(1)}°`;
}

function syncMovementControlsFromSelection() {
  const hasSingle = selectedMeshes.size === 1;
  const sliders = [posXSlider, posYSlider, posZSlider, rotYSlider];
  sliders.forEach((slider) => {
    slider.disabled = !hasSingle;
  });

  if (!hasSingle) {
    posXValue.textContent = '--';
    posYValue.textContent = '--';
    posZValue.textContent = '--';
    rotYValue.textContent = '--';
    return;
  }

  const mesh = [...selectedMeshes][0];
  ensureSliderBounds(posXSlider, mesh.position.x);
  ensureSliderBounds(posYSlider, mesh.position.y);
  ensureSliderBounds(posZSlider, mesh.position.z);

  posXSlider.value = mesh.position.x.toFixed(1);
  posYSlider.value = mesh.position.y.toFixed(1);
  posZSlider.value = mesh.position.z.toFixed(1);

  const deg = normalizeDegrees(mesh.rotation.y);
  rotYSlider.value = deg.toFixed(1);

  updateMovementLabels(mesh);
}

function applyMovementFromSliders(commitHistory) {
  if (selectedMeshes.size !== 1) return;
  const mesh = [...selectedMeshes][0];

  const px = parseFloat(posXSlider.value);
  const py = parseFloat(posYSlider.value);
  const pz = parseFloat(posZSlider.value);
  const ry = parseFloat(rotYSlider.value);

  if (!Number.isNaN(px)) mesh.position.x = px;
  if (!Number.isNaN(py)) mesh.position.y = py;
  if (!Number.isNaN(pz)) mesh.position.z = pz;

  if (!Number.isNaN(ry)) {
    centerMeshPivot(mesh);
    mesh.rotation.y = THREE.MathUtils.degToRad(ry);
  }

  if (gridSnapEnabled) {
    applyGridSnap(mesh);
  }

  ensureSliderBounds(posXSlider, mesh.position.x);
  ensureSliderBounds(posYSlider, mesh.position.y);
  ensureSliderBounds(posZSlider, mesh.position.z);

  posXSlider.value = mesh.position.x.toFixed(1);
  posYSlider.value = mesh.position.y.toFixed(1);
  posZSlider.value = mesh.position.z.toFixed(1);
  rotYSlider.value = normalizeDegrees(mesh.rotation.y).toFixed(1);

  updateMovementLabels(mesh);
  updateSceneObjectsList();
  syncAdvancedPanelFromSelection();

  if (commitHistory) pushHistory();
}

const movementSliders = [posXSlider, posYSlider, posZSlider, rotYSlider];
movementSliders.forEach((slider) => {
  slider.addEventListener('input', () => applyMovementFromSliders(false));
  slider.addEventListener('change', () => applyMovementFromSliders(true));
});

gridSnapToggle.addEventListener('change', () => {
  gridSnapEnabled = gridSnapToggle.checked;
  if (!gridSnapEnabled) return;

  if (selectedMeshes.size > 0) {
    selectedMeshes.forEach((mesh) => {
      applyGridSnap(mesh);
    });
    syncMovementControlsFromSelection();
    syncAdvancedPanelFromSelection();
    updateSceneObjectsList();
    pushHistory();
  }
});

/* -------------------------------------------------------------------------- */
/* HISTORY                                                                     */
/* -------------------------------------------------------------------------- */

function serializeState() {
  const items = [];
  placedPartsGroup.children.forEach((child) => {
    if (child.isMesh && child.userData.partIndex != null) {
      items.push({
        partIndex: child.userData.partIndex,
        position: child.position.toArray(),
        rotation: [child.rotation.x, child.rotation.y, child.rotation.z],
        scale: child.scale.toArray(),
        rotationSteps: child.userData.rotationSteps ?? 0,
        pivotCentered: !!child.userData.pivotCentered,
        instanceId: child.userData.instanceId ?? null
      });
    }
  });
  return { items };
}

function clearPlacedParts() {
  placedPartsGroup.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
  });
  placedPartsGroup.clear();
  clearSelection();
}

function loadState(state) {
  clearPlacedParts();
  if (!state) {
    updateSceneObjectsList();
    return;
  }

  let maxInstanceId = nextInstanceId;

  state.items.forEach((item) => {
    const part = partLibrary[item.partIndex];
    if (!part) return;
    const geomClone = part.geometry.clone();
    const mesh = new THREE.Mesh(geomClone, normalMaterial);

    mesh.userData = {
      rotationSteps: item.rotationSteps,
      partIndex: item.partIndex,
      pivotCentered: item.pivotCentered,
      instanceId: item.instanceId ?? nextInstanceId++
    };

    if (mesh.userData.instanceId > maxInstanceId) {
      maxInstanceId = mesh.userData.instanceId;
    }

    // 🔹 Re-apply pivot centering when restoring from history
    if (item.pivotCentered) {
      // temporarily mark as not centered so centerMeshPivot actually runs
      mesh.userData.pivotCentered = false;
      centerMeshPivot(mesh);
    }

    mesh.position.fromArray(item.position);
    if (item.rotation) {
      mesh.rotation.set(item.rotation[0], item.rotation[1], item.rotation[2]);
    } else {
      mesh.rotation.set(0, item.rotationY || 0, 0);
    }
    if (item.scale) {
      mesh.scale.fromArray(item.scale);
    } else {
      mesh.scale.set(1, 1, 1);
    }

    mesh.castShadow = mesh.receiveShadow = true;
    placedPartsGroup.add(mesh);
  });

  nextInstanceId = Math.max(nextInstanceId, maxInstanceId + 1);

  clearSelection();
  updateSceneObjectsList();
}


function resetHistory() {
  history = [];
  historyIndex = -1;
  updateHistoryButtons();
}

function pushHistory() {
  const snapshot = serializeState();
  history = history.slice(0, historyIndex + 1);
  history.push(snapshot);
  historyIndex = history.length - 1;
  updateHistoryButtons();
}

function canUndo() { return historyIndex > 0; }
function canRedo() { return historyIndex >= 0 && historyIndex < history.length - 1; }

function undo() {
  if (!canUndo()) return;
  historyIndex--;
  loadState(history[historyIndex]);
  updateHistoryButtons();
}

function redo() {
  if (!canRedo()) return;
  historyIndex++;
  loadState(history[historyIndex]);
  updateHistoryButtons();
}

function updateHistoryButtons() {
  undoButton.disabled = !canUndo();
}

undoButton.addEventListener('click', undo);
deleteButton.addEventListener('click', () => deleteSelected());

/* -------------------------------------------------------------------------- */
/* FBX LOADING & PARTS LIBRARY                                                 */
/* -------------------------------------------------------------------------- */

importBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  fileNameLabel.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const arrayBuffer = ev.target.result;

    partLibrary.length = 0;
    clearPlacedParts();
    resetHistory();
    updatePartsListUI();
    updateSceneObjectsList();

    try {
      const root = loader.parse(arrayBuffer, '');
      extractPartsFromObject(root);
      disposeObject(root);
    } catch (err) {
      console.error(err);
      alert('Could not load FBX.');
      return;
    }

    updatePartsListUI();
    pushHistory(); // initial empty layout
    frameScene(true);
  };
  reader.readAsArrayBuffer(file);
});

function extractPartsFromObject(root) {
  root.updateMatrixWorld(true);
  partLibrary.length = 0;

  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;

    const geom = child.geometry.clone();
    geom.applyMatrix4(child.matrixWorld);
    if (!geom.attributes.normal) geom.computeVertexNormals();

    const rawName = child.name || '';
    let name = rawName;
    let category = null;

    // Naming convention: Category__Part
    const delim = '__';
    const idx = rawName.indexOf(delim);

    if (idx > 0 && idx < rawName.length - delim.length) {
      category = rawName.slice(0, idx);
      name = rawName.slice(idx + delim.length) || `Part ${partLibrary.length + 1}`;
    }

    if (!name) {
      name = `Part ${partLibrary.length + 1}`;
    }

    partLibrary.push({
      name,
      geometry: geom,
      category
    });
  });
}

function disposeObject(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    if (child.material?.map) child.material.map.dispose();
    child.material?.dispose();
  });
}

/* -------------------------------------------------------------------------- */
/* PARTS LIST UI & PREVIEWS                                                    */
/* -------------------------------------------------------------------------- */

function updatePartsListUI() {
  const headerRow = partsList.querySelector('.parts-header-row');
  partsList.innerHTML = '';
  if (headerRow) partsList.appendChild(headerRow);

  if (!partLibrary.length) {
    const empty = document.createElement('div');
    empty.style.opacity = '0.8';
    empty.style.fontSize = '13px';
    empty.style.marginTop = '4px';
    empty.textContent = 'No parts loaded.';
    partsList.appendChild(empty);
    return;
  }

  const createPartItem = (idx) => {
    const part = partLibrary[idx];
    const item = document.createElement('div');
    item.className = 'part-item';
    item.draggable = true;
    item.dataset.index = idx.toString();

    const canvas = document.createElement('canvas');
    canvas.className = 'part-preview';
    canvas.width = 80;
    canvas.height = 80;
    item.appendChild(canvas);

    const label = document.createElement('div');
    label.className = 'part-name';
    label.textContent = part.name;
    item.appendChild(label);

    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', idx.toString());
    });

    if (isTouch) {
      item.addEventListener('click', () => {
        const mesh = addPartInstance(idx);
        if (mesh) {
          clearSelection();
          selectedMeshes.add(mesh);
          setMeshHighlight(mesh, true);
          updateBottomControlsVisibility();
          syncAdvancedPanelFromSelection();
          pushHistory();
        }
      });
    }

    renderPartPreview(part.geometry, canvas);
    return item;
  };

  const hasCategories = partLibrary.some((p) => p.category !== null);

  // flat list if no categories
  if (!hasCategories) {
    partLibrary.forEach((_, idx) => {
      partsList.appendChild(createPartItem(idx));
    });
    return;
  }

  const categoryMap = new Map();
  const uncategorizedIndices = [];

  partLibrary.forEach((part, idx) => {
    if (part.category === null) {
      uncategorizedIndices.push(idx);
    } else {
      if (!categoryMap.has(part.category)) categoryMap.set(part.category, []);
      categoryMap.get(part.category).push(idx);
    }
  });

  // named categories
  for (const [categoryName, indices] of categoryMap.entries()) {
    const catWrapper = document.createElement('div');
    catWrapper.className = 'parts-category';

    const header = document.createElement('div');
    header.className = 'parts-category-header';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'parts-category-title';
    titleSpan.textContent = categoryName;

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'category-toggle';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-symbols-outlined';
    iconSpan.textContent = 'expand_less';
    toggleBtn.appendChild(iconSpan);

    header.appendChild(titleSpan);
    header.appendChild(toggleBtn);
    catWrapper.appendChild(header);

    const body = document.createElement('div');
    body.className = 'parts-category-body';
    catWrapper.appendChild(body);

    indices.forEach((idx) => {
      body.appendChild(createPartItem(idx));
    });

    const toggleCategory = () => {
      const collapsed = body.classList.toggle('collapsed');
      body.style.display = collapsed ? 'none' : 'block';
      iconSpan.textContent = collapsed ? 'expand_more' : 'expand_less';
    };

    header.addEventListener('click', (e) => {
      if (e.target === toggleBtn || toggleBtn.contains(e.target)) return;
      toggleCategory();
    });

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCategory();
    });

    partsList.appendChild(catWrapper);
  }

  // uncategorized
  if (uncategorizedIndices.length > 0) {
    const catWrapper = document.createElement('div');
    catWrapper.className = 'parts-category';

    const header = document.createElement('div');
    header.className = 'parts-category-header';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'parts-category-title';
    titleSpan.textContent = 'Uncategorized';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'category-toggle';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-symbols-outlined';
    iconSpan.textContent = 'expand_less';
    toggleBtn.appendChild(iconSpan);

    header.appendChild(titleSpan);
    header.appendChild(toggleBtn);
    catWrapper.appendChild(header);

    const body = document.createElement('div');
    body.className = 'parts-category-body';
    catWrapper.appendChild(body);

    uncategorizedIndices.forEach((idx) => {
      body.appendChild(createPartItem(idx));
    });

    const toggleCategory = () => {
      const collapsed = body.classList.toggle('collapsed');
      body.style.display = collapsed ? 'none' : 'block';
      iconSpan.textContent = collapsed ? 'expand_more' : 'expand_less';
    };

    header.addEventListener('click', (e) => {
      if (e.target === toggleBtn || toggleBtn.contains(e.target)) return;
      toggleCategory();
    });

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCategory();
    });

    partsList.appendChild(catWrapper);
  }
}

function renderPartPreview(geometry, canvas) {
  const w = canvas.width;
  const h = canvas.height;

  const previewRenderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  previewRenderer.setSize(w, h, false);
  previewRenderer.setPixelRatio(window.devicePixelRatio);
  previewRenderer.setClearColor(0x111111, 1);

  const sceneThumb = new THREE.Scene();
  const camThumb = new THREE.PerspectiveCamera(30, w / h, 0.01, 50);

  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(5, 10, 7);
  sceneThumb.add(light);
  sceneThumb.add(new THREE.AmbientLight(0xffffff, 0.4));

  const geomClone = geometry.clone();
  const posAttr = geomClone.getAttribute('position');
  const box = new THREE.Box3().setFromBufferAttribute(posAttr);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 1 / maxDim;
  geomClone.scale(scale, scale, scale);

  const mat = new THREE.MeshStandardMaterial({
    color: 0xaaaaaa,
    roughness: 0.8,
    metalness: 0.2
  });
  const mesh = new THREE.Mesh(geomClone, mat);

  const box2 = new THREE.Box3().setFromObject(mesh);
  const center2 = new THREE.Vector3();
  box2.getCenter(center2);
  mesh.position.sub(center2);

  sceneThumb.add(mesh);

  const fitDist = 2.0;
  camThumb.position.set(0, fitDist, fitDist * 1.2);
  camThumb.lookAt(0, 0, 0);

  previewRenderer.render(sceneThumb, camThumb);

  geomClone.dispose();
  mat.dispose();
  previewRenderer.dispose();
}

/* -------------------------------------------------------------------------- */
/* DRAG & DROP / ADD INSTANCES                                                 */
/* -------------------------------------------------------------------------- */

renderer.domElement.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

renderer.domElement.addEventListener('drop', (e) => {
  e.preventDefault();
  const index = parseInt(e.dataTransfer.getData('text/plain'), 10);
  if (Number.isNaN(index)) return;
  const mesh = addPartInstance(index);
  if (!mesh) return;
  clearSelection();
  selectedMeshes.add(mesh);
  setMeshHighlight(mesh, true);
  updateBottomControlsVisibility();
  syncAdvancedPanelFromSelection();
  pushHistory();
});

function addPartInstance(partIndex) {
  const part = partLibrary[partIndex];
  if (!part) return null;

  const isFirst = placedPartsGroup.children.length === 0;

  const geomClone = part.geometry.clone();
  const mesh = new THREE.Mesh(geomClone, normalMaterial);
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);

  mesh.userData = {
    rotationSteps: 0,
    partIndex,
    pivotCentered: false,
    instanceId: nextInstanceId++
  };

  mesh.castShadow = mesh.receiveShadow = true;
  placedPartsGroup.add(mesh);

  if (gridSnapEnabled) {
    applyGridSnap(mesh);
  }

  if (isFirst) {
    frameScene(false);
  }

  updateSceneObjectsList();
  return mesh;
}

/* -------------------------------------------------------------------------- */
/* SCENE OBJECTS LIST (ADVANCED MODE)                                          */
/* -------------------------------------------------------------------------- */

function findMeshByInstanceId(id) {
  if (!id) return null;
  return placedPartsGroup.children.find(
    (child) => child.isMesh && child.userData.instanceId === id
  ) || null;
}

function updateSceneObjectsList() {
  if (!sceneObjectsList) return;
  sceneObjectsList.innerHTML = '';

  const meshes = placedPartsGroup.children.filter(
    (child) => child.isMesh && child.userData.partIndex != null
  );

  if (!meshes.length) {
    const empty = document.createElement('div');
    empty.style.opacity = '0.7';
    empty.style.fontSize = '11px';
    empty.textContent = 'No objects in scene.';
    sceneObjectsList.appendChild(empty);
    return;
  }

  meshes.forEach((mesh, idx) => {
    const row = document.createElement('div');
    row.className = 'scene-object-row';
    row.dataset.instanceId = mesh.userData.instanceId;

    const partName = partLibrary[mesh.userData.partIndex]?.name || 'Part';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'scene-object-name';
    nameSpan.textContent = `${idx + 1}. ${partName}`;
    row.appendChild(nameSpan);

    const actions = document.createElement('div');
    actions.className = 'scene-object-actions';

    const dupBtn = document.createElement('button');
    dupBtn.className = 'scene-object-btn';
    dupBtn.dataset.action = 'duplicate';
    dupBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>';

    const delBtn = document.createElement('button');
    delBtn.className = 'scene-object-btn';
    delBtn.dataset.action = 'delete';
    delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';

    actions.appendChild(dupBtn);
    actions.appendChild(delBtn);
    row.appendChild(actions);

    const isSelected = selectedMeshes.has(mesh);
    if (isSelected) row.classList.add('selected');

    sceneObjectsList.appendChild(row);
  });
}

// Delegate clicks for scene objects list
sceneObjectsList.addEventListener('click', (e) => {
  const row = e.target.closest('.scene-object-row');
  if (!row) return;

  const instanceId = Number(row.dataset.instanceId);
  const mesh = findMeshByInstanceId(instanceId);
  if (!mesh) return;

  const actionBtn = e.target.closest('.scene-object-btn');
  if (actionBtn) {
    const action = actionBtn.dataset.action;
    if (action === 'delete') {
      deleteMeshInstance(mesh);
    } else if (action === 'duplicate') {
      duplicateMeshInstance(mesh);
    }
    return;
  }

  // Row click: select this mesh
  const alreadyOnlySelected =
    selectedMeshes.size === 1 && selectedMeshes.has(mesh);
  if (!alreadyOnlySelected) {
    clearSelection();
    selectedMeshes.add(mesh);
    setMeshHighlight(mesh, true);
    updateBottomControlsVisibility();
    syncAdvancedPanelFromSelection();
  }
});

function deleteMeshInstance(mesh) {
  if (!mesh || !mesh.isMesh) return;
  const wasSelected = selectedMeshes.has(mesh);
  if (wasSelected) selectedMeshes.delete(mesh);

  mesh.geometry?.dispose();
  placedPartsGroup.remove(mesh);

  if (wasSelected) {
    updateBottomControlsVisibility();
    syncAdvancedPanelFromSelection();
  }

  updateSceneObjectsList();
  pushHistory();
}

function duplicateMeshInstance(mesh) {
  if (!mesh || !mesh.isMesh) return;

  const geomClone = mesh.geometry.clone();
  const clone = new THREE.Mesh(geomClone, normalMaterial);
  clone.position.copy(mesh.position);
  clone.rotation.copy(mesh.rotation);
  clone.scale.copy(mesh.scale);

  clone.userData = {
    ...mesh.userData,
    instanceId: nextInstanceId++
  };

  clone.castShadow = clone.receiveShadow = true;
  placedPartsGroup.add(clone);

  clearSelection();
  selectedMeshes.add(clone);
  setMeshHighlight(clone, true);

  updateSceneObjectsList();
  updateBottomControlsVisibility();
  syncAdvancedPanelFromSelection();
  pushHistory();
}

/* -------------------------------------------------------------------------- */
/* RAYCAST SELECTION                                                           */
/* -------------------------------------------------------------------------- */

// --- Selection click in scene ---

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onCanvasPointerDown(event) {
  // Track start position so we can distinguish click vs drag
  pointerDownPos = { x: event.clientX, y: event.clientY };
}

function onCanvasPointerUp(event) {
  if (!pointerDownPos) return;

  const dx = event.clientX - pointerDownPos.x;
  const dy = event.clientY - pointerDownPos.y;
  pointerDownPos = null;

  // Treat as a "click" only if the pointer didn't move much
  const clickThresholdSq = 4 * 4; // 4px radius
  if (dx * dx + dy * dy > clickThresholdSq) return;

  // Left button only
  if (event.button !== 0) return;

  // Normal selection raycast
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(
    placedPartsGroup.children,
    true
  );

  if (intersects.length > 0) {
    const mesh = intersects[0].object;
    handleMeshClick(mesh, event.shiftKey);
  }
}

renderer.domElement.addEventListener('pointerdown', onCanvasPointerDown);
renderer.domElement.addEventListener('pointerup', onCanvasPointerUp);


/* -------------------------------------------------------------------------- */
/* BASIC ROTATION / DELETE                                                     */
/* -------------------------------------------------------------------------- */

function adjustSelectionRotation(deltaDegrees, commitHistory = true) {
  if (selectedMeshes.size === 0) return;

  if (selectedMeshes.size === 1) {
    const current = parseFloat(rotYSlider.value) || 0;
    rotYSlider.value = (current + deltaDegrees).toFixed(1);
    applyMovementFromSliders(commitHistory);
    return;
  }

  const deltaRad = THREE.MathUtils.degToRad(deltaDegrees);
  selectedMeshes.forEach((mesh) => {
    centerMeshPivot(mesh);
    mesh.rotation.y += deltaRad;
    if (gridSnapEnabled) {
      applyGridSnap(mesh);
    }
  });

  updateSceneObjectsList();
  if (commitHistory) pushHistory();
}

rotateLeftBtn.addEventListener('click', () => {
  adjustSelectionRotation(-90, true);
});

rotateRightBtn.addEventListener('click', () => {
  adjustSelectionRotation(90, true);
});

function deleteSelected() {
  if (selectedMeshes.size === 0) return;

  const toDelete = Array.from(selectedMeshes);
  clearSelection();
  toDelete.forEach((mesh) => {
    mesh.geometry?.dispose();
    placedPartsGroup.remove(mesh);
  });
  updateSceneObjectsList();
  pushHistory();
}

/* -------------------------------------------------------------------------- */
/* ADVANCED MODE & PANEL                                                       */
/* -------------------------------------------------------------------------- */

function setAdvancedMode(on) {
  isAdvancedMode = on;
  advancedModeButton.classList.toggle('active', on);

  // Show/hide advanced panels
  scenePanel.style.display = on ? 'block' : 'none';
  advancedPanel.style.display = on ? 'block' : 'none';

  // Hide trash icon in advanced mode (we have per-object delete there)
  deleteButton.style.display = on ? 'none' : '';

  updateBottomControlsVisibility();
  syncAdvancedPanelFromSelection();
}

advancedModeButton.addEventListener('click', () => {
  setAdvancedMode(!isAdvancedMode);
});

function syncAdvancedPanelFromSelection() {
  const hasSingle = selectedMeshes.size === 1;
  const inputs = [
    posXInput, posYInput, posZInput,
    rotYInput,
    scaleXInput, scaleYInput, scaleZInput
  ];

  inputs.forEach((el) => { el.disabled = !hasSingle || !isAdvancedMode; });

  if (!isAdvancedMode) {
    advancedSelectionLabel.textContent = 'Advanced mode off';
    return;
  }

  if (!hasSingle) {
    advancedSelectionLabel.textContent = selectedMeshes.size > 1
      ? `${selectedMeshes.size} parts selected`
      : 'No part selected';
    return;
  }

  const mesh = [...selectedMeshes][0];
  advancedSelectionLabel.textContent =
    partLibrary[mesh.userData.partIndex]?.name || 'Part';

  posXInput.value = mesh.position.x.toFixed(3);
  posYInput.value = mesh.position.y.toFixed(3);
  posZInput.value = mesh.position.z.toFixed(3);

  const rotYDeg = THREE.MathUtils.radToDeg(mesh.rotation.y);
  rotYInput.value = rotYDeg.toFixed(1);

  scaleXInput.value = mesh.scale.x.toFixed(3);
  scaleYInput.value = mesh.scale.y.toFixed(3);
  scaleZInput.value = mesh.scale.z.toFixed(3);
}

function applyAdvancedInputs() {
  if (!isAdvancedMode || selectedMeshes.size !== 1) return;

  const mesh = [...selectedMeshes][0];

  const px = parseFloat(posXInput.value);
  const py = parseFloat(posYInput.value);
  const pz = parseFloat(posZInput.value);
  const ryDeg = parseFloat(rotYInput.value);
  const sx = parseFloat(scaleXInput.value);
  const sy = parseFloat(scaleYInput.value);
  const sz = parseFloat(scaleZInput.value);

  if (!Number.isNaN(px)) mesh.position.x = px;
  if (!Number.isNaN(py)) mesh.position.y = py;
  if (!Number.isNaN(pz)) mesh.position.z = pz;

  if (!Number.isNaN(ryDeg)) mesh.rotation.y = THREE.MathUtils.degToRad(ryDeg);

  if (!Number.isNaN(sx)) mesh.scale.x = sx;
  if (!Number.isNaN(sy)) mesh.scale.y = sy;
  if (!Number.isNaN(sz)) mesh.scale.z = sz;

  if (gridSnapEnabled) {
    applyGridSnap(mesh);
  }

  updateSceneObjectsList();
  syncMovementControlsFromSelection();
  pushHistory();
}

[
  posXInput, posYInput, posZInput,
  rotYInput,
  scaleXInput, scaleYInput, scaleZInput
].forEach((input) => {
  input.addEventListener('change', applyAdvancedInputs);
});

/* -------------------------------------------------------------------------- */
/* KEYBOARD SHORTCUTS                                                          */
/* -------------------------------------------------------------------------- */

window.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;

  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      undo();
      return;
    }
    if (e.key === 'y' || e.key === 'Y') {
      e.preventDefault();
      redo();
      return;
    }
  }

  if (e.key === 'q' || e.key === 'Q') {
    adjustSelectionRotation(e.shiftKey ? -15 : -90, true);
  } else if (e.key === 'e' || e.key === 'E') {
    adjustSelectionRotation(e.shiftKey ? 15 : 90, true);
  } else if (e.key === 'h' || e.key === 'H' || e.code === 'Home') {
    frameScene(false);
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelected();
  }
});

/* -------------------------------------------------------------------------- */
/* VIEW FRAMING                                                                */
/* -------------------------------------------------------------------------- */

function frameScene() {
  const box = new THREE.Box3();
  let hasContent = false;

  if (placedPartsGroup.children.length > 0) {
    box.expandByObject(placedPartsGroup);
    hasContent = true;
  }

  box.expandByObject(floor);
  hasContent = true;

  if (!hasContent) return;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const distance = (maxDim * 0.5) / Math.tan(halfFov) * 1.4;

  const dir = new THREE.Vector3(0.5, 0.7, 0.5).normalize();
  const newPos = center.clone().addScaledVector(dir, distance);

  camera.position.copy(newPos);
  controls.target.copy(center);

  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  controls.update();
}

/* -------------------------------------------------------------------------- */
/* STL EXPORT                                                                  */
/* -------------------------------------------------------------------------- */

// --- STL export ---
exportStlBtn.addEventListener('click', () => {
  if (placedPartsGroup.children.length === 0) {
    alert('No parts placed to export.');
    return;
  }

  // Clone the whole layout and rotate it 90° around X for export
  const exportGroup = placedPartsGroup.clone(true);
  exportGroup.rotation.x = Math.PI / 2; // 90° around X
  exportGroup.updateMatrixWorld(true);

  const stlString = exporter.parse(exportGroup);

  const blob = new Blob([stlString], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'dungeon_tile.stl';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
});


/* -------------------------------------------------------------------------- */
/* PANEL RESIZERS                                                              */
/* -------------------------------------------------------------------------- */

// Sidebar width (horizontal) resize
let isResizingSidebar = false;
let sidebarStartX = 0;
let sidebarStartWidth = 0;

sidebarResizeHandle.addEventListener('mousedown', (e) => {
  if (window.innerWidth <= 820) return; // avoid on mobile
  isResizingSidebar = true;
  sidebarStartX = e.clientX;
  sidebarStartWidth = sidebar.offsetWidth;
  document.body.style.cursor = 'col-resize';
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!isResizingSidebar) return;
  const dx = e.clientX - sidebarStartX;
  let newWidth = sidebarStartWidth - dx;
  const min = 150; // pretty small
  const max = 600;
  newWidth = Math.max(min, Math.min(max, newWidth));
  sidebar.style.width = `${newWidth}px`;
});

window.addEventListener('mouseup', () => {
  if (!isResizingSidebar) return;
  isResizingSidebar = false;
  document.body.style.cursor = '';
});

// Scene panel height (vertical) resize
let isResizingScene = false;
let sceneStartY = 0;
let sceneStartHeight = 0;

sceneResizeHandle.addEventListener('mousedown', (e) => {
  isResizingScene = true;
  sceneStartY = e.clientY;
  sceneStartHeight = scenePanel.offsetHeight;
  document.body.style.cursor = 'row-resize';
  e.preventDefault();
});


// Advanced panel height (vertical) resize
let isResizingAdvanced = false;
let advancedStartY = 0;
let advancedStartHeight = 0;

advancedResizeHandle.addEventListener('mousedown', (e) => {
  isResizingAdvanced = true;
  advancedStartY = e.clientY;
  advancedStartHeight = advancedPanel.offsetHeight;
  document.body.style.cursor = 'row-resize';
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (isResizingScene) {
    const dy = e.clientY - sceneStartY;
    let newHeight = sceneStartHeight - dy;
    const min = 50;
    const max = Math.max(50, window.innerHeight - 150); // leave some room
    newHeight = Math.max(min, Math.min(max, newHeight));
    scenePanel.style.height = `${newHeight}px`;
    scenePanel.style.flex = '0 0 auto';
  } else if (isResizingAdvanced) {
    const dy = e.clientY - advancedStartY;
    let newHeight = advancedStartHeight - dy;
    const min = 50;
    const max = Math.max(50, window.innerHeight - 150);
    newHeight = Math.max(min, Math.min(max, newHeight));
    advancedPanel.style.height = `${newHeight}px`;
    advancedPanel.style.flex = '0 0 auto';
  }
});

window.addEventListener('mouseup', () => {
  if (!isResizingScene && !isResizingAdvanced) return;
  isResizingScene = false;
  isResizingAdvanced = false;
  document.body.style.cursor = '';
});

/* -------------------------------------------------------------------------- */
/* RENDER LOOP & RESIZE                                                        */
/* -------------------------------------------------------------------------- */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

updateHistoryButtons();
updateBottomControlsVisibility();
updateSceneObjectsList();
setAdvancedMode(false); // start in basic mode
