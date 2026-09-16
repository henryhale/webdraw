# JavaScript properties

Set properties when values come from application state. Attribute-backed properties reflect the same configuration exposed in HTML.

```js
const drawing = document.querySelector("web-draw");
```

## `theme`

Set the theme to `"auto"`, `"light"`, or `"dark"`.

```js
drawing.theme = "dark";
```

<WebdrawDemo demo="theme-property" />

## `viewModeEnabled`

Set a boolean to control read-only viewing.

```js
drawing.viewModeEnabled = true;
```

<WebdrawDemo demo="view-mode-property" />

## `zenModeEnabled`

Set a boolean to hide or restore the main editor controls.

```js
drawing.zenModeEnabled = true;
```

<WebdrawDemo demo="zen-mode-property" />

## `gridModeEnabled`

Set a boolean to show or hide the grid.

```js
drawing.gridModeEnabled = true;
```

<WebdrawDemo demo="grid-mode-property" />

## `library`

Assign the same JSON string accepted by the `library` attribute. Assign `"[]"` to clear it or `null` to fall back to `storageKey`.

```js
drawing.library = JSON.stringify([
  { id: "box", name: "Box", elements: [savedRectangle] },
]);
```

<WebdrawDemo demo="library-property" />

## `storageKey`

Assign a localStorage key. Use an empty string when the host application handles persistence.

```js
drawing.storageKey = "account-42-library";
```

<WebdrawDemo demo="storage-key-property" />

## `initialData`

Set the initial scene after creating the component. It accepts `elements`, `files`, and a subset of application state.

```js
drawing.initialData = {
  elements,
  files,
  appState: {
    theme: "light",
    viewBackgroundColor: "#fff9db",
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    currentItemRoundness: "round",
  },
};
```

<WebdrawDemo demo="initial-data" />

## `elements`

Assign an array to replace the rendered scene elements directly. Prefer `updateScene()` when files or application state must change at the same time.

```js
drawing.elements = nextElements;
```

<WebdrawDemo demo="elements" />
