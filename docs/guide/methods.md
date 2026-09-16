# Methods

Methods read or change a mounted Webdraw instance.

## `getSceneElements()`

Return the current non-deleted scene elements as a read-only array.

```js
const elements = drawing.getSceneElements();
```

<WebdrawDemo demo="get-elements" />

## `getAppState()`

Return the public editor state: theme, canvas background, zoom, scroll position, active tool, edge style, and selected IDs.

```js
const appState = drawing.getAppState();
```

<WebdrawDemo demo="get-state" />

## `updateScene(scene)`

Update any combination of elements, files, theme, canvas background, edge style, zoom, and scroll position. The method creates an undo checkpoint and emits `webdraw-change`.

```js
drawing.updateScene({
  elements: nextElements,
  appState: {
    viewBackgroundColor: "#e9f7ef",
    zoom: 1.25,
  },
});
```

<WebdrawDemo demo="update-scene" />

## `addFiles(files)`

Register binary files used by image elements. Each file needs an `id`, data URL, MIME type, and creation timestamp. Image elements refer to the same `id` through `fileId`.

```js
drawing.addFiles([
  {
    id: "logo-file",
    dataURL: "data:image/png;base64,...",
    mimeType: "image/png",
    created: Date.now(),
  },
]);
```

The demo registers a real one-pixel PNG and prints the supplied file record.

<WebdrawDemo demo="add-files" />

## `resetScene()`

Clear elements, binary files, the image cache, and the current selection. The method creates an undo checkpoint and emits `webdraw-change`.

```js
drawing.resetScene();
```

<WebdrawDemo demo="reset-scene" />
