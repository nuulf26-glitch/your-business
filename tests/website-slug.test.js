import test from "node:test";
import assert from "node:assert/strict";
import { suggestedWebsiteSlug, websiteSlug } from "../src/pages/websiteSlug.js";

test("website addresses are normalized for a readable URL", () => {
  assert.equal(websiteSlug("  Nouf Beauty Studio  "), "nouf-beauty-studio");
  assert.equal(websiteSlug("Café & Co."), "cafe-co");
  assert.equal(websiteSlug("---"), "");
  assert.equal(suggestedWebsiteSlug("متجر نوف"), "my-business");
  assert.equal(suggestedWebsiteSlug(""), "");
  assert.match(websiteSlug("A".repeat(120)), /^[a-z0-9-]{1,100}$/);
  assert.doesNotMatch(websiteSlug("A".repeat(120)), /-$/);
});
