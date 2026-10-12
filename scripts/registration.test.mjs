/**
 * Unit tests for the solo-only registration rules.
 *
 * Run with:  npm test
 *
 * These cover the pure validation layer in api/_lib.js. Nothing here touches
 * Supabase, SMTP or the network, so the suite is safe to run anywhere.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import lib from "../api/_lib.js";

const { validateRegistration } = lib;

/** A complete, valid solo submission. */
function soloPayload(overrides = {}) {
  return {
    entryFormat: "solo",
    leader: {
      fullName: "Bruce Wayne",
      email: "Bruce.Wayne@example.com",
      phone: "+91 9876543210",
      year: "II",
      department: "Cyber Security",
      gender: "Male",
      rollNumber: "110121104001",
    },
    partner: null,
    domain: "Ethical Hacking",
    heardAbout: "Instagram",
    agree: true,
    ...overrides,
  };
}

test("accepts a valid solo registration", () => {
  const result = validateRegistration(soloPayload());
  assert.equal(result.ok, true, JSON.stringify(result.fieldErrors));
});

test("derives team name and uniqueness key from the participant", () => {
  const result = validateRegistration(soloPayload());
  assert.equal(result.value.teamName, "Bruce Wayne");
  assert.equal(result.value.teamNameKey, "bruce.wayne@example.com");
  assert.equal(result.value.entryFormat, "solo");
  assert.equal(result.value.headcount, 1);
  assert.deepEqual(result.value.emails, ["bruce.wayne@example.com"]);
  assert.equal(result.value.partner, null);
});

test("rejects a duo entry format", () => {
  const result = validateRegistration(soloPayload({ entryFormat: "duo" }));
  assert.equal(result.ok, false);
  assert.ok(result.fieldErrors.entryFormat);
});

test("rejects a payload that still carries a partner", () => {
  const result = validateRegistration(
    soloPayload({ partner: { fullName: "Clark Kent", year: "I", rollNumber: "110121104002" } })
  );
  assert.equal(result.ok, false);
  assert.ok(result.fieldErrors.partner);
});

test("ignores an empty partner object", () => {
  const result = validateRegistration(soloPayload({ partner: {} }));
  assert.equal(result.ok, true, JSON.stringify(result.fieldErrors));
});

test("requires the leader details", () => {
  const result = validateRegistration({ entryFormat: "solo", agree: true });
  assert.equal(result.ok, false);
  assert.ok(result.fieldErrors["leader.fullName"]);
  assert.ok(result.fieldErrors["leader.email"]);
  assert.ok(result.fieldErrors["leader.phone"]);
  assert.ok(result.fieldErrors["leader.year"]);
  assert.ok(result.fieldErrors["leader.rollNumber"]);
});

test("rejects an invalid email", () => {
  const result = validateRegistration(
    soloPayload({ leader: { ...soloPayload().leader, email: "not-an-email" } })
  );
  assert.equal(result.ok, false);
  assert.ok(result.fieldErrors["leader.email"]);
});

test("rejects an invalid phone number", () => {
  const result = validateRegistration(
    soloPayload({ leader: { ...soloPayload().leader, phone: "12" } })
  );
  assert.equal(result.ok, false);
  assert.ok(result.fieldErrors["leader.phone"]);
});

test("rejects an invalid register number", () => {
  const result = validateRegistration(
    soloPayload({ leader: { ...soloPayload().leader, rollNumber: "ab!!" } })
  );
  assert.equal(result.ok, false);
  assert.ok(result.fieldErrors["leader.rollNumber"]);
});

test("rejects an unknown domain", () => {
  const result = validateRegistration(soloPayload({ domain: "Astrology" }));
  assert.equal(result.ok, false);
  assert.ok(result.fieldErrors.domain);
});

test("requires agreement to the rules", () => {
  const result = validateRegistration(soloPayload({ agree: false }));
  assert.equal(result.ok, false);
  assert.ok(result.fieldErrors.agree);
});
