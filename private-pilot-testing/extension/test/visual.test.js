const assert = require("node:assert/strict");
const test = require("node:test");
require("../pii.js");
const { candidatesFromBlocks } = require("../visual.js");

test("visual OCR candidates detect fictional PII and preserve scaled bounding boxes", () => {
  const candidates = candidatesFromBlocks([
    { rawValue: "Full name: Aarav Demo", boundingBox: { x: 10, y: 20, width: 80, height: 15 } },
    { rawValue: "Account: 123456789012", boundingBox: { x: 20, y: 50, width: 90, height: 15 } },
    { rawValue: "Public heading", boundingBox: { x: 0, y: 0, width: 10, height: 10 } }
  ], 2);

  assert.deepEqual(candidates.map(item => item.kind), ["PERSON", "ACCOUNT"]);
  assert.deepEqual(candidates[1].bounds, { x: 40, y: 100, width: 180, height: 30 });
});

test("visual OCR matching accepts labels even when OCR omits punctuation", () => {
  const candidates = candidatesFromBlocks([
    { rawValue: "Full name Aarav Demo", boundingBox: { x: 0, y: 0, width: 100, height: 20 } }
  ]);
  assert.equal(candidates[0].kind, "PERSON");
});
