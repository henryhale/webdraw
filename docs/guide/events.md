# Events

All Webdraw events bubble and cross the component boundary. Listen with the standard DOM event API.

## `webdraw-ready`

Fires after the canvas and resize observer are ready. Use it when setup must wait for the rendered editor.

```js
drawing.addEventListener("webdraw-ready", () => {
  console.log("Webdraw is ready");
});
```

Remount the demo to fire the event again.

<WebdrawDemo demo="ready-event" />

## `webdraw-change`

Fires after a scene edit or a public scene-changing method. `detail` contains `elements`, `appState`, and `files`.

```js
drawing.addEventListener("webdraw-change", ({ detail }) => {
  localStorage.setItem("diagram", JSON.stringify(detail));
});
```

<WebdrawDemo demo="change-event" />

## `webdraw-library-change`

Fires when the library loads or changes. Read the current items from `detail.libraryItems`. This is the persistence hook when `storage-key=""`.

```js
drawing.addEventListener("webdraw-library-change", ({ detail }) => {
  saveLibrary(detail.libraryItems);
});
```

<WebdrawDemo demo="library-change-event" />

## `webdraw-error`

Fires when Webdraw cannot parse library JSON or open a scene file. `detail` is the original error.

```js
drawing.addEventListener("webdraw-error", ({ detail }) => {
  showError(detail.message);
});
```

The demo deliberately passes invalid library JSON.

<WebdrawDemo demo="error-event" />
