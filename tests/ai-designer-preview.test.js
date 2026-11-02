import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [designerSource, editorSource] = await Promise.all([
  readFile(new URL("../src/components/AiDesigner.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/pages/WebsiteEditor.jsx", import.meta.url), "utf8"),
]);

test("AI edit previews receive the account products so product sections resolve", () => {
  assert.match(editorSource, /<AiDesigner model=\\{model\\} products=\\{products\\}/);
  assert.match(designerSource, /AiDesigner\\(\\{[^\\n]*products\\s*=\\s*\\[\\]/);
  assert.match(designerSource, /<WebsiteRenderer model=\\{pendingModel\\} products=\\{products\\}/);
});
