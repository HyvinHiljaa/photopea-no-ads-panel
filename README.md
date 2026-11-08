# Photopea No Ads Panel

A Firefox extension that removes Photopea's right-side ad panel along with the 320px of space reserved for it.

## How it works

`background.js` intercepts the `photopea.com/code/pp/pp*.js` response in flight with `webRequest.filterResponseData` and patches this line:

```js
var K=eb.U$,D=!this.rX||this.uF()||!this.S.zB||hN.Dj()||...
```

into:

```js
var K=eb.U$,D=!0;
```

As a result:

- the right-side ad panel is never created,
- 320px is no longer cut from the UI width,
- ad scripts/iframes are not loaded.

`style.css` is a fallback that hides the panel in case the patch does not apply.

## Temporary installation

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on…**.
3. Select the `manifest.json` file in this folder.
4. Reload the `photopea.com` page with **Ctrl+Shift+R**.

You should see the following logs in the console:

```text
[Photopea No-Ads] Ad branch disabled
[Photopea No-Ads] Ad width reservation removed
[Photopea No-Ads] Patched: https://www.photopea.com/code/pp/pp....js
```

## Permanent installation

```bash
npm install -g web-ext
web-ext build
```

You can submit the resulting zip for signing on addons.mozilla.org. Regular Firefox does not allow permanently installing unsigned extensions; on Developer Edition/Nightly you can install unsigned ones by setting `about:config` → `xpinstall.signatures.required = false`.

## Note

If Photopea updates its `pp*.js` file, the obfuscated variable names may change. If you see `Ad branch pattern not found` in the console, update the patterns in `background.js` to match the new version. The patterns use capture groups, so simple variable renames are handled automatically.
