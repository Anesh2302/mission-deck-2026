/**
 * POST /api/register
 *
 * Stores one free registration in Supabase.
 * Duplicate team names and duplicate participant emails are rejected with 409.
 */

const {
  isSupabaseConfigured,
  findRegistrationClash,
  insertRegistration,
  validateRegistration,
  newRegistrationId,
  registrationWindowOpen,
  readJsonBody,
  sendConfirmationEmail,
} = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  // Validate before touching the database so a malformed payload reports its
  // field errors even when Supabase is not configured yet.
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    if (e.message === "PAYLOAD_TOO_LARGE") {
      return res.status(413).json({ error: "The submitted registration is too large." });
    }
    return res.status(400).json({ error: "Could not read the submitted form." });
  }

  const result = validateRegistration(body);
  if (!result.ok) {
    return res.status(400).json({
      error: "Some details did not pass the mission desk review.",
      fieldErrors: result.fieldErrors,
    });
  }

  if (!registrationWindowOpen()) {
    return res.status(403).json({ error: "Registration closed on 13 October 2026, 07:00 AM IST." });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      error: "The registry is not connected yet. Please try again in a moment.",
    });
  }

  const value = result.value;

  try {
    // Friendly pre-checks; the unique database constraints remain the final guarantee.
    const clash = await findRegistrationClash(value);

    if (clash) {
      const emailHit = (clash.emails || []).some((e) => value.emails.includes(e));
      const entryLabel = value.entryFormat === "duo" ? "team name" : "solo alias";
      return res.status(409).json({
        error: emailHit
          ? "That email is already registered for this event - each participant sits once."
          : `The ${entryLabel} "${value.teamName}" is already taken. Choose a different name.`,
      });
    }

    const doc = {
      ...value,
      registrationId: newRegistrationId(),
      submittedAt: new Date().toISOString(),
    };

    try {
      await insertRegistration(doc);
    } catch (e) {
      // Two people submitted at the same moment; the index caught it.
      if (e && (e.code === "23505" || e.status === 409)) {
        return res.status(409).json({
          error: "That team name / solo alias or email was just registered by someone else. Try again.",
        });
      }
      throw e;
    }

    // The entry is already committed at this point, so mail is fire-and-forget:
    // a flaky SMTP server must not turn a good registration into an error.
    const emailed = await sendConfirmationEmail(doc);

    return res.status(201).json({
      registrationId: doc.registrationId,
      headcount: doc.headcount,
      emailSent: emailed,
      username: doc.teamName,
    });
  } catch (e) {
    console.error("register failed", e);
    return res.status(503).json({
      error: "We could not reach the registry. Please try again in a moment.",
    });
  }
};
