import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { preserveProductReferences } from "../src/editor/aiPreviewModel.js";

const [designerSource, editorSource] = await Promise.all([
  readFile(new URL("../src/components/AiDesigner.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/pages/WebsiteEditor.jsx", import.meta.url), "utf8"),
]);

test("AI edit previews receive the account products so product sections resolve", () => {
  assert.match(editorSource, /<AiDesigner model=\{model\} products=\{products\}/);
  assert.match(designerSource, /AiDesigner\(\{[^\n]*products\s*=\s*\[\]/);
  assert.match(designerSource, /<WebsiteRenderer model=\{pendingModel\} products=\{products\}/);
});

test("AI edit previews retain product associations from the source website", () => {
  const source = { pages: [{ id: "home", sections: [{ id: "featured", type: "product", productId: "product-42" }] }] };
  const proposed = { pages: [{ id: "home", sections: [{ id: "featured", type: "product", title: "A better title" }] }] };
  const preview = preserveProductReferences(source, proposed);
  assert.equal(preview.pages[0].sections[0].productId, "product-42");
  assert.equal(preview.pages[0].sections[0].title, "A better title");
  assert.equal(proposed.pages[0].sections[0].productId, undefined);
});

test("AI edit previews preserve product links inside grouped sections", () => {
  const source = { sections: [{ id: "group", type: "group", children: [{ id: "featured", type: "product", productId: "product-legacy" }] }] };
  const proposed = { sections: [{ id: "group", type: "group", children: [{ id: "featured", type: "product" }] }] };
  assert.equal(preserveProductReferences(source, proposed).sections[0].children[0].productId, "product-legacy");
});
