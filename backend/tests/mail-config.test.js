const path = require("path");
const { readFileSync } = require("fs");

const backend = path.resolve(__dirname, "..");
const emailService = require(path.join(backend, "src", "services", "emailService"));

/**
 * Whether outgoing mail counts as configured.
 *
 * This one boolean decides two things: whether the boot log says mail is live,
 * and whether a password reset token is returned in the API response instead of
 * being emailed. It previously only asked for SMTP_HOST and SMTP_PORT, so a
 * half-filled block -- host set, password left blank -- reported mail as
 * configured, swallowed the token, and then failed to send anything. The user
 * was left with no way back into the account and no indication why.
 *
 * Reading the environment on each call rather than caching it at import is what
 * lets this drive the variable directly.
 */

const results = [];

const check = (label, actual, expected) => {
    const pass = actual === expected;
    results.push(pass);
    console.log(
        `${pass ? "PASS" : "FAIL"}  ${label.padEnd(60)} got ${JSON.stringify(actual)}${pass ? "" : ` expected ${JSON.stringify(expected)}`}`,
    );
};

const KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM"];

const withEnv = (values) => {
    const saved = {};

    for (const key of KEYS) {
        saved[key] = process.env[key];
        delete process.env[key];
    }

    for (const [key, value] of Object.entries(values)) {
        process.env[key] = value;
    }

    return () => {
        for (const key of KEYS) {
            if (saved[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = saved[key];
            }
        }
    };
};

const RESEND = {
    SMTP_HOST: "smtp.resend.com",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "resend",
    SMTP_PASSWORD: "re_abc123",
    MAIL_FROM: "NEXUS <onboarding@resend.dev>"
};

(async () => {
    let restore;

    try {
        restore = withEnv({});
        check("nothing set is not configured", emailService.isConfigured(), false);

        restore = withEnv({ ...RESEND, SMTP_PASSWORD: "" });
        check("a blank password is not configured", emailService.isConfigured(), false);

        restore = withEnv({ ...RESEND, SMTP_USER: "" });
        check("a blank user is not configured", emailService.isConfigured(), false);

        restore = withEnv({ ...RESEND, SMTP_PORT: "" });
        check("a blank port is not configured", emailService.isConfigured(), false);

        restore = withEnv({ ...RESEND, SMTP_HOST: "" });
        check("a blank host is not configured", emailService.isConfigured(), false);

        restore = withEnv({ SMTP_HOST: "smtp.resend.com", SMTP_PORT: "465" });
        check("host and port alone is not configured", emailService.isConfigured(), false);

        restore = withEnv(RESEND);
        check("a complete block is configured", emailService.isConfigured(), true);

        // Every template the app sends has to resolve to a real link, or the
        // email arrives with a dead button in it.
        for (const kind of ["password_reset", "email_verification", "workspace_invite"]) {
            const built = emailService.TEMPLATES[kind]({
                token: "abc",
                name: "Raj",
                organization: "Wipro",
                inviter: "Priya"
            });

            check(`${kind} builds a frontend link`, /^https?:\/\/.+\/(reset-password|email-verification|accept-invite)\?token=abc$/.test(built.href), true);
            check(`${kind} has a subject`, typeof built.subject === "string" && built.subject.length > 0, true);
        }

        // An unknown kind must not throw: a mail outage must never fail the
        // request that triggered it.
        const unknown = await emailService.send("not_a_template", { to: "x@y.dev", token: "t" });
        check("an unknown template reports rather than throws", unknown.delivered, false);
    } finally {
        if (restore) {
            restore();
        }
    }

    /*
        The boot log used to announce "password resets will be emailed" purely
        from the presence of the variables. A revoked key satisfies that check
        perfectly and then fails the first real send, by which point a user has
        already been told their reset link is on its way. The log now reports
        what the provider actually said.
    */
    const source = readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
    const emailSource = readFileSync(
        path.join(__dirname, "..", "src", "services", "emailService.js"),
        "utf8"
    );

    check("the boot log asks the provider rather than trusting the env", /verifyTransport\(\)/.test(source), true);
    check("verifyTransport is exported", /verifyTransport/.test(emailSource), true);
    check(
        "a rejected login is reported as a failure, not as working mail",
        /REJECTED/.test(source) && /will NOT be sent/.test(source),
        true
    );
    check(
        "verify is bounded so a silent provider cannot stall startup",
        /connectionTimeout\s*=\s*\d+/.test(emailSource) && /greetingTimeout\s*=\s*\d+/.test(emailSource),
        true
    );
    check("the old unconditional success message is gone", /will be emailed\)/.test(source), false);

    // With nothing configured there is no transport to ask, and it has to
    // reject rather than resolve: reporting success without a server would
    // reintroduce the same lie by a different route.
    const bareEnv = withEnv({ SMTP_HOST: "", SMTP_PORT: "", SMTP_USER: "", SMTP_PASSWORD: "" });
    try {
        let rejected = false;
        await emailService.verifyTransport().catch(() => { rejected = true; });
        check("verifyTransport rejects when nothing is configured", rejected, true);
    } finally {
        bareEnv();
    }

    const passed = results.filter(Boolean).length;
    console.log(`\n===== ${passed}/${results.length} passed =====`);

    if (passed !== results.length) {
        process.exitCode = 1;
    }
})();
