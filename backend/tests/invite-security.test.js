process.env.NODE_ENV = "test";

/**
 * Email delivery, session retirement, and workspace invitation tests.
 *
 * These cover the flows behind a real mail provider: registration verification,
 * password reset session invalidation, atomic one-time token consumption, and
 * the full invite lifecycle from onboarding dispatch to acceptance.
 *
 * Run against a live server + MongoDB:
 *   npm start
 *   npm run test:invites
 */

const ORIGIN = process.env.API_BASE || "http://localhost:5000";
const BASE = `${ORIGIN}/api`;

const call = async (method, path, token, body) => {
    const res = await fetch(BASE + path, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
};

const stamp = Date.now();
const results = [];

const check = (label, actual, expected) => {
    const pass = actual === expected;
    results.push(pass);
    console.log(
        `${pass ? "PASS" : "FAIL"}  ${label.padEnd(60)} got ${JSON.stringify(actual)}${pass ? "" : ` expected ${JSON.stringify(expected)}`}`
    );
};

const checkTruthy = (label, value) => {
    const pass = Boolean(value);
    results.push(pass);
    console.log(
        `${pass ? "PASS" : "FAIL"}  ${label.padEnd(60)} got ${JSON.stringify(value)}`
    );
};

const report = () => {
    const passed = results.filter(Boolean).length;
    console.log(`\n===== ${passed}/${results.length} passed =====`);

    if (passed !== results.length) {
        process.exitCode = 1;
    }
};

const register = async (name, email, role) => {
    const res = await call("POST", "/auth/register", null, {
        name,
        email,
        password: "Secret123!",
        confirmPassword: "Secret123!",
        role
    });
    return { ...res.data, status: res.status };
};

(async () => {
    const ownerEmail = `invo${stamp}@test.com`;
    const guestEmail = `invguest${stamp}@test.com`;
    const strangerEmail = `invstranger${stamp}@test.com`;
    const freshEmail = `invfresh${stamp}@test.com`;

    console.log("\n--- registration issues a verification link ---");

    const owner = await register("Invite Owner", ownerEmail, "admin");
    check("register owner", owner.status, 201);
    checkTruthy("register returns a session", owner.token);
    checkTruthy("register returns a dev verification token", owner.verificationToken);

    const verify = await call("POST", "/auth/verify-email", null, {
        token: owner.verificationToken
    });
    check("verify email", verify.status, 200);

    const verifyReplay = await call("POST", "/auth/verify-email", null, {
        token: owner.verificationToken
    });
    check("verification token cannot be replayed", verifyReplay.status, 400);

    console.log("\n--- onboarding dispatches real invitations ---");

    const setup = await call("POST", "/onboarding", owner.token, {
        organization: `Invite Org ${stamp}`,
        project: "Launch",
        workspaceType: "Software",
        teammateEmails: [guestEmail]
    });
    check("onboarding completes", setup.status, 200);
    checkTruthy("onboarding returns an invitation", setup.data.invitations?.[0]?.token);
    check(
        "pending invites still tracked on the organization",
        (setup.data.invitesPending || []).includes(guestEmail),
        true
    );

    const inviteToken = setup.data.invitations[0].token;
    const orgId = setup.data.organization.id;

    console.log("\n--- invitation preview is public and scoped ---");

    const preview = await call("GET", `/organizations/invitations/preview/${inviteToken}`);
    check("preview works without a session", preview.status, 200);
    check("preview names the workspace", preview.data.organization, `Invite Org ${stamp}`);
    check("preview hides the member list", preview.data.members, undefined);

    const badPreview = await call("GET", "/organizations/invitations/preview/deadbeef");
    check("unknown invitation preview", badPreview.status, 404);

    console.log("\n--- only the invited address can redeem ---");

    const stranger = await register("Stranger", strangerEmail);
    const wrongUser = await call("POST", "/organizations/invitations/accept", stranger.token, {
        token: inviteToken
    });
    check("a different account is rejected", wrongUser.status, 403);

    const stillLive = await call("GET", `/organizations/invitations/preview/${inviteToken}`);
    check("a rejected attempt does not burn the link", stillLive.status, 200);

    const guest = await register("Invited Guest", guestEmail);
    const accepted = await call("POST", "/organizations/invitations/accept", guest.token, {
        token: inviteToken
    });
    check("the invited address is accepted", accepted.status, 200);

    const acceptReplay = await call("POST", "/organizations/invitations/accept", guest.token, {
        token: inviteToken
    });
    check("invitation cannot be reused", acceptReplay.status, 400);

    const guestOrgs = await call("GET", "/organizations/mine", guest.token);
    check(
        "the guest can now see the workspace",
        (guestOrgs.data.organizations || []).some((org) => org.id === orgId),
        true
    );

    const ownerView = await call("GET", `/organizations/${orgId}`, owner.token);
    check(
        "the accepted address leaves pendingInvites",
        (ownerView.data.organization.pendingInvites || []).includes(guestEmail),
        false
    );

    console.log("\n--- management invitation endpoints ---");

    const listed = await call("GET", `/organizations/${orgId}/invitations`, owner.token);
    check("an admin lists invitations", listed.status, 200);
    check(
        "an accepted invitation is no longer listed",
        (listed.data.invitations || []).some((row) => row.email === guestEmail),
        false
    );

    const memberList = await call("GET", `/organizations/${orgId}/invitations`, guest.token);
    check("a plain member cannot list invitations", memberList.status, 403);

    const reissued = await call("POST", `/organizations/${orgId}/invitations`, owner.token, {
        emails: [guestEmail, "not-an-email", freshEmail]
    });
    check("reissue invitations", reissued.status, 201);
    check(
        "a malformed address is filtered out",
        (reissued.data.invitations || []).some((row) => row.email === "not-an-email"),
        false
    );
    checkTruthy("a fresh address receives an invitation", (reissued.data.invited || []).includes(freshEmail));
    check(
        "an existing member is skipped",
        (reissued.data.invited || []).includes(guestEmail),
        false
    );

    const outsider = await register("Outsider", `invoutsider${stamp}@test.com`);
    const outsiderOrg = await call("POST", "/organizations", outsider.token, {
        name: `Outsider Org ${stamp}`
    });
    const outsiderInvite = await call(
        "POST",
        `/organizations/${outsiderOrg.data.organization.id}/invitations`,
        outsider.token,
        { emails: [freshEmail] }
    );
    check("an admin of another workspace may invite", outsiderInvite.status, 201);

    console.log("\n--- password reset retires every session ---");

    const forgot = await call("POST", "/auth/forgot-password", null, { email: guestEmail });
    check("forgot password", forgot.status, 200);
    checkTruthy("a dev reset token is returned when mail is unconfigured", forgot.data.devToken);

    const unknownEmail = await call("POST", "/auth/forgot-password", null, {
        email: `nobody${stamp}@test.com`
    });
    check("an unknown address is not leaked", unknownEmail.data.devToken, undefined);

    const beforeReset = await call("GET", "/organizations/mine", guest.token);
    check("the session works before the reset", beforeReset.status, 200);

    const reset = await call("POST", "/auth/reset-password", null, {
        token: forgot.data.devToken,
        password: "BrandNew123!"
    });
    check("reset password", reset.status, 200);

    const afterReset = await call("GET", "/organizations/mine", guest.token);
    check("the old access token is rejected", afterReset.status, 401);

    const oldRefresh = await call("POST", "/auth/refresh", null, {
        refreshToken: guest.refreshToken
    });
    check("the old refresh token is rejected", oldRefresh.status, 401);

    const resetReplay = await call("POST", "/auth/reset-password", null, {
        token: forgot.data.devToken,
        password: "AnotherOne123!"
    });
    check("the reset token cannot be replayed", resetReplay.status, 400);

    const relogin = await call("POST", "/auth/login", null, {
        email: guestEmail,
        password: "BrandNew123!"
    });
    check("the new password signs in", relogin.status, 200);
    checkTruthy("the new session has a token", relogin.data.token);
    checkTruthy("the new session has a refresh token", relogin.data.refreshToken);

    const newRefresh = await call("POST", "/auth/refresh", null, {
        refreshToken: relogin.data.refreshToken
    });
    check("the fresh refresh token works", newRefresh.status, 200);

    const shortPassword = await call("POST", "/auth/reset-password", null, {
        token: (await call("POST", "/auth/forgot-password", null, { email: ownerEmail })).data.devToken,
        password: "short"
    });
    check("a short password is refused", shortPassword.status, 400);

    report();
    process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
    console.error("\nFATAL", error);
    report();
    process.exit(1);
});
