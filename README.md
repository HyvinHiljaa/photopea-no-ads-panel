# Photopea No Ads Panel

An extension that removes Photopea's right-side ad panel along with the
320px of width reserved for it.

There are two builds in this repository:

| Folder | Browser | Manifest |
|---|---|---|
| `firefox/` | Firefox | MV2 |
| `chromium/` | Chrome / Brave / Edge / Chromium | MV3 |

Both builds do the same thing: they force Photopea's internal ad flag to
`true`, so the ad branch never runs.

## How the patch works

Photopea's app script (`code/pp/pp*.js`) contains this line:

```js
var K=eb.U$,D=!this.rX||this.uF()||!this.S.zB||hN.Dj()||...
```

The extension rewrites it to:

```js
var K=eb.U$,D=!0;
```

As a result:

- the right-side ad panel is never created,
- 320px is no longer cut from the UI width,
- ad scripts/iframes are not loaded.

Each build also ships a `style.css` fallback that hides the panel in case
the patch ever fails to match.

## Firefox (MV2, `firefox/`)

Uses `webRequest.filterResponseData` to patch the response in flight.
This API is Firefox-only.

### Load temporarily

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `firefox/manifest.json`.
4. Reload `photopea.com` with **Ctrl+Shift+R**.

### Build / publish

```bash
cd firefox
npm install -g web-ext
web-ext build
```

Submit the resulting zip on `addons.mozilla.org` for signing.

## Chrome / Brave (MV3, `chromium/`)

Chrome and Brave do not have `webRequest.filterResponseData`. The MV3 build
instead runs `chromium/inject.js` in the page's **MAIN world** at
`document_start`. It intercepts the `pp*.js` `<script>` element, fetches the
source, patches it, and inserts the patched version as an inline script.

Photopea ships no CSP, so inline scripts are allowed.

### Load temporarily in Chrome / Brave

1. Open `brave://extensions` (or `chrome://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `chromium/` folder.
5. Reload `photopea.com`.

You should see these logs in the page console:

```text
[Photopea No-Ads] Ad branch disabled
[Photopea No-Ads] Ad width reservation removed
[Photopea No-Ads] Patched: code/pp/pp1794043082.js
```

### Publish to the Chrome Web Store

Prebuilt zip: `dist/photopea-noads-chromium.zip`.

To build it yourself, zip the **contents** of `chromium/` (not the folder):

```bash
cd chromium
zip -r ../dist/photopea-noads-chromium.zip manifest.json inject.js style.css
```

Then:

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
2. Pay the one-time $5 developer fee (if you have not already).
3. Upload the zip as a new item.
4. Fill in the listing (name, description, screenshots, privacy).
5. Privacy: declare that the extension collects no data.
6. Submit for review.

Chrome Web Store review is usually faster than AMO, but they may ask about
the `world: "MAIN"` content script. Explain that it only rewrites Photopea's
own script before the page runs it and does not collect data.

## Notes

If Photopea updates `pp*.js` and changes the structure, you may see
`Ad branch pattern not found` in the console. Update the patterns in
`firefox/background.js` and `chromium/inject.js` to match the new version.
The patterns use capture groups, so simple variable renames are handled
automatically.
