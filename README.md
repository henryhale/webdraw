<p align="center">
  <img src="https://raw.githubusercontent.com/henryhale/webdraw/master/docs/public/logo.svg" alt="Webdraw logo" width="96" height="96">
</p>

<h1 align="center">Webdraw</h1>

<p align="center">
  A drawing editor exposed as the <code>&lt;web-draw&gt;</code> web component.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/webdraw"><img src="https://img.shields.io/npm/v/webdraw.svg" alt="npm version"></a>
  <a href="https://github.com/henryhale/webdraw/releases"><img src="https://img.shields.io/github/v/release/henryhale/webdraw.svg" alt="latest release"></a>
  <a href="https://github.com/henryhale/webdraw/actions/workflows/pages.yml"><img src="https://github.com/henryhale/webdraw/actions/workflows/pages.yml/badge.svg" alt="docs deployment"></a>
  <a href="https://github.com/henryhale/webdraw/blob/master/LICENSE.txt"><img src="https://img.shields.io/npm/l/webdraw.svg" alt="license"></a>
</p>

## Quick start

```bash
npm install webdraw
```

Import the component and its stylesheet, then give the element a height:

```js
import "webdraw";
import "webdraw/style.css";
```

```html
<style>
  web-draw {
    display: block;
    height: 600px;
  }
</style>

<web-draw id="drawing" storage-key="my-drawing-library"></web-draw>
```

Set `theme="light"` or `theme="dark"`, `view-mode`, `zen-mode`, or `grid-mode` as needed.

## Documentation

Full guides, the JavaScript API, and a live playground: **[henryhale.github.io/webdraw](https://henryhale.github.io/webdraw)**

## Library

The library button is shown by default. Set `library-enabled="off"` to hide it and `library-enabled="on"` to show it. Pass reusable components through the `library` attribute as a JSON array. Each item has an `elements` array of Webdraw scene elements and may have a `name` and `id`. For example, after drawing a shape:

```js
const drawing = document.querySelector("web-draw");
const shape = drawing.getSceneElements()[0];
drawing.setAttribute(
  "library",
  JSON.stringify([{ name: "My shape", elements: [shape] }]),
);
```

`storage-key` chooses the localStorage key for library edits; it defaults to `webdraw-library`. A supplied `library` attribute takes precedence when loaded or changed. Removing it loads the saved library. Set `storage-key=""` to leave persistence to the host.

## Events and API

Listen for `webdraw-ready`, `webdraw-change` (scene elements, app state, and files), `webdraw-library-change` (library items), and `webdraw-error` (invalid library JSON or scene files). These events bubble and cross the component boundary. `getSceneElements()`, `getAppState()`, `updateScene()`, `addFiles()`, and `resetScene()` are available for programmatic use.

Webdraw saves scenes as `.webdraw` JSON files. Library items come from the `library` attribute or canvas selections.

## Credits

Webdraw is based on [Excalidraw](https://github.com/excalidraw/excalidraw) and adapts its work into a framework-agnostic web component. Thanks to the Excalidraw team and contributors for making that foundation open source.

## License

[MIT](./LICENSE.txt) &copy; [Henry Hale](https://github.com/henryhale)

Excalidraw, which Webdraw builds on, is also MIT licensed &copy; Excalidraw contributors.
