---
layout: home

hero:
  name: Webdraw
  text: A drawing editor for the web
  tagline: Add a complete canvas with one framework-agnostic web component.
  image:
    src: /logo.svg
    alt: Webdraw logo
  actions:
    - theme: brand
      text: Start integrating
      link: /guide/attributes
    - theme: alt
      text: JavaScript API
      link: /guide/methods
    - theme: alt
      text: Open playground
      link: /playground
---

## Install and render

Install Webdraw, import the component and its stylesheet, then give the element a height.

```bash
pnpm add webdraw
```

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

<web-draw></web-draw>
```

The canvas below is the actual component. Draw something, switch its theme, or clear it.

<WebdrawDemo demo="quick-start" />

## Configure with HTML

Use attributes when configuration is known in markup. Boolean attributes are enabled by their presence.

```html
<web-draw theme="dark" grid-mode storage-key="diagram-library"></web-draw>
```

<WebdrawDemo demo="grid-mode" />

## Configure with JavaScript

Use properties and methods when configuration or scene data changes at runtime.

```js
const drawing = document.querySelector("web-draw");

drawing.theme = "light";
drawing.updateScene({
  appState: { viewBackgroundColor: "#e9f7ef", zoom: 1.2 },
});
```

<WebdrawDemo demo="update-scene" />

## React to edits

Webdraw uses bubbling, composed DOM events, so listeners work on the element or an ancestor.

```js
drawing.addEventListener("webdraw-change", ({ detail }) => {
  saveDiagram(detail);
});
```

Draw on the canvas, or use the button to produce the same event programmatically.

<WebdrawDemo demo="change-event" />

Continue with [attributes](/guide/attributes), [properties](/guide/properties), [methods](/guide/methods), and [events](/guide/events).

## Credits

Webdraw is based on [Excalidraw](https://github.com/excalidraw/excalidraw) and adapts its work into a framework-agnostic web component. Thanks to the Excalidraw team and contributors for making that foundation open source.
