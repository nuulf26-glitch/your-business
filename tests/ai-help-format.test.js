import test from "node:test";
import assert from "node:assert/strict";
import { parseAiHelpText } from "../src/utils/aiHelpText.js";

test("AI Help renders markdown bold spans as safe text segments", () => {
  assert.deepEqual(parseAiHelpText("1. **Sign In**: Open your account."), [
    { text: "1. ", bold: false },
    { text: "Sign In", bold: true },
    { text: ": Open your account.", bold: false },
  ]);
});

test("AI Help preserves line breaks and leaves unmatched markers as plain text", () => {
  assert.deepEqual(parseAiHelpText("First line\n**bold**\n**unfinished"), [
    { text: "First line\n", bold: false },
    { text: "bold", bold: true },
    { text: "\n**unfinished", bold: false },
  ]);
});

test("AI Help treats markup-like content as text rather than HTML", () => {
  assert.deepEqual(parseAiHelpText("<script>alert(1)</script>"), [
    { text: "<script>alert(1)</script>", bold: false },
  ]);
});
