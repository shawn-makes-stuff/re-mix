import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://unpkg.com/three@0.165.0/examples/jsm/loaders/FBXLoader.js';
import { STLLoader } from 'https://unpkg.com/three@0.165.0/examples/jsm/loaders/STLLoader.js';
import { TransformControls } from 'https://unpkg.com/three@0.165.0/examples/jsm/controls/TransformControls.js';

/* -------------------------------------------------------------------------- */
/* DOM REFS                                                                    */
/* -------------------------------------------------------------------------- */

const container = document.getElementById('viewer');
const sidebar = document.getElementById('sidebar');

const menuButton = document.getElementById('menuButton');
const undoButton = document.getElementById('undoButton');
const helpButton = document.getElementById('helpButton');
const advancedModeButton = document.getElementById('advancedModeButton');

const bottomControls = document.getElementById('bottomControls');
const basicControls = document.getElementById('basicControls');
const advancedControls = document.getElementById('advancedControls');
const gridControls = document.getElementById('gridControls');
const gridSnapBtn = document.getElementById('gridSnapBtn');
const gridSnapIcon = gridSnapBtn
  ? gridSnapBtn.querySelector('.material-symbols-outlined')
  : null;

const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const rotationModeBtn = document.getElementById('rotationModeBtn');
const rotationModeIcon = document.getElementById('rotationModeIcon');

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
const rotXInput = document.getElementById('rotXInput');
const rotYInput = document.getElementById('rotYInput');
const rotZInput = document.getElementById('rotZInput');
const scaleXInput = document.getElementById('scaleXInput');
const scaleYInput = document.getElementById('scaleYInput');
const scaleZInput = document.getElementById('scaleZInput');
const flipXBtn = document.getElementById('flipXBtn');
const flipYBtn = document.getElementById('flipYBtn');
const flipZBtn = document.getElementById('flipZBtn');

const snapCellSizeInput = document.getElementById('snapCellSizeInput');
const snapTranslateInput = document.getElementById('snapTranslateInput');
const snapRotateInput = document.getElementById('snapRotateInput');

const moveModeBtn = document.getElementById('moveModeBtn');
const rotateModeBtn = document.getElementById('rotateModeBtn');
const scaleModeBtn = document.getElementById('scaleModeBtn');
const measureModeBtn = document.getElementById('measureModeBtn');
const measurementReadout = document.getElementById('measurementReadout');
const flipButtons = [
  { btn: flipXBtn, axis: 'x' },
  { btn: flipYBtn, axis: 'y' },
  { btn: flipZBtn, axis: 'z' }
].filter(({ btn }) => !!btn);

flipButtons.forEach(({ btn }) => {
  btn.setAttribute('aria-pressed', 'false');
});

if (measureModeBtn) {
  measureModeBtn.setAttribute('aria-pressed', 'false');
}

const sidebarResizeHandle = document.getElementById('sidebarResizeHandle');

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

/* -------------------------------------------------------------------------- */
/* STATE                                                                       */
/* -------------------------------------------------------------------------- */

let rotateAroundWorld = true;
let isAdvancedMode = false;
let isMeasureMode = false;
let lastTransformMode = 'translate';

const DEFAULT_GRID_CELL_SIZE = 25; // millimeters per tile
const BASE_GRID_DIVISIONS = 40;
const GRID_WORLD_SIZE = DEFAULT_GRID_CELL_SIZE * BASE_GRID_DIVISIONS; // generous play area
let gridSnapEnabled = false;
let advancedGridSnapEnabled = false;
let gridCellSize = DEFAULT_GRID_CELL_SIZE;
let translationSnapValue = DEFAULT_GRID_CELL_SIZE;
let lastValidTranslationSnap = DEFAULT_GRID_CELL_SIZE;

if (snapCellSizeInput) {
  snapCellSizeInput.value = gridCellSize.toString();
}

if (snapTranslateInput) {
  snapTranslateInput.value = translationSnapValue.toString();
}

if (snapCellSizeInput) {
  snapCellSizeInput.addEventListener('change', () => {
    const value = parseFloat(snapCellSizeInput.value);
    if (!Number.isNaN(value) && value > 0) {
      updateGridCellSize(value);
    } else {
      snapCellSizeInput.value = gridCellSize.toString();
    }
  });
}

const partLibrary = []; // { name, geometry, category }
const placedPartsGroup = new THREE.Group();
const selectedMeshes = new Set();
const selectionTransformAnchor = new THREE.Object3D();
selectionTransformAnchor.visible = false;

const selectionBounds = new THREE.Box3();
const selectionTempBounds = new THREE.Box3();
const selectionCenter = new THREE.Vector3();
const multiSelectionTempMatrix = new THREE.Matrix4();
const multiSelectionTempMatrix2 = new THREE.Matrix4();
const multiSelectionTempMatrix3 = new THREE.Matrix4();
const multiSelectionTempMatrix4 = new THREE.Matrix4();
const multiSelectionTempPosition = new THREE.Vector3();
const multiSelectionTempQuaternion = new THREE.Quaternion();
const multiSelectionTempScale = new THREE.Vector3();

let multiSelectionTransformState = null;

let history = [];
let historyIndex = -1;
let nextInstanceId = 1;

const instanceIdLookup = new Map();
const sceneRowByInstanceId = new Map();

const loader = new FBXLoader();
const stlLoader = new STLLoader();

const dragPreviewMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  opacity: 0.35,
  transparent: true,
  depthTest: false,
  depthWrite: false,
  wireframe: true
});
const previewRaycaster = new THREE.Raycaster();
const previewPointer = new THREE.Vector2();
const dropPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dropIntersection = new THREE.Vector3();
const pendingDropPosition = new THREE.Vector3();
let hasPendingDropPosition = false;
let dragPreviewMesh = null;
let dragPreviewPartIndex = null;

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

// Transform controls
const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls);
scene.add(selectionTransformAnchor);
let isTransforming = false;
let hadTransformDrag = false;   // 👈 did this pointer interaction actually drag the gizmo?
let pointerDownPos = null;  

transformControls.addEventListener('dragging-changed', (e) => {
  controls.enabled = !e.value;
  if (e.value) {
    isTransforming = true;
    hadTransformDrag = true;   // gizmo drag actually started
    captureMultiSelectionTransformState();
  } else {
    if (isTransforming) {
      if (gridSnapEnabled) {
        applyGridSnapToSelection();
      }
      if (selectedMeshes.size > 1) {
        updateSelectionTransformAnchor({ resetOrientation: false });
      }
      syncAdvancedPanelFromSelection();
      updateSceneObjectsList();
      pushHistory();           // commit final transform once per drag
    }
    isTransforming = false;
    resetMultiSelectionTransformState();
  }
});

transformControls.addEventListener('objectChange', () => {
  applyMultiSelectionTransform();
  if (isAdvancedMode) syncAdvancedPanelFromSelection();
});

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

// Floor & grid
const floorSize = GRID_WORLD_SIZE;
const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a,
  roughness: 1.0,
  metalness: 0.0,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.08,
  depthWrite: false
});
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(floorSize, floorSize),
  floorMaterial
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
scene.add(floor);

const gridHelper = new THREE.GridHelper(
  GRID_WORLD_SIZE,
  BASE_GRID_DIVISIONS,
  0x444444,
  0x242424
);
const gridMaterials = Array.isArray(gridHelper.material)
  ? gridHelper.material
  : [gridHelper.material];
gridMaterials.forEach((mat) => {
  mat.transparent = true;
  mat.opacity = 0.55;
  mat.depthWrite = false;
});
gridHelper.renderOrder = 1;
gridHelper.position.y = 0.002;
scene.add(gridHelper);

function updateGridCellSize(size) {
  if (!(size > 0)) {
    if (snapCellSizeInput) {
      snapCellSizeInput.value = gridCellSize.toString();
    }
    return;
  }
  const prevSize = gridCellSize;
  gridCellSize = size;

  const scale = size / DEFAULT_GRID_CELL_SIZE;
  floor.scale.set(scale, 1, scale);
  gridHelper.scale.set(scale, 1, scale);

  if (snapCellSizeInput) {
    snapCellSizeInput.value = size.toString();
  }

  if (snapTranslateInput) {
    const moveValue = parseFloat(snapTranslateInput.value);
    if (Number.isNaN(moveValue) || Math.abs(moveValue - prevSize) < 1e-6) {
      translationSnapValue = size;
      lastValidTranslationSnap = size;
      snapTranslateInput.value = size.toString();
    }
  } else {
    translationSnapValue = size;
    lastValidTranslationSnap = size;
  }

  updateTransformSnapping();

  if (gridSnapEnabled && selectedMeshes.size > 0) {
    applyGridSnapToSelection();
    syncAdvancedPanelFromSelection();
    updateSceneObjectsList();
    pushHistory();
  }
}

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
/* MEASUREMENT TOOL                                                            */
/* -------------------------------------------------------------------------- */

const measurementGroup = new THREE.Group();
scene.add(measurementGroup);

const measurementLineMaterial = new THREE.LineBasicMaterial({
  color: 0x4ea1ff,
  transparent: true,
  opacity: 0.95,
  depthTest: false,
  depthWrite: false
});

const measurementHandleMaterial = new THREE.MeshBasicMaterial({
  color: 0x4ea1ff,
  transparent: true,
  opacity: 0.95,
  depthTest: false,
  depthWrite: false
});

const measurementHandleGeometry = new THREE.SphereGeometry(2.5, 24, 24);
const measurementMidpoint = new THREE.Vector3();
const measurementRaycastTargets = [];
let activeMeasurement = null;
let previousCanvasCursor = '';

function setMeasurementReadout(text) {
  if (!measurementReadout) return;
  if (text && text.trim().length > 0) {
    measurementReadout.textContent = text;
    measurementReadout.classList.add('visible');
  } else {
    measurementReadout.textContent = '';
    measurementReadout.classList.remove('visible');
  }
}

function createMeasurementLabelSprite(initialText = '') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;

  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(140, 70, 1);
  sprite.center.set(0.5, 0.5);
  sprite.renderOrder = 1001;

  const label = {
    sprite,
    canvas,
    context,
    texture,
    lastText: ''
  };

  updateMeasurementLabelTexture(label, initialText);
  sprite.visible = initialText !== '';

  return label;
}

function updateMeasurementLabelTexture(label, text) {
  if (text === label.lastText) return;
  label.lastText = text;

  const { context, canvas } = label;
  const { width, height } = canvas;

  context.clearRect(0, 0, width, height);

  context.strokeStyle = 'rgba(78, 161, 255, 0.75)';
  context.lineWidth = 5;
  context.strokeRect(4, 4, width - 8, height - 8);

  context.fillStyle = '#f5f5f5';
  context.shadowColor = 'rgba(0, 0, 0, 0.35)';
  context.shadowBlur = 12;
  context.font = 'bold 60px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const lines = text.split('\n');
  const lineHeight = 68;
  const totalHeight = lineHeight * lines.length;
  let y = (height - totalHeight) / 2 + lineHeight / 2;
  lines.forEach((line) => {
    context.fillText(line, width / 2, y);
    y += lineHeight;
  });

  context.shadowBlur = 0;
  context.shadowColor = 'transparent';

  label.texture.needsUpdate = true;
}

function formatMeasurementValues(distance) {
  const mm = Number.isFinite(distance) ? distance : 0;
  const mmText = mm >= 100 ? mm.toFixed(1) : mm.toFixed(2);
  const inches = mm / 25.4;
  const inchText = inches >= 100 ? inches.toFixed(1) : inches.toFixed(2);

  return {
    label: `${mmText} mm\n${inchText} in`,
    readout: `${mmText} mm • ${inchText} in`
  };
}

function createMeasurementVisual() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(6), 3)
  );

  const line = new THREE.Line(geometry, measurementLineMaterial.clone());
  line.visible = false;
  line.renderOrder = 1000;

  const startHandle = new THREE.Mesh(
    measurementHandleGeometry,
    measurementHandleMaterial.clone()
  );
  startHandle.visible = false;
  startHandle.renderOrder = 1001;

  const endHandle = startHandle.clone();
  endHandle.visible = false;

  const label = createMeasurementLabelSprite('');
  label.sprite.visible = false;

  measurementGroup.add(line);
  measurementGroup.add(startHandle);
  measurementGroup.add(endHandle);
  measurementGroup.add(label.sprite);

  return {
    line,
    startHandle,
    endHandle,
    label,
    start: new THREE.Vector3(),
    end: new THREE.Vector3(),
    awaitingSecondPoint: false,
    hasPreview: false
  };
}

function ensureMeasurement() {
  if (!activeMeasurement) {
    activeMeasurement = createMeasurementVisual();
  }
  return activeMeasurement;
}

function setMeasurementLabel(measurement, text, readoutText) {
  updateMeasurementLabelTexture(measurement.label, text);
  measurement.label.sprite.visible = text !== '';
  if (readoutText !== undefined) {
    setMeasurementReadout(readoutText);
  }
}

function clearMeasurementVisuals() {
  if (!activeMeasurement) return;
  activeMeasurement.awaitingSecondPoint = false;
  activeMeasurement.hasPreview = false;
  activeMeasurement.line.visible = false;
  activeMeasurement.startHandle.visible = false;
  activeMeasurement.endHandle.visible = false;
  activeMeasurement.label.sprite.visible = false;
  activeMeasurement.label.lastText = '';
}

function refreshMeasurementDisplay(measurement) {
  const {
    line,
    startHandle,
    endHandle,
    label,
    start,
    end,
    awaitingSecondPoint,
    hasPreview
  } = measurement;

  const positions = line.geometry.attributes.position.array;
  positions[0] = start.x;
  positions[1] = start.y;
  positions[2] = start.z;
  positions[3] = end.x;
  positions[4] = end.y;
  positions[5] = end.z;
  line.geometry.attributes.position.needsUpdate = true;
  line.geometry.computeBoundingSphere();

  startHandle.position.copy(start);
  startHandle.visible = true;

  const showSecond = hasPreview || !awaitingSecondPoint;
  endHandle.position.copy(end);
  endHandle.visible = showSecond;
  line.visible = showSecond;

  measurementMidpoint.copy(start);
  if (showSecond) {
    measurementMidpoint.add(end).multiplyScalar(0.5);
  }
  measurementMidpoint.y += 10;
  label.sprite.position.copy(measurementMidpoint);

  if (awaitingSecondPoint && !hasPreview) {
    // Keep instructions in the readout but avoid drawing the 3D label until we
    // have a preview segment so no overlay appears on the scene.
    setMeasurementLabel(measurement, '', 'Select end point');
  } else {
    const { label: labelText, readout } = formatMeasurementValues(
      start.distanceTo(end)
    );
    setMeasurementLabel(measurement, labelText, readout);
  }
}

function beginMeasurement(point) {
  const measurement = ensureMeasurement();
  measurement.start.copy(point);
  measurement.end.copy(point);
  measurement.awaitingSecondPoint = true;
  measurement.hasPreview = false;
  refreshMeasurementDisplay(measurement);
}

function previewMeasurement(point) {
  if (!activeMeasurement || !activeMeasurement.awaitingSecondPoint) return;
  if (!point) {
    activeMeasurement.end.copy(activeMeasurement.start);
    activeMeasurement.hasPreview = false;
    refreshMeasurementDisplay(activeMeasurement);
    return;
  }

  activeMeasurement.end.copy(point);
  activeMeasurement.hasPreview = true;
  refreshMeasurementDisplay(activeMeasurement);
}

function completeMeasurement(point) {
  if (!activeMeasurement) return;
  if (point) {
    activeMeasurement.end.copy(point);
  }
  activeMeasurement.hasPreview = true;
  activeMeasurement.awaitingSecondPoint = false;
  refreshMeasurementDisplay(activeMeasurement);
}

function cancelMeasurementPreview() {
  if (!activeMeasurement || !activeMeasurement.awaitingSecondPoint) return;
  activeMeasurement.end.copy(activeMeasurement.start);
  activeMeasurement.hasPreview = false;
  refreshMeasurementDisplay(activeMeasurement);
}

function getMeasurementPointFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  measurementRaycastTargets.length = 0;
  measurementRaycastTargets.push(...placedPartsGroup.children);
  measurementRaycastTargets.push(floor);

  const hits = raycaster.intersectObjects(measurementRaycastTargets, true);
  if (hits.length === 0) return null;
  return hits[0].point.clone();
}

function setMeasureMode(on) {
  if (isMeasureMode === on) return;
  isMeasureMode = on;

  if (measureModeBtn) {
    measureModeBtn.classList.toggle('active', on);
    measureModeBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    measureModeBtn.title = on ? 'Exit measure mode (M)' : 'Measure (M)';
  }

  if (on) {
    previousCanvasCursor = renderer.domElement.style.cursor;
    renderer.domElement.style.cursor = 'crosshair';
    clearMeasurementVisuals();
    setMeasurementReadout('Click to place measurement');
  } else {
    renderer.domElement.style.cursor = previousCanvasCursor || '';
    clearMeasurementVisuals();
    setMeasurementReadout('');
  }

  transformControls.enabled = !on;
  transformControls.visible = !on && !!transformControls.object;

  if (!on && isAdvancedMode) {
    setTransformMode(lastTransformMode, { fromMeasure: true });
  }

  updateBottomControlsVisibility();
}

/* -------------------------------------------------------------------------- */
/* SELECTION & UI                                                              */
/* -------------------------------------------------------------------------- */

function setMeshHighlight(mesh, isSelected) {
  mesh.material = isSelected ? selectedMaterial : normalMaterial;
}

function updateBottomControlsVisibility() {
  const hasSelection = selectedMeshes.size > 0;
  if (bottomControls) {
    bottomControls.style.display = 'flex';
  }
  if (basicControls) {
    basicControls.style.display = isAdvancedMode ? 'none' : 'flex';
  }
  if (advancedControls) {
    advancedControls.style.display = isAdvancedMode ? 'flex' : 'none';
  }
  if (gridControls) {
    gridControls.style.display = isAdvancedMode ? 'flex' : 'none';
  }

  if (rotateLeftBtn) rotateLeftBtn.disabled = !hasSelection;
  if (rotateRightBtn) rotateRightBtn.disabled = !hasSelection;

  if (rotationModeBtn) {
    const multiSelection = selectedMeshes.size > 1;
    const allowLocalRotation = hasSelection && !multiSelection;
    rotationModeBtn.disabled = !allowLocalRotation;
    if (multiSelection && !rotateAroundWorld) {
      rotateAroundWorld = true;
    }
    updateRotationModeUi();
  }

  if (moveModeBtn) moveModeBtn.disabled = !hasSelection;
  if (rotateModeBtn) rotateModeBtn.disabled = !hasSelection;
  if (scaleModeBtn) scaleModeBtn.disabled = !hasSelection;

  if (moveModeBtn && rotateModeBtn && scaleModeBtn) {
    if (!hasSelection || isMeasureMode) {
      moveModeBtn.classList.remove('active');
      rotateModeBtn.classList.remove('active');
      scaleModeBtn.classList.remove('active');
    } else {
      const activeMode = transformControls.getMode();
      moveModeBtn.classList.toggle('active', activeMode === 'translate');
      rotateModeBtn.classList.toggle('active', activeMode === 'rotate');
      scaleModeBtn.classList.toggle('active', activeMode === 'scale');
    }
  }

  if (measureModeBtn) {
    measureModeBtn.disabled = !isAdvancedMode;
    measureModeBtn.classList.toggle('active', isMeasureMode);
    measureModeBtn.setAttribute('aria-pressed', isMeasureMode ? 'true' : 'false');
    measureModeBtn.title = isMeasureMode
      ? 'Exit measure mode (M)'
      : 'Measure (M)';
  }

  updateGridSnapButton();

  // Update rows highlight in scene objects list
  if (sceneObjectsList) {
    updateSceneObjectSelectionStyles();
  }
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

  const offset = center
    .clone()
    .multiply(mesh.scale)
    .applyQuaternion(mesh.quaternion);

  mesh.position.add(offset);
  mesh.userData.pivotCentered = true;
}

/** keep gizmo centered on its mesh when attaching */
function updateSelectionTransformAnchor({ resetOrientation = true } = {}) {
  if (selectedMeshes.size === 0) return;

  selectionBounds.makeEmpty();
  let hasMesh = false;

  selectedMeshes.forEach((mesh) => {
    if (!mesh?.isObject3D) return;
    mesh.updateWorldMatrix(true, false);
    selectionTempBounds.setFromObject(mesh);
    if (!hasMesh) {
      selectionBounds.copy(selectionTempBounds);
      hasMesh = true;
    } else {
      selectionBounds.union(selectionTempBounds);
    }
  });

  if (!hasMesh) return;

  selectionBounds.getCenter(selectionCenter);
  selectionTransformAnchor.position.copy(selectionCenter);

  if (resetOrientation) {
    selectionTransformAnchor.quaternion.identity();
  }

  selectionTransformAnchor.scale.set(1, 1, 1);

  selectionTransformAnchor.updateMatrixWorld(true);
}

function updateTransformControls() {
  resetMultiSelectionTransformState();
  if (!isAdvancedMode || selectedMeshes.size === 0) {
    transformControls.detach();
    return;
  }

  if (selectedMeshes.size === 1) {
    const mesh = [...selectedMeshes][0];
    centerMeshPivot(mesh);
    transformControls.attach(mesh);
    refreshTransformSnapping();
    return;
  }

  selectedMeshes.forEach(centerMeshPivot);
  updateSelectionTransformAnchor();
  transformControls.attach(selectionTransformAnchor);
  refreshTransformSnapping();
}

function clearSelection() {
  selectedMeshes.forEach((mesh) => setMeshHighlight(mesh, false));
  selectedMeshes.clear();
  resetMultiSelectionTransformState();
  updateBottomControlsVisibility();
  updateTransformControls();
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
  updateTransformControls();
  syncAdvancedPanelFromSelection();
}

function resetMultiSelectionTransformState() {
  multiSelectionTransformState = null;
}

function captureMultiSelectionTransformState() {
  if (selectedMeshes.size <= 1) {
    resetMultiSelectionTransformState();
    return;
  }

  scene.updateMatrixWorld(true);
  selectionTransformAnchor.updateMatrixWorld(true);

  const anchorStartMatrixWorld = selectionTransformAnchor.matrixWorld.clone();
  const anchorStartMatrixWorldInverse = anchorStartMatrixWorld.clone().invert();

  const meshData = [];
  selectedMeshes.forEach((mesh) => {
    if (!mesh?.isObject3D || !mesh.parent) return;
    mesh.updateMatrixWorld(true);
    const initialMatrixWorld = mesh.matrixWorld.clone();
    const parentMatrixWorldInverse = mesh.parent.matrixWorld.clone().invert();
    meshData.push({
      mesh,
      initialMatrixWorld,
      parentMatrixWorldInverse
    });
  });

  if (meshData.length === 0) {
    resetMultiSelectionTransformState();
    return;
  }

  multiSelectionTransformState = {
    anchorStartMatrixWorld,
    anchorStartMatrixWorldInverse,
    meshData
  };
}

function applyMultiSelectionTransform() {
  if (!multiSelectionTransformState || selectedMeshes.size <= 1) return;

  selectionTransformAnchor.updateMatrixWorld(true);

  const currentAnchorMatrixWorld = multiSelectionTempMatrix.copy(
    selectionTransformAnchor.matrixWorld
  );
  const deltaMatrixWorld = multiSelectionTempMatrix2
    .copy(currentAnchorMatrixWorld)
    .multiply(multiSelectionTransformState.anchorStartMatrixWorldInverse);

  multiSelectionTransformState.meshData.forEach(
    ({ mesh, initialMatrixWorld, parentMatrixWorldInverse }) => {
      if (!mesh?.isObject3D || !mesh.parent) return;

      const newMatrixWorld = multiSelectionTempMatrix3
        .copy(deltaMatrixWorld)
        .multiply(initialMatrixWorld);

      multiSelectionTempMatrix4.copy(parentMatrixWorldInverse).multiply(newMatrixWorld);

      multiSelectionTempMatrix4.decompose(
        multiSelectionTempPosition,
        multiSelectionTempQuaternion,
        multiSelectionTempScale
      );

      mesh.position.copy(multiSelectionTempPosition);
      mesh.quaternion.copy(multiSelectionTempQuaternion);
      mesh.scale.copy(multiSelectionTempScale);
      mesh.updateMatrix();
      mesh.updateMatrixWorld(true);
    }
  );
}

function getTranslationSnapStep() {
  return translationSnapValue || gridCellSize;
}

function snapToStep(value, step) {
  return Math.round(value / step) * step;
}

function applyGridSnap(mesh) {
  if (!mesh) return;
  const step = getTranslationSnapStep();
  mesh.position.x = snapToStep(mesh.position.x, step);
  mesh.position.z = snapToStep(mesh.position.z, step);
}

function applyGridSnapToSelection() {
  if (!gridSnapEnabled || selectedMeshes.size === 0) return;

  if (selectedMeshes.size === 1) {
    const [mesh] = selectedMeshes;
    applyGridSnap(mesh);
    return;
  }

  updateSelectionTransformAnchor({ resetOrientation: false });
  selectionTransformAnchor.updateMatrixWorld(true);

  const step = getTranslationSnapStep();
  const anchorPosition = selectionTransformAnchor.position;
  const targetX = snapToStep(anchorPosition.x, step);
  const targetZ = snapToStep(anchorPosition.z, step);
  const deltaX = targetX - anchorPosition.x;
  const deltaZ = targetZ - anchorPosition.z;

  if (Math.abs(deltaX) < 1e-6 && Math.abs(deltaZ) < 1e-6) {
    return;
  }

  const translationMatrix = multiSelectionTempMatrix.makeTranslation(deltaX, 0, deltaZ);

  selectedMeshes.forEach((mesh) => {
    if (!mesh?.isObject3D || !mesh.parent) return;

    mesh.updateMatrixWorld(true);

    const newMatrixWorld = multiSelectionTempMatrix2
      .copy(translationMatrix)
      .multiply(mesh.matrixWorld);

    const parentMatrixWorldInverse = multiSelectionTempMatrix3
      .copy(mesh.parent.matrixWorld)
      .invert();

    multiSelectionTempMatrix4.copy(parentMatrixWorldInverse).multiply(newMatrixWorld);
    multiSelectionTempMatrix4.decompose(
      multiSelectionTempPosition,
      multiSelectionTempQuaternion,
      multiSelectionTempScale
    );

    mesh.position.copy(multiSelectionTempPosition);
    mesh.quaternion.copy(multiSelectionTempQuaternion);
    mesh.scale.copy(multiSelectionTempScale);
    mesh.updateMatrix();
    mesh.updateMatrixWorld(true);
  });

  selectionTransformAnchor.position.x += deltaX;
  selectionTransformAnchor.position.z += deltaZ;
  selectionTransformAnchor.updateMatrixWorld(true);
}

function updateGridSnapButton() {
  if (!gridSnapBtn) return;
  const isActiveInMode = isAdvancedMode && gridSnapEnabled;
  gridSnapBtn.classList.toggle('active', isActiveInMode);
  gridSnapBtn.setAttribute('aria-pressed', isActiveInMode ? 'true' : 'false');
  gridSnapBtn.disabled = !isAdvancedMode;
  if (gridSnapIcon) {
    const iconState = isAdvancedMode
      ? (gridSnapEnabled ? 'grid_on' : 'grid_off')
      : (advancedGridSnapEnabled ? 'grid_on' : 'grid_off');
    gridSnapIcon.textContent = iconState;
  }
  const snapStep = getTranslationSnapStep();
  const display = Number.isInteger(snapStep) ? snapStep.toString() : snapStep.toFixed(1);
  gridSnapBtn.title = isAdvancedMode
    ? (gridSnapEnabled ? `Grid snapping: On (${display} mm)` : 'Grid snapping: Off')
    : (advancedGridSnapEnabled
      ? 'Grid snapping will be ON in Advanced mode'
      : 'Grid snapping will be OFF in Advanced mode');
}

function refreshTransformSnapping() {
  transformControls.setTranslationSnap(gridSnapEnabled ? getTranslationSnapStep() : null);

  const r = snapRotateInput ? parseFloat(snapRotateInput.value) : NaN;
  transformControls.setRotationSnap(
    !Number.isNaN(r) && r > 0 ? THREE.MathUtils.degToRad(r) : null
  );
}

function setGridSnapEnabled(enabled, { snapSelection = false, commit = false } = {}) {
  if (!isAdvancedMode) {
    advancedGridSnapEnabled = enabled;
    gridSnapEnabled = false;
    refreshTransformSnapping();
    updateGridSnapButton();
    return;
  }

  advancedGridSnapEnabled = enabled;
  gridSnapEnabled = enabled;
  if (snapTranslateInput && enabled) {
    snapTranslateInput.value = translationSnapValue.toString();
  }
  refreshTransformSnapping();
  updateGridSnapButton();

  if (enabled && snapSelection && selectedMeshes.size > 0) {
    applyGridSnapToSelection();
    syncAdvancedPanelFromSelection();
    updateSceneObjectsList();
    if (commit) pushHistory();
  }
}

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
  instanceIdLookup.clear();
  sceneRowByInstanceId.clear();
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
    registerMeshInstance(mesh);
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

/* -------------------------------------------------------------------------- */
/* FBX LOADING & PARTS LIBRARY                                                 */
/* -------------------------------------------------------------------------- */

importBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files ?? []);
  if (!files.length) return;

  const startingLibrarySize = partLibrary.length;

  fileNameLabel.textContent =
    files.length === 1 ? files[0].name : `${files.length} files selected`;

  let loadedAny = false;
  const failedFiles = [];

  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['fbx', 'stl'].includes(extension)) {
      failedFiles.push(file.name);
      continue;
    }

    const beforeCount = partLibrary.length;
    let arrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (err) {
      console.error(err);
      failedFiles.push(file.name);
      continue;
    }

    try {
      if (extension === 'fbx') {
        const root = loader.parse(arrayBuffer, '');
        extractPartsFromObject(root);
        disposeObject(root);
        if (partLibrary.length > beforeCount) {
          loadedAny = true;
        } else {
          failedFiles.push(file.name);
        }
      } else if (extension === 'stl') {
        const geometry = stlLoader.parse(arrayBuffer);
        if (!geometry.attributes.normal) geometry.computeVertexNormals();

        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox;
        if (boundingBox) {
          const center = new THREE.Vector3();
          boundingBox.getCenter(center);
          geometry.translate(-center.x, -center.y, -center.z);
          geometry.computeBoundingBox();
          geometry.computeBoundingSphere();
        }

        const baseName = file.name.replace(/\.[^.]*$/u, '') ||
          `Part ${partLibrary.length + 1}`;

        partLibrary.push({
          name: baseName,
          geometry,
          category: null
        });
        loadedAny = true;
      }
    } catch (err) {
      console.error(err);
      failedFiles.push(file.name);
    }
  }

  if (!loadedAny) {
    updatePartsListUI();
    updateSceneObjectsList();
    if (failedFiles.length) {
      const uniqueFailures = [...new Set(failedFiles)];
      alert(`Could not load: ${uniqueFailures.join(', ')}`);
    }
    fileInput.value = '';
    return;
  }

  updatePartsListUI();

  if (startingLibrarySize === 0) {
    updateSceneObjectsList();
    frameScene(true);
  }

  if (failedFiles.length) {
    const uniqueFailures = [...new Set(failedFiles)];
    alert(`Some files could not be loaded: ${uniqueFailures.join(', ')}`);
  }

  fileInput.value = '';
});

function extractPartsFromObject(root) {
  root.updateMatrixWorld(true);

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
      beginPartDragPreview(idx);
    });

    item.addEventListener('dragend', () => {
      endPartDragPreview();
    });

    if (isTouch) {
      item.addEventListener('click', () => {
        const mesh = addPartInstance(idx);
        if (mesh) {
          clearSelection();
          selectedMeshes.add(mesh);
          setMeshHighlight(mesh, true);
          updateBottomControlsVisibility();
          updateTransformControls();
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

function beginPartDragPreview(partIndex) {
  if (!isAdvancedMode) {
    endPartDragPreview();
    return;
  }

  const part = partLibrary[partIndex];
  if (!part) return;

  endPartDragPreview();

  const geomClone = part.geometry.clone();
  dragPreviewMesh = new THREE.Mesh(geomClone, dragPreviewMaterial);
  dragPreviewMesh.visible = false;
  dragPreviewMesh.renderOrder = 2;
  dragPreviewMesh.userData.partIndex = partIndex;
  dragPreviewMesh.castShadow = false;
  dragPreviewMesh.receiveShadow = false;
  scene.add(dragPreviewMesh);

  dragPreviewPartIndex = partIndex;
  hasPendingDropPosition = false;
}

function endPartDragPreview() {
  if (!dragPreviewMesh) {
    dragPreviewPartIndex = null;
    hasPendingDropPosition = false;
    return;
  }
  scene.remove(dragPreviewMesh);
  dragPreviewMesh.geometry?.dispose();
  dragPreviewMesh = null;
  dragPreviewPartIndex = null;
  hasPendingDropPosition = false;
}

function updateDragPreviewFromEvent(event) {
  if (!dragPreviewMesh || !isAdvancedMode) return;

  const rect = renderer.domElement.getBoundingClientRect();
  previewPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  previewPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  previewRaycaster.setFromCamera(previewPointer, camera);
  const intersection = previewRaycaster.ray.intersectPlane(dropPlane, dropIntersection);
  if (!intersection) {
    dragPreviewMesh.visible = false;
    hasPendingDropPosition = false;
    return;
  }

  let x = intersection.x;
  let z = intersection.z;
  if (gridSnapEnabled) {
    const step = getTranslationSnapStep();
    x = snapToStep(x, step);
    z = snapToStep(z, step);
  }

  dragPreviewMesh.position.set(x, intersection.y, z);
  dragPreviewMesh.visible = true;
  pendingDropPosition.set(x, intersection.y, z);
  hasPendingDropPosition = true;
}

renderer.domElement.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
  updateDragPreviewFromEvent(e);
});

renderer.domElement.addEventListener('dragleave', (e) => {
  if (!dragPreviewMesh) return;
  const related = e.relatedTarget;
  if (related && renderer.domElement.contains(related)) return;
  dragPreviewMesh.visible = false;
  hasPendingDropPosition = false;
});

renderer.domElement.addEventListener('drop', (e) => {
  e.preventDefault();
  let index = parseInt(e.dataTransfer.getData('text/plain'), 10);
  if (Number.isNaN(index)) {
    index = dragPreviewPartIndex != null ? dragPreviewPartIndex : NaN;
  }
  if (Number.isNaN(index)) {
    endPartDragPreview();
    return;
  }

  if (isAdvancedMode) {
    updateDragPreviewFromEvent(e);
  }

  const spawnPosition = isAdvancedMode && hasPendingDropPosition
    ? pendingDropPosition
    : null;

  const mesh = addPartInstance(index, spawnPosition);
  if (!mesh) {
    endPartDragPreview();
    return;
  }
  clearSelection();
  selectedMeshes.add(mesh);
  setMeshHighlight(mesh, true);
  updateBottomControlsVisibility();
  updateTransformControls();
  syncAdvancedPanelFromSelection();
  pushHistory();
  endPartDragPreview();
});

function addPartInstance(partIndex, initialPosition = null) {
  const part = partLibrary[partIndex];
  if (!part) return null;

  const isFirst = placedPartsGroup.children.length === 0;

  const geomClone = part.geometry.clone();
  const mesh = new THREE.Mesh(geomClone, normalMaterial);
  if (initialPosition) {
    mesh.position.copy(initialPosition);
  } else {
    mesh.position.set(0, 0, 0);
  }
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);

  if (gridSnapEnabled) {
    applyGridSnap(mesh);
  }

  mesh.userData = {
    rotationSteps: 0,
    partIndex,
    pivotCentered: false,
    instanceId: nextInstanceId++
  };

  mesh.castShadow = mesh.receiveShadow = true;
  placedPartsGroup.add(mesh);
  registerMeshInstance(mesh);

  if (isFirst) {
    frameScene(false);
  }

  updateSceneObjectsList();
  return mesh;
}

/* -------------------------------------------------------------------------- */
/* SCENE OBJECTS LIST                                                          */
/* -------------------------------------------------------------------------- */

function registerMeshInstance(mesh) {
  const id = mesh?.userData?.instanceId;
  if (!mesh || !mesh.isMesh || id == null) return;
  instanceIdLookup.set(id, mesh);
}

function unregisterMeshInstance(mesh) {
  const id = mesh?.userData?.instanceId;
  if (id == null) return;
  instanceIdLookup.delete(id);
  sceneRowByInstanceId.delete(id);
}

function findMeshByInstanceId(id) {
  if (!id) return null;
  return instanceIdLookup.get(id) ?? null;
}

function updateSceneObjectSelectionStyles() {
  sceneRowByInstanceId.forEach((row, instanceId) => {
    const mesh = instanceIdLookup.get(instanceId);
    const isSelected = mesh ? selectedMeshes.has(mesh) : false;
    row.classList.toggle('selected', isSelected);
  });
}

function updateSceneObjectsList() {
  if (!sceneObjectsList) return;
  sceneRowByInstanceId.clear();

  const meshes = [];
  for (const child of placedPartsGroup.children) {
    if (child.isMesh && child.userData.partIndex != null) {
      meshes.push(child);
    }
  }

  if (!meshes.length) {
    const empty = document.createElement('div');
    empty.style.opacity = '0.7';
    empty.style.fontSize = '11px';
    empty.textContent = 'No objects in scene.';
    sceneObjectsList.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  meshes.forEach((mesh, idx) => {
    const row = document.createElement('div');
    row.className = 'scene-object-row';
    const instanceId = mesh.userData.instanceId;
    if (instanceId != null) {
      row.dataset.instanceId = instanceId.toString();
      sceneRowByInstanceId.set(instanceId, row);
    }

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

    if (isAdvancedMode) {
      actions.appendChild(dupBtn);
    }
    actions.appendChild(delBtn);
    row.appendChild(actions);

    const isSelected = selectedMeshes.has(mesh);
    if (isSelected) row.classList.add('selected');

    fragment.appendChild(row);
  });

  sceneObjectsList.replaceChildren(fragment);
  updateSceneObjectSelectionStyles();
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
    } else if (action === 'duplicate' && isAdvancedMode) {
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
    updateTransformControls();
    syncAdvancedPanelFromSelection();
  }
});

function deleteMeshInstance(mesh) {
  if (!mesh || !mesh.isMesh) return;
  const wasSelected = selectedMeshes.has(mesh);
  if (wasSelected) selectedMeshes.delete(mesh);

  unregisterMeshInstance(mesh);
  mesh.geometry?.dispose();
  placedPartsGroup.remove(mesh);

  if (wasSelected) {
    updateBottomControlsVisibility();
    updateTransformControls();
    syncAdvancedPanelFromSelection();
  }

  updateSceneObjectsList();
  pushHistory();
}

function duplicateMeshInstance(mesh) {
  if (!isAdvancedMode) return;
  if (!mesh || !mesh.isMesh) return;

  const geomClone = mesh.geometry.clone();
  const clone = new THREE.Mesh(geomClone, normalMaterial);
  clone.position.copy(mesh.position);
  clone.rotation.copy(mesh.rotation);
  clone.scale.copy(mesh.scale);

  if (gridSnapEnabled) {
    applyGridSnap(clone);
  }

  clone.userData = {
    ...mesh.userData,
    instanceId: nextInstanceId++
  };

  clone.castShadow = clone.receiveShadow = true;
  placedPartsGroup.add(clone);
  registerMeshInstance(clone);

  clearSelection();
  selectedMeshes.add(clone);
  setMeshHighlight(clone, true);

  updateSceneObjectsList();
  updateBottomControlsVisibility();
  updateTransformControls();
  syncAdvancedPanelFromSelection();
  pushHistory();
}

/* -------------------------------------------------------------------------- */
/* RAYCAST SELECTION (HONOR TRANSFORM GIZMO FIRST)                             */
/* -------------------------------------------------------------------------- */

// --- Selection click in scene ---
/* -------------------------------------------------------------------------- */
/* RAYCAST SELECTION (GIZMO-FRIENDLY)                                         */
/* -------------------------------------------------------------------------- */

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

  if (isMeasureMode) {
    const point = getMeasurementPointFromEvent(event);
    if (activeMeasurement && activeMeasurement.awaitingSecondPoint) {
      if (point) {
        completeMeasurement(point);
      } else {
        cancelMeasurementPreview();
      }
    } else if (point) {
      beginMeasurement(point);
    }
    hadTransformDrag = false;
    return;
  }

  // If a gizmo drag happened during this interaction, don't change selection
  if (isAdvancedMode && hadTransformDrag) {
    hadTransformDrag = false;
    return;
  }
  hadTransformDrag = false;

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

function onCanvasPointerMove(event) {
  if (!isMeasureMode) return;
  if (!activeMeasurement || !activeMeasurement.awaitingSecondPoint) return;
  if (event.buttons !== 0) return;

  const point = getMeasurementPointFromEvent(event);
  if (point) {
    previewMeasurement(point);
  } else {
    cancelMeasurementPreview();
  }
}

renderer.domElement.addEventListener('pointerdown', onCanvasPointerDown);
renderer.domElement.addEventListener('pointerup', onCanvasPointerUp);
renderer.domElement.addEventListener('pointermove', onCanvasPointerMove);
renderer.domElement.addEventListener('pointerleave', () => {
  if (isMeasureMode) {
    cancelMeasurementPreview();
  }
});


/* -------------------------------------------------------------------------- */
/* BASIC ROTATION / DELETE                                                     */
/* -------------------------------------------------------------------------- */

function rotateSelectedPart(deltaSteps) {
  if (selectedMeshes.size === 0) return;

  if (!rotateAroundWorld && selectedMeshes.size === 1) {
    rotateSelectedPartAroundCenter(deltaSteps);
    return;
  }

  const angle = deltaSteps * (Math.PI / 2);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  selectedMeshes.forEach((mesh) => {
    const p = mesh.position;
    const x = p.x;
    const z = p.z;

    p.x = x * cos - z * sin;
    p.z = x * sin + z * cos;
    mesh.rotation.y += angle;

    const steps = (mesh.userData.rotationSteps ?? 0) + deltaSteps;
    mesh.userData.rotationSteps = ((steps % 4) + 4) % 4;

    if (gridSnapEnabled) {
      applyGridSnap(mesh);
    }
  });

  pushHistory();
}

function rotateSelectedPartAroundCenter(deltaSteps) {
  if (selectedMeshes.size !== 1) return;

  const angle = deltaSteps * (Math.PI / 2);

  selectedMeshes.forEach((mesh) => {
    centerMeshPivot(mesh);
    mesh.rotation.y += angle;

    const steps = (mesh.userData.rotationSteps ?? 0) + deltaSteps;
    mesh.userData.rotationSteps = ((steps % 4) + 4) % 4;

    if (gridSnapEnabled) {
      applyGridSnap(mesh);
    }
  });

  pushHistory();
}

function updateRotationModeUi() {
  if (!rotationModeBtn) return;
  rotationModeBtn.classList.toggle('active', !rotateAroundWorld);

  if (rotationModeIcon) {
    rotationModeIcon.textContent = rotateAroundWorld ? 'public' : 'view_in_ar';
  }

  rotationModeBtn.title = rotateAroundWorld
    ? 'Rotation mode: World'
    : 'Rotation mode: Object';
}

if (rotationModeBtn) {
  rotationModeBtn.addEventListener('click', () => {
    rotateAroundWorld = !rotateAroundWorld;
    updateRotationModeUi();
  });
}

updateRotationModeUi();

rotateLeftBtn.addEventListener('click', (event) => {
  if (selectedMeshes.size === 0) return;
  if (event?.shiftKey) {
    rotateSelectedPartAroundCenter(-1);
    return;
  }
  rotateSelectedPart(-1);
});

rotateRightBtn.addEventListener('click', (event) => {
  if (selectedMeshes.size === 0) return;
  if (event?.shiftKey) {
    rotateSelectedPartAroundCenter(1);
    return;
  }
  rotateSelectedPart(1);
});

if (gridSnapBtn) {
  gridSnapBtn.addEventListener('click', () => {
    if (!isAdvancedMode) return;
    const enable = !advancedGridSnapEnabled;
    setGridSnapEnabled(enable);
  });
}

function deleteSelected() {
  if (selectedMeshes.size === 0) return;

  const toDelete = Array.from(selectedMeshes);
  clearSelection();
  toDelete.forEach((mesh) => {
    unregisterMeshInstance(mesh);
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
  const wasAdvanced = isAdvancedMode;
  isAdvancedMode = on;
  advancedModeButton.classList.toggle('active', on);

  // Show/hide advanced panels
  advancedPanel.style.display = on ? 'block' : 'none';
  if (on) {
    setGridSnapEnabled(advancedGridSnapEnabled);
    setTransformMode('translate');
  } else {
    setMeasureMode(false);
    if (wasAdvanced) {
      advancedGridSnapEnabled = gridSnapEnabled;
    }
    gridSnapEnabled = false;
    refreshTransformSnapping();
    updateGridSnapButton();
    transformControls.detach();
    resetMultiSelectionTransformState();
    endPartDragPreview();
  }
  updateBottomControlsVisibility();
  updateTransformControls();
  syncAdvancedPanelFromSelection();
  updateSceneObjectsList();
}

advancedModeButton.addEventListener('click', () => {
  setAdvancedMode(!isAdvancedMode);
});

function syncAdvancedPanelFromSelection() {
  const hasSingle = selectedMeshes.size === 1;
  const inputs = [
    posXInput, posYInput, posZInput,
    rotXInput, rotYInput, rotZInput,
    scaleXInput, scaleYInput, scaleZInput
  ];

  inputs.forEach((el) => { el.disabled = !hasSingle || !isAdvancedMode; });
  flipButtons.forEach(({ btn }) => {
    const disabled = !hasSingle || !isAdvancedMode;
    btn.disabled = disabled;
    if (disabled) {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
  });

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

  const rotXDeg = THREE.MathUtils.radToDeg(mesh.rotation.x);
  const rotYDeg = THREE.MathUtils.radToDeg(mesh.rotation.y);
  const rotZDeg = THREE.MathUtils.radToDeg(mesh.rotation.z);
  rotXInput.value = rotXDeg.toFixed(1);
  rotYInput.value = rotYDeg.toFixed(1);
  rotZInput.value = rotZDeg.toFixed(1);

  scaleXInput.value = mesh.scale.x.toFixed(3);
  scaleYInput.value = mesh.scale.y.toFixed(3);
  scaleZInput.value = mesh.scale.z.toFixed(3);

  flipButtons.forEach(({ btn, axis }) => {
    const isFlipped = mesh.scale[axis] < 0;
    btn.classList.toggle('active', isFlipped);
    btn.setAttribute('aria-pressed', isFlipped ? 'true' : 'false');
  });
}

function applyAdvancedInputs() {
  if (!isAdvancedMode || selectedMeshes.size !== 1) return;

  const mesh = [...selectedMeshes][0];

  const px = parseFloat(posXInput.value);
  const py = parseFloat(posYInput.value);
  const pz = parseFloat(posZInput.value);
  const rxDeg = parseFloat(rotXInput.value);
  const ryDeg = parseFloat(rotYInput.value);
  const rzDeg = parseFloat(rotZInput.value);
  const sx = parseFloat(scaleXInput.value);
  const sy = parseFloat(scaleYInput.value);
  const sz = parseFloat(scaleZInput.value);

  if (!Number.isNaN(px)) mesh.position.x = px;
  if (!Number.isNaN(py)) mesh.position.y = py;
  if (!Number.isNaN(pz)) mesh.position.z = pz;

  if (!Number.isNaN(rxDeg)) mesh.rotation.x = THREE.MathUtils.degToRad(rxDeg);
  if (!Number.isNaN(ryDeg)) mesh.rotation.y = THREE.MathUtils.degToRad(ryDeg);
  if (!Number.isNaN(rzDeg)) mesh.rotation.z = THREE.MathUtils.degToRad(rzDeg);

  if (!Number.isNaN(sx)) mesh.scale.x = sx;
  if (!Number.isNaN(sy)) mesh.scale.y = sy;
  if (!Number.isNaN(sz)) mesh.scale.z = sz;

  if (gridSnapEnabled) {
    applyGridSnap(mesh);
  }

  updateSceneObjectsList();
  syncAdvancedPanelFromSelection();
  pushHistory();
}

[
  posXInput, posYInput, posZInput,
  rotXInput, rotYInput, rotZInput,
  scaleXInput, scaleYInput, scaleZInput
].forEach((input) => {
  input.addEventListener('change', applyAdvancedInputs);
});

function flipSelectedAxis(axis) {
  if (!isAdvancedMode || selectedMeshes.size !== 1) return;
  const mesh = [...selectedMeshes][0];
  const flipped = -mesh.scale[axis];
  mesh.scale[axis] = Object.is(flipped, -0) ? 0 : flipped;
  const entry = flipButtons.find((item) => item.axis === axis);
  if (entry?.btn) {
    const isFlipped = mesh.scale[axis] < 0;
    entry.btn.classList.toggle('active', isFlipped);
    entry.btn.setAttribute('aria-pressed', isFlipped ? 'true' : 'false');
  }
  updateSceneObjectsList();
  syncAdvancedPanelFromSelection();
  updateTransformControls();
  pushHistory();
}

flipButtons.forEach(({ btn, axis }) => {
  btn.addEventListener('click', () => {
    flipSelectedAxis(axis);
  });
});

function updateTransformSnapping() {
  const t = snapTranslateInput ? parseFloat(snapTranslateInput.value) : NaN;
  if (!Number.isNaN(t) && t > 0) {
    translationSnapValue = t;
    lastValidTranslationSnap = t;
  } else if (snapTranslateInput) {
    translationSnapValue = lastValidTranslationSnap;
    snapTranslateInput.value = lastValidTranslationSnap.toString();
  }

  refreshTransformSnapping();
  updateGridSnapButton();

  const r = snapRotateInput ? parseFloat(snapRotateInput.value) : NaN;
  transformControls.setRotationSnap(
    !Number.isNaN(r) && r > 0 ? THREE.MathUtils.degToRad(r) : null
  );
}

snapTranslateInput.addEventListener('change', updateTransformSnapping);
snapRotateInput.addEventListener('change', updateTransformSnapping);

function setTransformMode(mode, { fromMeasure = false } = {}) {
  if (!isAdvancedMode) return;

  if (!fromMeasure && isMeasureMode) {
    setMeasureMode(false);
  }

  transformControls.setMode(mode);
  lastTransformMode = mode;
  updateBottomControlsVisibility();
}

moveModeBtn.addEventListener('click', () => setTransformMode('translate'));
rotateModeBtn.addEventListener('click', () => setTransformMode('rotate'));
scaleModeBtn.addEventListener('click', () => setTransformMode('scale'));

if (measureModeBtn) {
  measureModeBtn.addEventListener('click', () => {
    if (!isAdvancedMode && !isMeasureMode) return;
    setMeasureMode(!isMeasureMode);
  });
}

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

  if (e.key === 'Escape') {
    if (isMeasureMode) {
      e.preventDefault();
      setMeasureMode(false);
      return;
    }
  }

  if (e.key === 'm' || e.key === 'M') {
    if (!isAdvancedMode && !isMeasureMode) return;
    e.preventDefault();
    setMeasureMode(!isMeasureMode);
    return;
  }

  if (e.key === 'q' || e.key === 'Q') {
    if (e.shiftKey || (!rotateAroundWorld && selectedMeshes.size === 1)) {
      rotateSelectedPartAroundCenter(-1);
    } else {
      rotateSelectedPart(-1);
    }
  } else if (e.key === 'e' || e.key === 'E') {
    if (e.shiftKey || (!rotateAroundWorld && selectedMeshes.size === 1)) {
      rotateSelectedPartAroundCenter(1);
    } else {
      rotateSelectedPart(1);
    }
  } else if (e.key === 'h' || e.key === 'H' || e.code === 'Home') {
    frameScene(false);
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelected();
  }

  if (isAdvancedMode) {
    if (e.key === 'g' || e.key === 'G') setTransformMode('translate');
    else if (e.key === 'r' || e.key === 'R') setTransformMode('rotate');
    else if (e.key === 's' || e.key === 'S') setTransformMode('scale');
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

const STL_CHUNK_TRIANGLE_CAPACITY = 16384;
const MAX_STL_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5 GB safety cap

function createStlBlobFromGroup(group) {
  const header = new ArrayBuffer(84);
  const headerView = new DataView(header);

  const chunks = [];
  let chunkBuffer = new ArrayBuffer(STL_CHUNK_TRIANGLE_CAPACITY * 50);
  let chunkView = new DataView(chunkBuffer);
  let chunkOffset = 0;

  function flushChunk() {
    if (chunkOffset === 0) return;
    chunks.push(chunkBuffer.slice(0, chunkOffset));
    chunkBuffer = new ArrayBuffer(STL_CHUNK_TRIANGLE_CAPACITY * 50);
    chunkView = new DataView(chunkBuffer);
    chunkOffset = 0;
  }

  function ensureChunkSpace(bytes) {
    if (chunkOffset + bytes > chunkBuffer.byteLength) {
      flushChunk();
    }
  }

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const normal = new THREE.Vector3();

  const matrixWorld = new THREE.Matrix4();

  let triangleCount = 0;

  const writeTriangle = (a, b, c, n) => {
    ensureChunkSpace(50);
    const offset = chunkOffset;

    chunkView.setFloat32(offset, n.x, true);
    chunkView.setFloat32(offset + 4, n.y, true);
    chunkView.setFloat32(offset + 8, n.z, true);

    chunkView.setFloat32(offset + 12, a.x, true);
    chunkView.setFloat32(offset + 16, a.y, true);
    chunkView.setFloat32(offset + 20, a.z, true);

    chunkView.setFloat32(offset + 24, b.x, true);
    chunkView.setFloat32(offset + 28, b.y, true);
    chunkView.setFloat32(offset + 32, b.z, true);

    chunkView.setFloat32(offset + 36, c.x, true);
    chunkView.setFloat32(offset + 40, c.y, true);
    chunkView.setFloat32(offset + 44, c.z, true);

    chunkView.setUint16(offset + 48, 0, true);

    chunkOffset += 50;
    triangleCount += 1;
  };

  const writeFromIndices = (position, indexAttribute, matrix) => {
    const triCount = indexAttribute.count - (indexAttribute.count % 3);
    for (let i = 0; i < triCount; i += 3) {
      const aIndex = indexAttribute.getX(i);
      const bIndex = indexAttribute.getX(i + 1);
      const cIndex = indexAttribute.getX(i + 2);

      vA.fromBufferAttribute(position, aIndex).applyMatrix4(matrix);
      vB.fromBufferAttribute(position, bIndex).applyMatrix4(matrix);
      vC.fromBufferAttribute(position, cIndex).applyMatrix4(matrix);

      e1.subVectors(vB, vA);
      e2.subVectors(vC, vA);
      normal.crossVectors(e1, e2);

      if (normal.lengthSq() === 0) {
        continue;
      }

      normal.normalize();

      writeTriangle(vA, vB, vC, normal);
    }
  };

  group.traverse((child) => {
    if (!child.isMesh || !child.visible) return;

    const geometry = child.geometry;
    if (!geometry || !geometry.attributes || !geometry.attributes.position) {
      return;
    }

    const position = geometry.attributes.position;
    if (position.itemSize !== 3) {
      return;
    }

    matrixWorld.copy(child.matrixWorld);

    if (geometry.index) {
      writeFromIndices(position, geometry.index, matrixWorld);
    } else {
      const count = position.count;
      for (let i = 0; i < count; i += 3) {
        vA.fromBufferAttribute(position, i).applyMatrix4(matrixWorld);
        vB.fromBufferAttribute(position, i + 1).applyMatrix4(matrixWorld);
        vC.fromBufferAttribute(position, i + 2).applyMatrix4(matrixWorld);

        e1.subVectors(vB, vA);
        e2.subVectors(vC, vA);
        normal.crossVectors(e1, e2);

        if (normal.lengthSq() === 0) {
          continue;
        }

        normal.normalize();

        writeTriangle(vA, vB, vC, normal);
      }
    }
  });

  flushChunk();

  if (triangleCount === 0) {
    return { blob: null, reason: 'empty' };
  }

  if (triangleCount > 0xffffffff) {
    return { blob: null, reason: 'tooManyTriangles', triangleCount };
  }

  const totalBytes = 84 + triangleCount * 50;
  if (totalBytes > MAX_STL_BYTES) {
    return { blob: null, reason: 'fileTooLarge', triangleCount, bytes: totalBytes };
  }

  headerView.setUint32(80, triangleCount, true);

  return {
    blob: new Blob([header, ...chunks], { type: 'application/octet-stream' }),
    triangleCount,
    bytes: totalBytes
  };
}

// --- STL export ---
exportStlBtn.addEventListener('click', () => {
  if (placedPartsGroup.children.length === 0) {
    alert('No parts placed to export.');
    return;
  }

  const exportGroup = placedPartsGroup.clone(true);
  exportGroup.rotation.x = Math.PI / 2;
  exportGroup.updateMatrixWorld(true);

  const result = createStlBlobFromGroup(exportGroup);
  if (!result || !result.blob) {
    let message = 'Failed to export STL. Please ensure the layout contains valid geometry.';
    if (result) {
      if (result.reason === 'fileTooLarge') {
        const approxMb = (result.bytes / (1024 * 1024)).toFixed(1);
        message = `The exported STL would be approximately ${approxMb} MB, which is too large to generate in the browser. Try removing or simplifying some parts before exporting.`;
      } else if (result.reason === 'tooManyTriangles') {
        message = 'The layout has more triangles than the STL format supports. Try simplifying the scene before exporting.';
      } else if (result.reason === 'empty') {
        message = 'Unable to export because no valid geometry was found.';
      }
    }
    alert(message);
    return;
  }
  const url = URL.createObjectURL(result.blob);

  const a = document.createElement('a');
  a.href = url;
  const defaultName = 'layout';
  const inputName = prompt('Enter a name for the exported STL file:', defaultName);
  if (inputName === null) {
    URL.revokeObjectURL(url);
    return;
  }

  const trimmed = inputName.trim() || defaultName;
  let sanitizedBase = trimmed
    .replace(/\.stl$/iu, '')
    .replace(/[\\/:*?"<>|]/g, '_');
  if (!sanitizedBase) {
    sanitizedBase = defaultName;
  }
  a.download = `${sanitizedBase}.stl`;
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

updateTransformSnapping();
setAdvancedMode(false); // start in basic mode
resetHistory();
pushHistory();
updateHistoryButtons();
