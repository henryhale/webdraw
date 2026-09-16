# Attributes

Attributes are the shortest way to configure `<web-draw>` from HTML. Changes are reactive.

## `theme`

Choose `auto`, `light`, or `dark`. `auto` follows the operating-system preference and is the default.

```html
<web-draw theme="dark"></web-draw>
```

<WebdrawDemo demo="theme" />

## `view-mode`

Add `view-mode` to prevent drawing and editing while keeping navigation and viewing available. Remove the attribute to enable editing again.

```html
<web-draw view-mode></web-draw>
```

Try drawing before and after toggling the attribute.

<WebdrawDemo demo="view-mode" />

## `zen-mode`

Add `zen-mode` to hide most interface controls and focus on the canvas.

```html
<web-draw zen-mode></web-draw>
```

<WebdrawDemo demo="zen-mode" />

## `grid-mode`

Add `grid-mode` to display the drawing grid.

```html
<web-draw grid-mode></web-draw>
```

<WebdrawDemo demo="grid-mode" />

## `library`

Pass reusable components as a JSON array. Each item requires an `elements` array and may include `id` and `name`.

```js
const library = [
  {
    id: "service-box",
    name: "Service box",
    elements: [savedRectangle],
  },
];

drawing.setAttribute("library", JSON.stringify(library));
```

Load the example, then open **Library** in the canvas to see the reusable item.

<WebdrawDemo demo="library" />

Library elements must have string `id` and `type` fields. Images and embeds are rejected because their binary data is not part of a library item.

## `storage-key`

Choose where library edits are persisted in `localStorage`. The default is `webdraw-library`. An empty value disables built-in persistence.

```html
<web-draw storage-key="my-product-library"></web-draw>

<!-- The host will persist webdraw-library-change events. -->
<web-draw storage-key=""></web-draw>
```

The demo writes a library to a named key, then asks Webdraw to load that key.

<WebdrawDemo demo="storage-key" />
