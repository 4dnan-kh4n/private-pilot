(function registerOverlayApi(root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  root.PrivatePilotOverlay = api;
})(globalThis, function createOverlayApi() {
  const id = "privatepilot-visual-overlay";

  function clear() {
    document.getElementById(id)?.remove();
  }

  function show(regions) {
    clear();
    if (!regions.length || !document.body) return;
    const layer = document.createElement("div");
    layer.id = id;
    layer.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    for (const region of regions) {
      const box = document.createElement("span");
      box.textContent = region.placeholder;
      box.style.cssText = `position:absolute;left:${region.bounds.x}px;top:${region.bounds.y}px;min-width:${region.bounds.width}px;min-height:${region.bounds.height}px;padding:2px 5px;color:#fff;background:#672b3f;border:1px solid #f3c0cb;border-radius:3px;font:600 12px/1.3 system-ui;`;
      layer.append(box);
    }
    document.body.append(layer);
  }

  return { show, clear };
});
