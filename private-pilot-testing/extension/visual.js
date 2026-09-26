(function registerVisualApi(root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  root.PrivatePilotVisual = api;
})(globalThis, function createVisualApi() {
  function detectText(text) {
    const [label, ...rest] = text.split(":");
    return PrivatePilotPii.detect(rest.length ? label : text, rest.length ? rest.join(":").trim() : text)
      || PrivatePilotPii.detect("", text);
  }

  function candidatesFromBlocks(blocks, scale = 1) {
    return blocks.flatMap(block => {
      const detection = detectText(block.rawValue || "");
      if (!detection) return [];
      const box = block.boundingBox;
      return [{
        raw: block.rawValue,
        kind: detection.kind,
        confidence: detection.confidence,
        bounds: { x: box.x * scale, y: box.y * scale, width: box.width * scale, height: box.height * scale }
      }];
    });
  }

  async function recognise(dataUrl) {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const worker = await Tesseract.createWorker("eng", 1, {
      workerPath: chrome.runtime.getURL("vendor/tesseract/worker.min.js"),
      corePath: chrome.runtime.getURL("vendor/tesseract/core/tesseract-core-lstm.wasm.js"),
      langPath: chrome.runtime.getURL("vendor/tesseract/lang"),
      workerBlobURL: false,
      cacheMethod: "none",
      gzip: true
    });
    try {
      const { data } = await worker.recognize(dataUrl, {}, { blocks: true });
      const lines = (data.blocks || []).flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines));
      const blocks = lines.map(line => ({
        rawValue: line.text,
        boundingBox: {
          x: line.bbox.x0,
          y: line.bbox.y0,
          width: line.bbox.x1 - line.bbox.x0,
          height: line.bbox.y1 - line.bbox.y0
        }
      }));
      return { blocks, width: image.naturalWidth, height: image.naturalHeight, lineCount: lines.length, textLength: (data.text || "").trim().length };
    } finally {
      await worker.terminate();
    }
  }

  return { candidatesFromBlocks, recognise };
});
