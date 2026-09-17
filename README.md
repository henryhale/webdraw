<p align="center">
  <img src="https://raw.githubusercontent.com/henryhale/webdraw/master/docs/public/logo.svg" alt="Webdraw logo" width="96" height="96">
</p>

<h1 align="center">Webdraw</h1>

<p align="center">
  A drawing editor exposed as the <code>&lt;web-draw&gt;</code> web component.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/wdraw"><img src="https://img.shields.io/npm/v/wdraw.svg" alt="npm version"></a>
  <a href="https://github.com/henryhale/webdraw/releases"><img src="https://img.shields.io/github/v/release/henryhale/webdraw.svg" alt="latest release"></a>
  <a href="https://github.com/henryhale/webdraw/actions/workflows/pages.yml"><img src="https://github.com/henryhale/webdraw/actions/workflows/pages.yml/badge.svg" alt="docs deployment"></a>
  <a href="https://github.com/henryhale/webdraw/blob/master/LICENSE.txt"><img src="https://img.shields.io/github/license/henryhale/webdraw.svg" alt="license"></a>
</p>

## Quick start

```bash
npm install wdraw
```

Import the component and its stylesheet, then give the element a height:

```js
import "wdraw";
import "wdraw/style.css";
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

## Credits

Webdraw is based on [Excalidraw](https://github.com/excalidraw/excalidraw) and adapts its work into a framework-agnostic web component. Thanks to the Excalidraw team and contributors for making that foundation open source.

## License

[MIT](./LICENSE.txt) &copy; [Henry Hale](https://github.com/henryhale)

Excalidraw, which Webdraw builds on, is also MIT licensed &copy; Excalidraw contributors.
