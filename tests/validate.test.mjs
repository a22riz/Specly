import assert from "node:assert";
import { parseValidationResponse } from "../lib/validate.ts";

const wellFormed = '```json\n[{"severity":"error","section":"prd.goals","message":"Missing","suggestion":"Add goals"}]\n```';
const findings = parseValidationResponse(wellFormed);
assert.equal(findings.length, 1, "parses fenced JSON array");
assert.equal(findings[0].severity, "error");
assert.equal(findings[0].section, "prd.goals");

const noIssues = "[]";
assert.equal(parseValidationResponse(noIssues).length, 0, "empty array → no findings");

const garbage = "This is not JSON at all";
assert.equal(parseValidationResponse(garbage).length, 0, "unparseable text → empty array, no throw");

const notArray = '{"severity":"error","section":"x"}';
assert.equal(parseValidationResponse(notArray).length, 0, "valid JSON but not array → empty");

const bareArray = '[{"severity":"warning","section":"tech.arch","message":"vague","suggestion":"clarify"}]';
const bare = parseValidationResponse(bareArray);
assert.equal(bare.length, 1, "parses unfenced JSON array");
assert.equal(bare[0].severity, "warning");

console.log("validate.test OK");
