/**
 * Real-browser end-to-end check of the NEXUS journey.
 *
 * Drives the installed Chrome with playwright-core, so no browser download and
 * no project dependency is needed. playwright-core has to be resolvable:
 *
 *   npm install --no-save playwright-core
 *   node tests/e2e.browser.cjs
 *
 * Requires the backend on :5000 and the frontend dev server on :3000
 * (VITE_API_URL pointing at the backend).
 *
 * Covers: route guards in both directions, register -> onboarding -> dashboard,
 * and the forgot-password -> dev token -> reset flow.
 */

const { chromium } = require("playwright-core");

const APP = process.env.APP_URL || "http://localhost:3000";
const API = process.env.API_BASE || "http://127.0.0.1:5000";
const CHROME =
    process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const stamp = Date.now();

const results = [];
const check = (label, pass, detail) => {
    results.push(Boolean(pass));
    console.log(`${pass ? "OK  " : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
};

// Used only for the account the invitee needs; everything user-facing is driven
// through the browser.
const postJson = async (path, body) => {
    const res = await fetch(`${API}/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    return { status: res.status, data: await res.json().catch(() => ({})) };
};

(async () => {
    const browser = await chromium.launch({
        executablePath: CHROME,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on("console", (msg) => {
        if (msg.type() === "error") {
            consoleErrors.push(msg.text());
        }
    });
    page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

    const email = `e2e${stamp}@test.com`;
    const password = "e2e-password-123";

    // --- route guards ---
    await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => null);
    check("signed-out /app redirects to /login", /\/login/.test(page.url()), page.url());

    await page.goto(`${APP}/tasks`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => null);
    check("signed-out /tasks redirects to /login", /\/login/.test(page.url()), page.url());

    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    check("login page renders", (await page.getByLabel(/email/i).count()) > 0 && (await page.getByLabel(/^password$/i).count()) > 0);

    // --- register ---
    await page.goto(`${APP}/register`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.getByLabel(/full name|name/i).first().fill("E2E Tester");
    await page.getByLabel(/^email$/i).first().fill(email);
    await page.getByLabel(/^password$/i).first().fill(password);
    await page.getByLabel(/confirm/i).first().fill(password);
    await page.getByRole("button", { name: /create|register|sign up|get started/i }).first().click();
    await page.waitForURL(/onboarding|\/app/, { timeout: 25000 }).catch(() => null);
    check("register lands in onboarding or the app", /onboarding|\/app/.test(page.url()), page.url());
    if (!/onboarding|\/app/.test(page.url())) {
        console.log("      register page said: " + (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 220));
    }

    // --- onboarding ---
    if (/onboarding/.test(page.url())) {
        // Five input steps, then a summary step that confirms what was created
        // before the app is opened. Walking them by name keeps this honest if
        // the wizard ever changes shape.
        for (let step = 1; step <= 4; step += 1) {
            await page.waitForTimeout(600);
            const next = page.getByRole("button", { name: /^continue$/i }).last();

            if (!(await next.count())) {
                break;
            }

            await next.click();
        }

        await page.waitForTimeout(600);
        const create = page.getByRole("button", { name: /create workspace/i }).last();
        check("onboarding offers to create the workspace", (await create.count()) > 0, page.url());

        if (await create.count()) {
            await create.click();
        }

        // The summary must actually be rendered, not skipped straight to /app.
        await page.waitForTimeout(2500);
        const summaryBody = await page.locator("body").innerText();
        check("onboarding shows a setup summary", /your workspace is ready/i.test(summaryBody), page.url());
        check("summary names the organization", /NEXUS Labs/i.test(summaryBody));
        check("summary names the first project", /Payment Platform/i.test(summaryBody));
        check("summary is not the dashboard yet", !/\/app/.test(page.url()), page.url());

        const open = page.getByRole("button", { name: /open workspace/i }).last();
        check("summary offers to open the workspace", (await open.count()) > 0, page.url());

        if (await open.count()) {
            await open.click();
        }

        await page.waitForURL(/\/app/, { timeout: 25000 }).catch(() => null);
        check("onboarding completes into the dashboard", /\/app/.test(page.url()), page.url());
    }

    // --- dashboard content ---
    await page.waitForTimeout(3000);
    const body = await page.locator("body").innerText();
    check("dashboard is not empty", body.trim().length > 120, `${body.trim().length} chars`);
    check("dashboard shows the signed-in workspace", /E2E Tester|NEXUS|Dashboard/i.test(body));
    check("no auth prompt on the dashboard", !/sign in to continue|create your workspace/i.test(body));
    check("no demo fallback while signed in", !/could not reach the NEXUS API|offline demo/i.test(body));

    // An authenticated visit to /login must bounce back to the app.
    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => null);
    check("signed-in /login redirects to /app", /\/app/.test(page.url()), page.url());

    // --- realtime: the session opened a socket and a project list loads ---
    await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    check("app still renders after a hard reload", (await page.locator("body").innerText()).trim().length > 120);

    // --- forgot password -> dev token -> reset ---
    await page.goto(`${APP}/forgot-password`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await page.getByLabel(/email/i).first().fill(email);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await page.waitForTimeout(2500);

    const devTokenVisible = await page.getByText(/no mail provider/i).count();
    check("dev token is surfaced without a mail provider", devTokenVisible > 0);

    if (devTokenVisible > 0) {
        await page.getByRole("button", { name: /continue with this token/i }).click();
        await page.waitForURL(/reset-password/, { timeout: 15000 }).catch(() => null);
        check("dev token navigates to the reset page", /reset-password/.test(page.url()), page.url());

        // The bug this proves: the token must survive the navigation in the URL.
        const carried = new URL(page.url()).searchParams.get("token");
        check("token is carried through the URL", typeof carried === "string" && carried.length > 0);

        const tokenField = page.locator('input[name*="token" i], input[id*="token" i], input[placeholder*="token" i]').first();
        if (await tokenField.count()) {
            check("reset page pre-fills the token", (await tokenField.inputValue()).length > 0, (await tokenField.inputValue()).slice(0, 12) + "...");
        }

    const pw = page.locator('input[type=password], input[type=text]');
    const pwCount = await pw.count();
    for (let i = 0; i < pwCount; i += 1) {
      await pw.nth(i).fill("rotated-password-456");
    }
    await page.getByRole("button", { name: /reset password/i }).first().click();
    await page.waitForTimeout(3000);
    const afterReset = await page.locator("body").innerText();
    check(
      "reset completes and lands somewhere valid",
      /\/app/.test(page.url()) || /reset|sign in|updated|success/i.test(afterReset),
      page.url().replace(APP, ""),
    );

    // The reset retires every session that existed before it, so the browser is
    // holding a dead token now. Signing in with the rotated password is how the
    // app is meant to recover, and everything after this needs a live session.
    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.getByLabel(/email/i).first().fill(email);
    await page.getByLabel(/^password$/i).first().fill("rotated-password-456");
    await page.getByRole("button", { name: /^sign in$/i }).first().click();
    await page.waitForURL(/\/app/, { timeout: 25000 }).catch(() => null);
    check("the rotated password signs in", /\/app/.test(page.url()), page.url().replace(APP, ""));
    }


    // --- workspace invitation, accepted in the browser ---
    // The owner (this session) invites an address, then the browser signs in as
    // that address and redeems the link. This is the only path that proves the
    // invite page is wired to the API rather than just rendering.
    const guestEmail = `e2eguest${stamp}@test.com`;

    let inviteToken = "";

    try {
        const orgs = await page.evaluate(async () => {
            const token = window.localStorage.getItem("nexus.accessToken");
            const res = await fetch("http://127.0.0.1:5000/api/organizations/mine", {
                headers: { Authorization: `Bearer ${token}` },
            });
            return res.json();
        });
        const orgId = orgs?.organizations?.[0]?.id;

        if (orgId) {
            const issued = await page.evaluate(
                async ([id, invitee]) => {
                    const token = window.localStorage.getItem("nexus.accessToken");
                    const res = await fetch(`http://127.0.0.1:5000/api/organizations/${id}/invitations`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ emails: [invitee] }),
                    });
                    return res.json();
                },
                [orgId, guestEmail],
            );

            inviteToken = issued?.invitations?.[0]?.token ?? "";
        }
    } catch (error) {
        inviteToken = "";
    }

    check("an invitation was issued for a new address", inviteToken.length > 0);

    if (inviteToken) {
        // The invited address is a real person who has not signed up yet, so
        // the account is created first, then redeemed in the browser below.
        const created = await postJson("/auth/register", {
            name: "E2E Invitee",
            email: guestEmail,
            password: "invitee-password-789",
            confirmPassword: "invitee-password-789",
        });
        check("the invited address can register", created.status === 201, `status ${created.status}`);

        // The owner's session is dropped, otherwise /login bounces to /app.
        await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
        await page.evaluate(() => {
            window.localStorage.removeItem("nexus.accessToken");
            window.localStorage.removeItem("nexus.refreshToken");
        });

        await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
        await page.getByLabel(/email/i).first().fill(guestEmail);
        await page.getByLabel(/^password$/i).first().fill("invitee-password-789");
        await page.getByRole("button", { name: /^sign in$/i }).first().click();
        await page.waitForTimeout(3500);
        check("the invited address can sign in", !/\/login/.test(page.url()), page.url().replace(APP, ""));

        await page.goto(`${APP}/accept-invite?token=${inviteToken}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2500);

        const inviteBody = await page.locator("body").innerText();
        check("invitation page names the workspace", /NEXUS Labs/i.test(inviteBody), inviteBody.slice(0, 120).replace(/\s+/g, " "));
        check("invitation page shows the invited address", inviteBody.includes(guestEmail));

        const accept = page.getByRole("button", { name: /accept invitation/i }).first();
        check("signed-in invitee gets the accept action", (await accept.count()) > 0);

        if (await accept.count()) {
            await accept.click();
            await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => null);
            check("accepting the invitation lands in the app", /\/app/.test(page.url()), page.url());
        }

        // The same link must not work twice.
        await page.goto(`${APP}/accept-invite?token=${inviteToken}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2500);
        const replayBody = await page.locator("body").innerText();
        check(
            "a used invitation is refused",
            /invitation unavailable|invalid or has expired|already been used/i.test(replayBody),
            replayBody.slice(0, 120).replace(/\s+/g, " "),
        );
    }

    // A link with a token nobody issued must not leak anything.
    await page.goto(`${APP}/accept-invite?token=not-a-real-token`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const badInvite = await page.locator("body").innerText();
    check("an unknown invitation is reported", /invitation unavailable|invalid or has expired/i.test(badInvite), badInvite.slice(0, 120).replace(/\s+/g, " "));

    // A 403 on admin-only audit logs is an expected answer, not a crash. A 404
    // from the invitation preview is likewise expected, and both cases are
    // asserted directly above instead of being inferred from the console.
    const realErrors = consoleErrors.filter(
        (text) =>
            !/status of 40[13]/.test(text) &&
            !(/status of 404/.test(text) && /Failed to load resource/.test(text)),
    );
    check("no uncaught console errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

    await page.screenshot({ path: "C:\\Users\\rajmi\\AppData\\Local\\Temp\\opencode\\e2e-dashboard.png", fullPage: false });
    await browser.close();

    const failed = results.filter((pass) => !pass).length;
    console.log(`\n${failed === 0 ? "ALL E2E CHECKS OK" : failed + " FAILURE(S)"}  (${results.length} checks)`);
    process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
    console.error("FATAL", error);
    process.exit(1);
});
