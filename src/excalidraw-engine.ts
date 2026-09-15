import {
  Scene,
  LinearElementEditor,
  addNewNodes,
  cropElement,
  dragSelectedElements,
  dragNewElement,
  duplicateElements,
  getBoundTextElement,
  getElementsWithinSelection,
  getElementsInGroup,
  getFrameLikeElements,
  getCommonFrameId,
  getElementsInResizingFrame,
  getContainingFrame,
  getElementsInNewFrame,
  getElementAbsoluteCoords,
  getElementBounds,
  getCommonBoundingBox,
  hitElementItself,
  addElementsToFrame,
  updateFrameMembershipOfSelectedElements,
  removeElementsFromFrame,
  replaceAllElementsInFrame,
  isElementInFrame,
  isCursorInFrame,
  getRootElements,
  addToGroup,
  removeFromSelectedGroups,
  syncMovedIndices,
  alignElements,
  isFlowchartNodeElement,
  moveAllLeft,
  moveAllRight,
  moveOneLeft,
  moveOneRight,
  newElement,
  newElementWith,
  newTextElement,
  redrawTextBoundingBox,
  renderElement,
  getTransformHandles,
  getTransformHandlesFromCoords,
  getSelectedElements,
  getContainerElement,
  getTextElementAngle,
  OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
  resizeMultipleElements,
  bindOrUnbindBindingElements,
  bindOrUnbindBindingElement,
  computeBucketFillPolygon,
  isBucketFillCompatible,
  isRestylableFill,
  fixBindingsAfterDeletion,
  isFrameLikeElement,
  newLinearElement,
  isArrowElement,
  transformElements,
  updateBoundElements,
} from "@excalidraw/element";
import { pointFrom, type GlobalPoint, type LocalPoint } from "@excalidraw/math";
import { FRAME_STYLE, arrayToMap, getSizeFromPoints } from "@excalidraw/common";
import type {
  ElementsMap,
  FileId,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type { ResizeHandle, Point } from "./utils";
import type { TextAlign, VerticalAlign } from "./types";

export type ExcalidrawImageCache = Map<
  FileId,
  { image: HTMLImageElement | Promise<HTMLImageElement>; mimeType: string }
>;

const elementsMap = (elements: readonly NonDeletedExcalidrawElement[]) =>
  new Map(elements.map((element) => [element.id, element])) as ElementsMap &
    NonDeletedSceneElementsMap;

export const elementBounds = (
  element: NonDeletedExcalidrawElement,
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const [x1, y1, x2, y2] = getElementBounds(element, elementsMap(elements));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

export const hitElements = (
  point: Point,
  elements: readonly NonDeletedExcalidrawElement[],
  threshold: number,
) => {
  const map = elementsMap(elements);
  const globalPoint = pointFrom<GlobalPoint>(point.x, point.y);
  return [...elements]
    .reverse()
    .filter((element) =>
      hitElementItself({
        point: globalPoint,
        element,
        threshold,
        elementsMap: map,
      }),
    );
};

export const selectElementsWithinExcalidraw = (
  rect: { start: Point; end: Point },
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const selection = newElement({
    type: "selection",
    x: rect.start.x,
    y: rect.start.y,
    width: rect.end.x - rect.start.x,
    height: rect.end.y - rect.start.y,
  });
  const selected = getElementsWithinSelection(elements, selection, elementsMap(elements));
  const ids = new Set(selected.map((element) => element.id));
  for (const element of selected) {
    const groupId = element.groupIds.at(-1);
    if (groupId) for (const member of getElementsInGroup(elements, groupId)) ids.add(member.id);
  }
  return ids;
};

export const selectionTransformHandles = (
  selected: readonly NonDeletedExcalidrawElement[],
  elements: readonly NonDeletedExcalidrawElement[],
  zoom: number,
) => {
  if (!selected.length) return {};
  return selected.length === 1
    ? getTransformHandles(selected[0], { value: zoom } as never, elementsMap(elements), "mouse")
    : (() => {
        const box = getCommonBoundingBox(selected);
        return getTransformHandlesFromCoords(
          [box.minX, box.minY, box.maxX, box.maxY, box.midX, box.midY],
          0 as never,
          { value: zoom } as never,
          "mouse",
          OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
        );
      })();
};

export const selectionTransformHandleAt = (
  point: Point,
  selected: readonly NonDeletedExcalidrawElement[],
  elements: readonly NonDeletedExcalidrawElement[],
  zoom: number,
) => {
  const handles = selectionTransformHandles(selected, elements, zoom);
  for (const [name, bounds] of Object.entries(handles)) {
    if (!bounds) continue;
    const [x1, y1, x2, y2] = bounds;
    if (point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2) {
      return name === "rotation" ? "rotate" : (name as ResizeHandle);
    }
  }
  return null;
};

export const commonBounds = (elements: readonly NonDeletedExcalidrawElement[]) => {
  const box = getCommonBoundingBox(elements);
  return { x: box.minX, y: box.minY, width: box.width, height: box.height };
};

export const elementTransformHandles = (
  element: NonDeletedExcalidrawElement,
  elements: readonly NonDeletedExcalidrawElement[],
  zoom: number,
) =>
  getTransformHandles(
    element,
    { value: zoom } as never,
    elementsMap(elements),
    "mouse",
  );

export const elementAbsoluteBox = (
  element: NonDeletedExcalidrawElement,
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
    element,
    elementsMap(elements),
  );
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1, cx, cy };
};

export const linearPointIndexAt = (
  point: Point,
  element: Extract<NonDeletedExcalidrawElement, { type: "line" | "arrow" }>,
  elements: readonly NonDeletedExcalidrawElement[],
  zoom: number,
) =>
  LinearElementEditor.getPointIndexUnderCursor(
    element,
    elementsMap(elements) as NonDeletedSceneElementsMap,
    { value: zoom } as never,
    point.x,
    point.y,
  );

export const moveLinearPointWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  elementId: string,
  pointIndex: number,
  point: Point,
) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  const element = scene.getNonDeletedElementsMap().get(elementId);
  if (!element || (element.type !== "line" && element.type !== "arrow")) {
    return [...scene.getNonDeletedElements()];
  }
  const localPoint = LinearElementEditor.pointFromAbsoluteCoords(
    element,
    pointFrom(point.x, point.y),
    scene.getNonDeletedElementsMap(),
  );
  LinearElementEditor.movePoints(
    element,
    scene,
    new Map([[pointIndex, { point: localPoint }]]),
  );
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const appendLinearPointWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  elementId: string,
  point: Point,
) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  const element = scene.getNonDeletedElementsMap().get(elementId);
  if (!element || (element.type !== "line" && element.type !== "arrow")) return [...scene.getNonDeletedElements()];
  const local = LinearElementEditor.pointFromAbsoluteCoords(
    element,
    pointFrom(point.x, point.y),
    scene.getNonDeletedElementsMap(),
  );
  LinearElementEditor.addPoints(element, scene, [local]);
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const finishLinearWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  elementId: string,
) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  const element = scene.getNonDeletedElementsMap().get(elementId);
  if (!element || (element.type !== "line" && element.type !== "arrow")) return [...scene.getNonDeletedElements()];
  LinearElementEditor.deletePoints(
    element,
    { scene, state: { selectedLinearElement: { isEditing: true, lastUncommittedPoint: element.points.at(-1) } } } as never,
    [element.points.length - 1],
  );
  return scene.getNonDeletedElements().filter((candidate) => candidate.id !== elementId || element.points.length > 1) as NonDeletedExcalidrawElement[];
};

export const extendFreeDrawWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  elementId: string,
  point: Point,
) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  const element = scene.getNonDeletedElementsMap().get(elementId);
  if (element?.type === "freedraw") {
    scene.mutateElement(element, { points: [...element.points, pointFrom<LocalPoint>(point.x - element.x, point.y - element.y)] });
  }
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const linearPoints = (
  element: Extract<NonDeletedExcalidrawElement, { type: "line" | "arrow" }>,
  elements: readonly NonDeletedExcalidrawElement[],
) => LinearElementEditor.getPointsGlobalCoordinates(element, elementsMap(elements));

export const textElementAngle = (
  element: Extract<NonDeletedExcalidrawElement, { type: "text" }>,
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const map = elementsMap(elements);
  return getTextElementAngle(element, getContainerElement(element, map));
};

export const renderExcalidrawElements = ({
  elements,
  context,
  roughCanvas,
  imageCache,
  theme,
  zoom,
  scrollX,
  scrollY,
  canvasBackgroundColor,
  selectedIds = new Set<string>(),
  editingTextId,
  isExporting = false,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  context: CanvasRenderingContext2D;
  roughCanvas: RoughCanvas;
  imageCache: ExcalidrawImageCache;
  theme: "light" | "dark";
  zoom: number;
  scrollX: number;
  scrollY: number;
  canvasBackgroundColor: string;
  selectedIds?: ReadonlySet<string>;
  editingTextId?: string;
  isExporting?: boolean;
}) => {
  const map = elementsMap(elements);
  const selectedElementIds = Object.fromEntries(
    [...selectedIds].map((id) => [id, true]),
  );
  const appState = {
    zoom: { value: zoom },
    scrollX,
    scrollY,
    selectedElementIds,
    hoveredElementIds: {},
    theme,
    openDialog: null,
    croppingElementId: null,
    frameToHighlight: null,
    frameRendering: { enabled: true, clip: true, name: true, outline: true },
  } as never;
  const renderConfig = {
    canvasBackgroundColor,
    imageCache,
    renderGrid: false,
    renderLinks: false,
    isExporting,
    embedsValidationStatus: new Map(),
    elementsPendingErasure: new Set(),
    pendingFlowchartNodes: null,
    theme,
  } as never;

  for (const element of elements) {
    if (element.type === "text" && element.containerId) continue;
    if (element.id === editingTextId) continue;
    context.save();
    const frame = !isExporting && element.frameId ? getContainingFrame(element, map) : null;
    if (frame) {
      context.translate(frame.x + scrollX, frame.y + scrollY);
      context.beginPath();
      context.roundRect(0, 0, frame.width, frame.height, FRAME_STYLE.radius / zoom);
      context.clip();
      context.translate(-(frame.x + scrollX), -(frame.y + scrollY));
    }
    renderElement(element, map as never, map, roughCanvas, context, renderConfig, appState);
    const label = getBoundTextElement(element, map);
    if (label && label.id !== editingTextId) {
      renderElement(label, map as never, map, roughCanvas, context, renderConfig, appState);
    }
    context.restore();
  }
};

export const transformElementsWithExcalidraw = ({
  elements,
  selectedIds,
  originals,
  handle,
  point,
  maintainAspectRatio,
  resizeFromCenter,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  selectedIds: ReadonlySet<string>;
  originals: Map<string, NonDeletedExcalidrawElement>;
  handle: ResizeHandle | "rotate";
  point: Point;
  maintainAspectRatio: boolean;
  resizeFromCenter: boolean;
}) => {
  const nextElements = structuredClone(elements) as NonDeletedExcalidrawElement[];
  const scene = new Scene(nextElements, { skipValidation: true });
  const selected = scene.getNonDeletedElements().filter((element) => selectedIds.has(element.id));
  const box = getCommonBoundingBox([...originals.values()].filter((element) => selectedIds.has(element.id)));
  transformElements(
    originals,
    handle === "rotate" ? "rotation" : handle,
    selected,
    scene,
    maintainAspectRatio,
    resizeFromCenter,
    maintainAspectRatio,
    point.x,
    point.y,
    box.midX,
    box.midY,
  );
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const cropImageWithExcalidraw = ({
  elements,
  original,
  handle,
  point,
  naturalWidth,
  naturalHeight,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  original: Extract<NonDeletedExcalidrawElement, { type: "image" }>;
  handle: ResizeHandle;
  point: Point;
  naturalWidth: number;
  naturalHeight: number;
}) => {
  const map = elementsMap(elements);
  const updates = cropElement(
    original,
    map,
    handle,
    naturalWidth,
    naturalHeight,
    point.x,
    point.y,
  );
  return elements.map((element) =>
    element.id === original.id ? newElementWith(original, updates) : element,
  );
};

export const commitTextWithExcalidraw = ({
  elements,
  elementId,
  containerId,
  point,
  text,
  strokeColor,
  fontSize,
  fontFamily,
  textAlign,
  verticalAlign,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  elementId?: string;
  containerId?: string;
  point: Point;
  text: string;
  strokeColor: string;
  fontSize: number;
  fontFamily: number;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
}) => {
  let next = structuredClone(elements) as NonDeletedExcalidrawElement[];
  let textElement = elementId
    ? next.find((element) => element.id === elementId && element.type === "text")
    : undefined;

  if (!textElement) {
    textElement = newTextElement({
      x: point.x,
      y: point.y,
      text,
      strokeColor,
      fontSize,
      fontFamily: fontFamily as never,
      containerId: containerId ?? null,
      textAlign,
      verticalAlign,
      autoResize: true,
    });
    next.push(textElement);
    if (containerId) {
      next = next.map((element) =>
        element.id === containerId
          ? newElementWith(element, {
              boundElements: [
                ...(element.boundElements ?? []).filter(
                  (binding) => binding.type !== "text",
                ),
                { id: textElement!.id, type: "text" },
              ],
            })
          : element,
      );
    }
  }

  const scene = new Scene(next, { skipValidation: true });
  const liveText = scene.getNonDeletedElementsMap().get(textElement.id);
  if (!liveText || liveText.type !== "text") return next;
  const container = containerId
    ? scene.getNonDeletedElementsMap().get(containerId) ?? null
    : null;
  scene.mutateElement(liveText, {
    text,
    originalText: text,
    strokeColor,
    fontSize,
    fontFamily: fontFamily as never,
    textAlign,
    verticalAlign,
    containerId: containerId ?? null,
  });
  redrawTextBoundingBox(liveText, container, scene);
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const replaceElementWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  replacement: NonDeletedExcalidrawElement,
) => {
  const scene = new Scene(
    elements.map((element) =>
      element.id === replacement.id ? replacement : structuredClone(element),
    ),
    { skipValidation: true },
  );
  const changed = scene.getNonDeletedElementsMap().get(replacement.id);
  if (!changed) return [...scene.getNonDeletedElements()];
  updateBoundElements(changed, scene);
  const label = getBoundTextElement(changed, scene.getNonDeletedElementsMap());
  if (label) redrawTextBoundingBox(label, changed, scene);
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const updateTextStylesWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  textIds: ReadonlySet<string>,
  patch: Partial<{
    fontSize: number;
    fontFamily: number;
    textAlign: TextAlign;
    verticalAlign: VerticalAlign;
  }>,
) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  for (const id of textIds) {
    const text = scene.getNonDeletedElementsMap().get(id);
    if (!text || text.type !== "text") continue;
    scene.mutateElement(text, patch as never);
    const container = text.containerId
      ? scene.getNonDeletedElementsMap().get(text.containerId) ?? null
      : null;
    redrawTextBoundingBox(text, container, scene);
  }
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const createFlowchartNodeWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  sourceId: string,
  direction: "up" | "right" | "down" | "left",
  endArrowhead: string | null,
) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  const source = scene.getNonDeletedElementsMap().get(sourceId);
  if (!source || !isFlowchartNodeElement(source)) return null;
  const { nodes } = addNewNodes(
    source,
    { currentItemEndArrowhead: endArrowhead } as never,
    direction,
    scene,
    1,
  );
  scene.replaceAllElements([...scene.getNonDeletedElements(), ...nodes], {
    skipValidation: true,
  });
  return {
    elements: [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[],
    nodeId: nodes.find((element) => element.type !== "arrow")?.id,
  };
};

export const dragElementsWithExcalidraw = ({
  elements,
  selectedIds,
  originals,
  offset,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  selectedIds: ReadonlySet<string>;
  originals: Map<string, NonDeletedExcalidrawElement>;
  offset: Point;
}) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  const selected = scene
    .getNonDeletedElements()
    .filter((element) => selectedIds.has(element.id));
  dragSelectedElements(
    { originalElements: originals } as never,
    selected,
    offset,
    scene,
    { x: 0, y: 0 },
    null,
  );
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const dragNewShapeWithExcalidraw = ({
  elements,
  elementId,
  origin,
  point,
  maintainAspectRatio,
  resizeFromCenter,
  zoom,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  elementId: string;
  origin: Point;
  point: Point;
  maintainAspectRatio: boolean;
  resizeFromCenter: boolean;
  zoom: number;
}) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  const element = scene.getNonDeletedElementsMap().get(elementId);
  if (!element) return [...scene.getNonDeletedElements()];
  dragNewElement({
    newElement: element,
    elementType: element.type as never,
    originX: origin.x,
    originY: origin.y,
    x: point.x,
    y: point.y,
    width: Math.abs(point.x - origin.x),
    height: Math.abs(point.y - origin.y),
    shouldMaintainAspectRatio: maintainAspectRatio,
    shouldResizeFromCenter: resizeFromCenter,
    zoom: zoom as never,
    scene,
  });
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const addChildrenToNewFrameWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  frameId: string,
) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  const frame = scene.getNonDeletedElementsMap().get(frameId);
  if (!frame || frame.type !== "frame") return [...scene.getNonDeletedElements()];
  const children = getElementsInNewFrame(
    scene.getElementsIncludingDeleted(),
    frame,
    scene.getNonDeletedElementsMap(),
  );
  return addElementsToFrame(
    [...scene.getNonDeletedElements()],
    children,
    frame,
  ) as NonDeletedExcalidrawElement[];
};

export const reconcileFrameMembershipWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  ids: ReadonlySet<string>,
  point: Point,
  mode: "move" | "resize",
) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  let next = [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
  const selectedElementIds = Object.fromEntries([...ids].map((id) => [id, true as const])) as Record<string, true>;
  const selected = scene.getSelectedElements({ selectedElementIds });
  const map = scene.getNonDeletedElementsMap();
  const framesUnderCursor = getFrameLikeElements(next).filter(
    (frame) => !frame.locked && isCursorInFrame(point, frame as never, map),
  );
  let topFrame = framesUnderCursor.at(-1) ?? null;
  if (topFrame) {
    const hit = hitElements(point, next, 0).find((element) => !ids.has(element.id));
    if (hit && hit.type !== "frame") {
      const hitIndex = next.findIndex((element) => element.id === hit.id);
      const frameIndex = next.findIndex((element) => element.id === topFrame!.id);
      if (hitIndex > frameIndex) {
        const currentFrameId = getCommonFrameId(selected);
        topFrame = framesUnderCursor.find((frame) => frame.id === currentFrameId) ??
          framesUnderCursor.find((frame) => frame.id === hit.frameId) ?? null;
      }
    }
  }
  const state = {
    ...selectionAppState(ids),
    selectedElementsAreBeingDragged: mode === "move",
    frameToHighlight: topFrame,
  } as never;
  if (mode === "move" && topFrame && !ids.has(topFrame.id)) {
    const toAdd = selected.filter((element) => isElementInFrame(element, map, state, { targetFrame: topFrame! }));
    next = addElementsToFrame(next, toAdd, topFrame) as NonDeletedExcalidrawElement[];
  }
  next = updateFrameMembershipOfSelectedElements(next, state, { scene } as never) as NonDeletedExcalidrawElement[];
  if (mode === "resize") {
    for (const frame of selected.filter(isFrameLikeElement)) {
      next = replaceAllElementsInFrame(
        next,
        getElementsInResizingFrame(next, frame, state, arrayToMap(next)),
        frame,
      ) as NonDeletedExcalidrawElement[];
    }
  }
  return next;
};

export const duplicateElementsWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  ids: ReadonlySet<string>,
) => {
  const selected = new Map(
    elements.filter((element) => ids.has(element.id)).map((element) => [element.id, element]),
  );
  const result = duplicateElements({
    type: "in-place",
    elements,
    idsOfElementsToDuplicate: selected,
    appState: { editingGroupId: null, selectedGroupIds: {} },
    overrides: ({ duplicateElement }) => ({
      x: duplicateElement.x + 20,
      y: duplicateElement.y + 20,
    }),
  });
  return {
    elements: result.elementsWithDuplicates as NonDeletedExcalidrawElement[],
    idMap: result.origIdToDuplicateId,
  };
};

export const duplicateExternalElementsWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
) =>
  duplicateElements({
    type: "everything",
    elements,
    overrides: ({ duplicateElement }) => ({
      x: duplicateElement.x + 20,
      y: duplicateElement.y + 20,
    }),
  }).duplicatedElements;

export const selectedElementsWithBindings = (
  elements: readonly NonDeletedExcalidrawElement[],
  ids: ReadonlySet<string>,
) =>
  getSelectedElements(elements, selectionAppState(ids) as never, {
    includeBoundTextElement: true,
    includeElementsInFrames: true,
  });

export const updateElementsWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  ids: ReadonlySet<string>,
  patch: Record<string, unknown>,
) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  for (const element of scene.getNonDeletedElements()) {
    if (!ids.has(element.id)) continue;
    scene.mutateElement(element, patch as never);
    updateBoundElements(element, scene);
  }
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const groupElementsWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  ids: ReadonlySet<string>,
  groupId: string,
) => {
  const selected = getRootElements(getSelectedElements(elements, selectionAppState(ids) as never, { includeBoundTextElement: true }));
  if (selected.length < 2) return [...elements];
  const selectedIds = new Set(selected.map((element) => element.id));
  const frameIds = new Set(selected.map((element) => element.frameId));
  const next = structuredClone(elements) as NonDeletedExcalidrawElement[];
  const scene = new Scene(next, { skipValidation: true });
  if (frameIds.size > 1) {
    removeElementsFromFrame(
      next.filter((element) => selectedIds.has(element.id) && element.frameId),
      scene.getNonDeletedElementsMap(),
    );
  }
  for (const element of scene.getNonDeletedElements()) {
    if (selectedIds.has(element.id)) scene.mutateElement(element, { groupIds: addToGroup(element.groupIds, groupId, null) });
  }
  const grouped = next.filter((element) => element.groupIds.includes(groupId));
  const lastIndex = next.lastIndexOf(grouped.at(-1)!);
  const reordered = syncMovedIndices(
    [...next.slice(0, lastIndex).filter((element) => !selectedIds.has(element.id)), ...grouped, ...next.slice(lastIndex + 1)],
    arrayToMap(grouped),
  );
  return reordered as NonDeletedExcalidrawElement[];
};

export const ungroupElementsWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  ids: ReadonlySet<string>,
) => {
  const selectedGroupIds = Object.fromEntries(
    elements.filter((element) => ids.has(element.id)).flatMap((element) => element.groupIds.at(-1) ? [[element.groupIds.at(-1)!, true]] : []),
  );
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  for (const element of scene.getNonDeletedElements()) {
    const groupIds = removeFromSelectedGroups(element.groupIds, selectedGroupIds);
    if (groupIds.length !== element.groupIds.length) scene.mutateElement(element, { groupIds });
  }
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

const selectionAppState = (ids: ReadonlySet<string>) => ({
  selectedElementIds: Object.fromEntries([...ids].map((id) => [id, true])),
  selectedGroupIds: {},
  editingGroupId: null,
});

export const alignElementsWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  ids: ReadonlySet<string>,
  alignment: { axis: "x" | "y"; position: "start" | "center" | "end" },
) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  const selected = scene.getNonDeletedElements().filter((element) => ids.has(element.id));
  alignElements(selected, alignment, scene, selectionAppState(ids) as never);
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const moveElementsInLayerWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  ids: ReadonlySet<string>,
  action: "backward" | "forward" | "back" | "front",
) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  const state = selectionAppState(ids) as never;
  const current = scene.getElementsIncludingDeleted();
  const next =
    action === "backward"
      ? moveOneLeft(current, state, scene)
      : action === "forward"
        ? moveOneRight(current, state, scene)
        : action === "back"
          ? moveAllLeft(current, state)
          : moveAllRight(current, state);
  scene.replaceAllElements(next, { skipValidation: true });
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const flipElementsWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  ids: ReadonlySet<string>,
  direction: "horizontal" | "vertical",
) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  const state = {
    ...selectionAppState(ids),
    isBindingEnabled: true,
    isMidpointSnappingEnabled: true,
    bindMode: undefined,
    zoom: { value: 1 },
    gridModeEnabled: false,
    gridSize: null,
    selectedLinearElement: null,
  } as never;
  const selected = getSelectedElements(scene.getNonDeletedElements(), state, {
    includeBoundTextElement: true,
    includeElementsInFrames: true,
  });
  if (selected.every((element) => isArrowElement(element) && (element.startBinding || element.endBinding))) {
    for (const element of selected) {
      if (isArrowElement(element)) scene.mutateElement(element, { startArrowhead: element.endArrowhead, endArrowhead: element.startArrowhead });
    }
    return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
  }
  const before = getCommonBoundingBox(selected);
  const originals = new Map(scene.getNonDeletedElements().map((element) => [element.id, structuredClone(element)]));
  resizeMultipleElements(selected, scene.getNonDeletedElementsMap(), "nw", scene, originals, {
    flipByX: direction === "horizontal",
    flipByY: direction === "vertical",
    shouldResizeFromCenter: true,
    shouldMaintainAspectRatio: true,
  });
  bindOrUnbindBindingElements(selected.filter(isArrowElement), scene, state);
  const after = getCommonBoundingBox(selected);
  for (const element of selected) {
    scene.mutateElement(element, { x: element.x + before.midX - after.midX, y: element.y + before.midY - after.midY });
  }
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const bindArrowEndpointWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  arrowId: string,
  endpoint: "start" | "end",
  zoom: number,
  initialBinding = false,
) => {
  const scene = new Scene(structuredClone(elements), { skipValidation: true });
  const arrow = scene.getNonDeletedElementsMap().get(arrowId);
  if (!arrow || arrow.type !== "arrow") return [...scene.getNonDeletedElements()];
  const index = endpoint === "start" ? 0 : arrow.points.length - 1;
  const globalPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    arrow as never,
    index,
    scene.getNonDeletedElementsMap(),
  );
  const origin = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    arrow as never,
    0,
    scene.getNonDeletedElementsMap(),
  );
  bindOrUnbindBindingElement(
    arrow as never,
    new Map([[index, { point: arrow.points[index] }]]),
    globalPoint[0],
    globalPoint[1],
    scene,
    {
      isBindingEnabled: true,
      isMidpointSnappingEnabled: true,
      bindMode: undefined,
      zoom: { value: zoom },
      gridModeEnabled: false,
      gridSize: null,
      selectedLinearElement: {
        initialState: {
          origin,
          arrowOtherEndpointInitialBinding: null,
          altFocusPoint: null,
        },
      },
    } as never,
    { newArrow: true, initialBinding },
  );
  return [...scene.getNonDeletedElements()] as NonDeletedExcalidrawElement[];
};

export const fillRegionWithExcalidraw = ({
  elements,
  point,
  backgroundColor,
  fillStyle,
  opacity,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  point: Point;
  backgroundColor: string;
  fillStyle: "hachure" | "cross-hatch" | "solid" | "zigzag";
  opacity: number;
}) => {
  const map = elementsMap(elements);
  const globalPoint = pointFrom<GlobalPoint>(point.x, point.y);
  const result = computeBucketFillPolygon({ point: globalPoint, elements, elementsMap: map });
  const hit = hitElements(point, elements, 0)[0];
  if (!result.ok) {
    if (!hit || !isBucketFillCompatible(hit)) return null;
    return elements.map((element) => element.id === hit.id ? newElementWith(element, { backgroundColor, fillStyle, opacity }) : element);
  }
  if (hit && isRestylableFill({ hitElement: hit, scenePoints: result.scenePoints, elementsMap: map })) {
    return elements.map((element) => element.id === hit.id ? newElementWith(element, { backgroundColor, fillStyle, opacity }) : element);
  }
  const [originX, originY] = result.scenePoints[0];
  const { width, height } = getSizeFromPoints(result.scenePoints);
  const owner = result.ownerId ? map.get(result.ownerId) : null;
  const frameId = owner
    ? (isFrameLikeElement(owner) ? owner.id : owner.frameId)
    : getFrameLikeElements(elements).filter((frame) => !frame.locked && isCursorInFrame(point, frame as never, map)).at(-1)?.id ?? null;
  const groupIds = owner?.groupIds ?? result.boundaryElementIds
    .map((id) => map.get(id)?.groupIds)
    .filter((ids): ids is string[] => !!ids)
    .reduce<string[] | null>((common, ids) => common === null ? ids : common.filter((id) => ids.includes(id)), null) ?? [];
  const fill = newLinearElement({
    type: "line",
    x: originX,
    y: originY,
    width,
    height,
    points: result.scenePoints.map((candidate) => pointFrom(candidate[0] - originX, candidate[1] - originY)) as never,
    polygon: true,
    strokeColor: "transparent",
    backgroundColor,
    fillStyle,
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    roundness: null,
    opacity,
    frameId,
    groupIds,
  });
  const anchor = elements.findIndex((element) => element.id === result.insertion.elementId);
  const index = anchor < 0 ? elements.length : result.insertion.placement === "above" ? anchor + 1 : anchor;
  return [...elements.slice(0, index), fill, ...elements.slice(index)];
};

export const removeElementsWithExcalidraw = (
  elements: readonly NonDeletedExcalidrawElement[],
  initialIds: ReadonlySet<string>,
) => {
  const next = structuredClone(elements) as NonDeletedExcalidrawElement[];
  const ids = new Set(initialIds);
  for (const element of next) {
    if (!ids.has(element.id)) continue;
    for (const binding of element.boundElements ?? []) {
      if (binding.type === "text") ids.add(binding.id);
    }
  }
  const deleted = next.filter((element) => ids.has(element.id));
  fixBindingsAfterDeletion(next, deleted);
  return { elements: next.filter((element) => !ids.has(element.id)), deletedIds: ids };
};

if (import.meta.env.DEV) {
  const rectangle = newElement({ type: "rectangle", x: 1, y: 2, width: 3, height: 4 });
  console.assert(
    elementBounds(rectangle, [rectangle]).width === 3,
  );
  console.assert(
    selectElementsWithinExcalidraw({ start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }, [rectangle]).has(rectangle.id),
  );
}
