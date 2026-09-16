# Webdraw

Webdraw is a drawing editor exposed as the `<web-draw>` web component.

```html
<web-draw
  id="drawing"
  library-enabled="on"
  storage-key="my-drawing-library"
></web-draw>
<script type="module" src="/src/webdraw.ts"></script>
```

The component needs a height from its container. Set `theme="light"` or `theme="dark"`, `view-mode`, `zen-mode`, or `grid-mode` as needed.

The library button is hidden by default. Set `library-enabled="on"` to show it and `library-enabled="off"` to hide it. Pass reusable components through the `library` attribute as a JSON array. Each item has an `elements` array of Webdraw scene elements and may have a `name` and `id`. For example, after drawing a shape:

```js
const drawing = document.querySelector("web-draw");
const shape = drawing.getSceneElements()[0];
drawing.setAttribute(
  "library",
  JSON.stringify([{ name: "My shape", elements: [shape] }]),
);
```

`storage-key` chooses the localStorage key for library edits; it defaults to `webdraw-library`. A supplied `library` attribute takes precedence when loaded or changed. Removing it loads the saved library. Set `storage-key=""` to leave persistence to the host.

Listen for `webdraw-ready`, `webdraw-change` (scene elements, app state, and files), `webdraw-library-change` (library items), and `webdraw-error` (invalid library JSON or scene files). These events bubble and cross the component boundary. `getSceneElements()`, `getAppState()`, `updateScene()`, `addFiles()`, and `resetScene()` are available for programmatic use.

Webdraw saves scenes as `.webdraw` JSON files. Library items come from the `library` attribute or canvas selections.

## Credits

Webdraw is based on [Excalidraw](https://github.com/excalidraw/excalidraw) and adapts its work into a framework-agnostic web component. Thanks to the Excalidraw team and contributors for making that foundation open source.
