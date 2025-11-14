export function createDomRefs() {
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
  const stackingModeBtn = document.getElementById('stackingModeBtn');
  const stackingModeIcon = stackingModeBtn
    ? stackingModeBtn.querySelector('.material-symbols-outlined')
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
  const snapTranslateHorizontalInput = document.getElementById('snapTranslateHorizontalInput');
  const snapTranslateVerticalInput = document.getElementById('snapTranslateVerticalInput');
  const snapRotateInput = document.getElementById('snapRotateInput');

  const selectModeBtn = document.getElementById('selectModeBtn');
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

  if (selectModeBtn) {
    selectModeBtn.setAttribute('aria-pressed', 'false');
  }

  const sidebarResizeHandle = document.getElementById('sidebarResizeHandle');

  const selectionContextMenu = document.getElementById('selectionContextMenu');
  const contextCreateTemplateBtn = document.getElementById('contextCreateTemplate');
  const contextCopySelectionBtn = document.getElementById('contextCopySelection');
  const contextDeleteSelectionBtn = document.getElementById('contextDeleteSelection');

  return {
    container,
    sidebar,
    menuButton,
    undoButton,
    helpButton,
    advancedModeButton,
    bottomControls,
    basicControls,
    advancedControls,
    gridControls,
    gridSnapBtn,
    gridSnapIcon,
    stackingModeBtn,
    stackingModeIcon,
    rotateLeftBtn,
    rotateRightBtn,
    rotationModeBtn,
    rotationModeIcon,
    helpOverlay,
    helpCloseBtn,
    fileInput,
    importBtn,
    exportStlBtn,
    fileNameLabel,
    partsList,
    scenePanel,
    sceneResizeHandle,
    sceneObjectsList,
    advancedPanel,
    advancedResizeHandle,
    advancedSelectionLabel,
    posXInput,
    posYInput,
    posZInput,
    rotXInput,
    rotYInput,
    rotZInput,
    scaleXInput,
    scaleYInput,
    scaleZInput,
    flipXBtn,
    flipYBtn,
    flipZBtn,
    snapCellSizeInput,
    snapTranslateHorizontalInput,
    snapTranslateVerticalInput,
    snapRotateInput,
    selectModeBtn,
    moveModeBtn,
    rotateModeBtn,
    scaleModeBtn,
    measureModeBtn,
    measurementReadout,
    flipButtons,
    sidebarResizeHandle,
    selectionContextMenu,
    contextCreateTemplateBtn,
    contextCopySelectionBtn,
    contextDeleteSelectionBtn
  };
}
