/*
    Checks that outgoing mail is actually wired up, and sends a real message to
    prove the credentials work.

    Run it after putting a Resend key in backend/.env:

        cd backend
        node scripts/check-mail.cjs

    It exits non-zero on failure, so it is usable in CI or a pre-deploy check.
    The recipient defaults to the address on the Resend account, because
    onboarding@resend.dev can only send to the address that signed up.
*/

const path = require("path");

const backend = path.resolve(__dirname, "..");

// dotenv is already a dependency of the server entry, so reuse it rather than
// adding a parser here.
require(path.join(backend, "node_modules", "dotenv")).config({ path: path.join(backend, ".env") });

const nodemailer = require(path.join(backend, "node_modules", "nodemailer"));
const emailService = require(path.join(backend, "src", "services", "emailService"));

const REQUIRED = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"];

const fail = (message) => {
    console.error(`FAIL  ${message}`);
    process.exitCode = 1;
};

const ok = (message) => {
    console.log(`OK    ${message}`);
};

(async () => {
    const missing = REQUIRED.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        fail(`missing in backend/.env: ${missing.join(", ")}`);

        console.error(
            "\n      For Resend the block is:\n" +
                "        SMTP_HOST=smtp.resend.com\n" +
                "        SMTP_PORT=465\n" +
                "        SMTP_SECURE=true\n" +
                "        SMTP_USER=resend\n" +
                "        SMTP_PASSWORD=re_...   <- your API key\n",
        );
        return;
    }

    if (!emailService.isConfigured()) {
        fail("isConfigured() is false despite the settings being present");
        return;
    }

    ok(`configured for ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);

    const to = process.argv[2] || process.env.MAIL_TEST_TO;

    if (!to) {
        console.log(
            "\n      Credentials present. Pass a recipient to actually send:\n" +
                "        node scripts/check-mail.cjs you@example.com\n",
        );
        return;
    }

    const mail = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });

    try {
        await mail.verify();
        ok("SMTP connection and credentials accepted");
    } catch (error) {
        // This is the failure people hit most often, so name the cause.
        const hint = /535|auth/i.test(error.message)
            ? "\n      The host accepted the connection but rejected the credentials. Check SMTP_USER and SMTP_PASSWORD."
            : /ECONNREFUSED|ETIMEDOUT/i.test(error.message)
              ? "\n      Could not reach the host. Check SMTP_HOST and SMTP_PORT."
              : "";

        fail(`SMTP verify failed: ${error.message}${hint}`);

        return;
    }

    const result = await emailService.send("password_reset", {
        to,
        token: "check-mail-not-a-real-token",
        name: "Mail check",
    });

    if (result.delivered) {
        ok(`sent a real reset email to ${to} - check your inbox`);
    } else {
        fail(`send() reported not delivered: ${result.reason}`);
    }
})().catch((error) => {
    console.error("CHECK CRASHED:", error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
