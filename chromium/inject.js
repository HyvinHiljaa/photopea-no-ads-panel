"use strict";

/**
 * ============================================================
 * Photopea No Ads Panel — Chrome/Brave (MV3) inject.js
 * ============================================================
 *
 * Chrome/Brave do NOT have Firefox's `webRequest.filterResponseData`.
 * So instead this script runs in the page's MAIN world at document_start
 * and intercepts the Photopea `pp*.js` <script> before the browser loads it.
 *
 * We fetch the original script ourselves, rewrite the ad branch, and insert
 * an inline script with the patched source. Photopea has no CSP, so inline
 * scripts are allowed.
 *
 * WHY INTERCEPT THE SCRIPT ELEMENT?
 * ---------------------------------
 * The ad flag lives inside `cT.prototype.Sr` in `code/pp/pp*.js`.
 * We cannot reach that function after the script runs because it is hidden
 * inside Photopea's IIFE. We have to patch the source before it executes.
 * ============================================================
 */

(() => {
  const LOG_PREFIX = "[Photopea No-Ads]";

  // Matches `code/pp/pp<timestamp>.js`, whether relative or absolute.
  const PHOTOPEA_PP_SCRIPT_URL_RE = /code\/pp\/pp[^/]*\.js/;

  // --- Same patterns as the Firefox version -------------------------------
  // Variable names are captured and preserved, so minifier renames still work.
  const AD_BRANCH_PATTERN =
    /var ([A-Za-z_$][\w$]*)=eb\.U\$,([A-Za-z_$][\w$]*)=[^;]+;/;
  const AD_BRANCH_FALLBACK_PATTERN =
    /([A-Za-z_$][\w$]*)=!this\.rX\|\|[^;]+;/;
  const AD_SPACE_RESERVATION_PATTERN =
    /else\{if\(([A-Za-z_$][\w$]*)==0\)([A-Za-z_$][\w$]*)-=84;else ([A-Za-z_$][\w$]*)-=\1==1\?180:320\}/;

  const AD_BRANCH_REPLACEMENT = "var $1=eb.U$,$2=!0;";
  const AD_BRANCH_FALLBACK_REPLACEMENT = "$1=!0;";
  const AD_SPACE_RESERVATION_REPLACEMENT = "else{}";

  /**
   * Rewrites Photopea's minified JS source so the ad branch is skipped.
   *
   * @param {string} originalSource
   * @returns {{ patchedSource: string, didPatch: boolean }}
   */
  function patchPhotopeaSource(originalSource) {
    let patchedSource = originalSource;
    let didPatch = false;

    if (AD_BRANCH_PATTERN.test(patchedSource)) {
      patchedSource = patchedSource.replace(
        AD_BRANCH_PATTERN,
        AD_BRANCH_REPLACEMENT
      );
      didPatch = true;
      console.log(`${LOG_PREFIX} Ad branch disabled`);
    } else if (AD_BRANCH_FALLBACK_PATTERN.test(patchedSource)) {
      patchedSource = patchedSource.replace(
        AD_BRANCH_FALLBACK_PATTERN,
        AD_BRANCH_FALLBACK_REPLACEMENT
      );
      didPatch = true;
      console.log(`${LOG_PREFIX} Ad branch disabled (fallback)`);
    } else {
      console.warn(`${LOG_PREFIX} Ad branch pattern not found`);
    }

    if (AD_SPACE_RESERVATION_PATTERN.test(patchedSource)) {
      patchedSource = patchedSource.replace(
        AD_SPACE_RESERVATION_PATTERN,
        AD_SPACE_RESERVATION_REPLACEMENT
      );
      didPatch = true;
      console.log(`${LOG_PREFIX} Ad width reservation removed`);
    }

    return { patchedSource, didPatch };
  }

  // Keep a reference to the real appendChild BEFORE we override it.
  const nativeAppendChild = Node.prototype.appendChild;

  /**
   * Intercepts a <script> that points at Photopea's `pp*.js`.
   * Instead of letting the browser load it, we fetch and patch it,
   * then insert an inline script with the patched source.
   */
  function interceptPhotopeaScript(scriptElement, parentNode) {
    const scriptUrl = scriptElement.getAttribute("src");

    if (!scriptUrl || !PHOTOPEA_PP_SCRIPT_URL_RE.test(scriptUrl)) {
      return false;
    }

    // Prevent the browser from loading the original URL.
    scriptElement.removeAttribute("src");

    fetch(scriptUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      .then((originalSource) => {
        const { patchedSource, didPatch } =
          patchPhotopeaSource(originalSource);

        // Run the patched source as an inline script.
        scriptElement.textContent = patchedSource;

        if (didPatch) {
          console.log(`${LOG_PREFIX} Patched:`, scriptUrl);
        } else {
          console.warn(`${LOG_PREFIX} Unchanged:`, scriptUrl);
        }

        // Append with the native method to avoid re-triggering our hook.
        nativeAppendChild.call(parentNode, scriptElement);
      })
      .catch((error) => {
        console.error(`${LOG_PREFIX} Patch failed, loading original:`, error);

        // Fail-open: load the original unpatched script so Photopea works.
        scriptElement.setAttribute("src", scriptUrl);
        nativeAppendChild.call(parentNode, scriptElement);
      });

    // Tell the caller that we handled this script ourselves.
    return true;
  }

  Node.prototype.appendChild = function (childNode) {
    if (childNode && childNode.tagName === "SCRIPT") {
      if (interceptPhotopeaScript(childNode, this)) {
        // We deferred the append until the patched source is ready.
        return childNode;
      }
    }
    return nativeAppendChild.call(this, childNode);
  };
})();
