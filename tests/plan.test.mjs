import assert from "node:assert";
import { parsePlanResponse } from "../lib/plan.ts";

const wellFormed = '```json\n{"nextSection":{"key":"prd.goals","title":"Goals","reason":"Foundation for everything"},"suggestedOrder":[{"key":"prd.goals","title":"Goals","dependsOn":["prd.introduction"],"recommendation":"Write goals next"}],"summary":"PRD is 20% done"}\n```';
const plan = parsePlanResponse(wellFormed);
assert.ok(plan, "parses fenced JSON");
assert.equal(plan.nextSection.key, "prd.goals");
assert.equal(plan.suggestedOrder.length, 1);
assert.equal(plan.summary, "PRD is 20% done");

const noNext = '{"nextSection":null,"suggestedOrder":[],"summary":"All sections filled"}';
const allFilled = parsePlanResponse(noNext);
assert.ok(allFilled, "parses plan with null nextSection");
assert.equal(allFilled.nextSection, null);
assert.equal(allFilled.suggestedOrder.length, 0);

assert.equal(parsePlanResponse("garbage"), null, "unparseable → null");
assert.equal(parsePlanResponse('{"nextSection":{}}'), null, "missing suggestedOrder → null");

console.log("plan.test OK");
