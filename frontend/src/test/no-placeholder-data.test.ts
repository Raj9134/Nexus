import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards against placeholder text being shipped as if it were real state.
 *
 * These are not hypothetical. The app once rendered a channel count of
 * `item === "backend" ? 3 : 1`, a member header reading "36 members", and a
 * permanent "Raj is typing..." next to a typed composer. All three looked
 * plausible and none was true, and none would have failed a type check.
 *
 * A lint rule would be tidier, but this reads the sources the same way a
 * reviewer would and fails with the offending line.
 */

const SRC = join(process.cwd(), "src");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    // Tests assert on these strings, so scanning them would be circular.
    if (entry === "test" || entry === "node_modules") {
      return [];
    }

    const full = join(dir, entry);

    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const sourceFiles = walk(SRC).filter((file) => /\.(ts|tsx)$/.test(file));

/**
 * Strips comments so the explanatory notes that document a fixed bug do not
 * read as the bug itself. The sources are JSX-heavy, so this handles both
 * block and line comments and leaves strings alone.
 */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const read = (file: string) => stripComments(readFileSync(file, "utf8"));

/** "Raj is typing..." and friends: state that is never actually tracked. */
const NEVER_TRUE_STRINGS: Array<[RegExp, string]> = [
  [/\bis typing\.\.\./, "a permanent typing indicator; the socket event is not subscribed"],
  [/\b36 members\b/, "a hardcoded headcount"],
  [/\b12 online\b/, "a hardcoded online count"],
];

describe("no placeholder text shipped as state", () => {
  it.each(NEVER_TRUE_STRINGS)("has no %s (%s)", (pattern, reason) => {
    const offenders = sourceFiles
      .filter((file) => pattern.test(read(file)))
      .map((file) => file.replace(SRC + "\\", ""));

    expect(
      offenders,
      `Found placeholder text matching ${pattern} (${reason}) in: ${offenders.join(", ") || "nowhere"}`,
    ).toEqual([]);
  });

  it("has no inline ternaries that fake a count", () => {
    const offenders: string[] = [];

    /*
      The bug was `item === "backend" ? 3 : 1`: a number keyed off a name,
      standing in for a per-item count. A calendar grid legitimately does
      `view === "Day" ? 1 : view === "Week" ? 7 : 28`, which is a real mapping
      and not a stand-in, so the guard looks for a number keyed off a lowercase
      identifier rather than a title-cased view name.
    */
    const fakedCount = /===\s*"[a-z][a-z-]*"\s*\?\s*\d+\s*:\s*\d+/;

    for (const file of sourceFiles) {
      if (fakedCount.test(read(file))) {
        offenders.push(file.replace(SRC + "\\", ""));
      }
    }

    expect(offenders, `Hardcoded counts in: ${offenders.join(", ") || "nowhere"}`).toEqual([]);
  });
});

describe("seed data stays in the seed", () => {
  it("is only imported by the context that treats it as a placeholder", () => {
    const importers = sourceFiles.filter((file) => /from "@\/data\/mockData"/.test(read(file)));

    // Exactly one importer: the provider, which uses it as the signed-out
    // state and replaces it on hydration.
    expect(importers.map((file) => file.replace(SRC + "\\", ""))).toEqual([
      "context\\NexusContext.tsx",
    ]);
  });

  it("is never labelled as live", () => {
    const offenders = sourceFiles
      .filter((file) => /mockData/.test(read(file)))
      .filter((file) => /isDemo|seed/i.test(read(file)) === false);

    expect(offenders).toEqual([]);
  });
});

describe("the workspace switcher", () => {
  /*
    Found by signing in as a second account: the shell printed
    "Raj's Organization" and listed three hardcoded names no matter who was
    signed in, and clicking one only showed a "Switched to ..." toast while the
    app carried on showing what it had already loaded.
  */
  const shell = read(join(SRC, "components", "nexus", "AppShell.tsx"));

  it("renders the loaded workspace name, not a literal", () => {
    expect(shell).toContain("{nexus.organization}");
    expect(shell).not.toMatch(/Sandbox Workspace/);
  });

  it("lists the workspaces the user actually belongs to", () => {
    expect(shell).toContain("nexus.organizations.map");
  });

  it("switches rather than only announcing the switch", () => {
    // A toast is not a switch: the click has to change state.
    expect(shell).toContain("nexus.switchOrganization(org.id)");
    expect(shell).not.toContain("pushToast(`Switched to ${org}`");
  });

  it("offers no menu when there is only one workspace to switch between", () => {
    // A dropdown with a single entry is a control that cannot do anything.
    expect(shell).toMatch(/organizations\.length > 1/);
  });
});

describe("the signed-in user", () => {
  /*
    The same shell rendered "Raj Kumar Mishra / Backend Developer" for whoever
    was signed in, with a correct avatar right beside it, so a second user saw
    their own initials above someone else's name.
  */
  const shell = read(join(SRC, "components", "nexus", "AppShell.tsx"));

  it("names the signed-in user from state, not a literal", () => {
    expect(shell).toContain("{nexus.currentUser.name}");
    expect(shell).not.toMatch(/Raj Kumar Mishra/);
  });

  it("labels the signed-in user with their real role", () => {
    expect(shell).toContain("{nexus.currentUser.role}");
    expect(shell).not.toMatch(/Backend Developer/);
  });
});

describe("controls that claim to have done something", () => {
  /*
    "Help & Support" showed a "Support team has been notified" toast and sent
    nothing, so the message was never recorded anywhere. A toast that claims an
    outcome is the same bug class as a hardcoded number: the UI reports success
    while no work happened.
  */
  const shell = read(join(SRC, "components", "nexus", "AppShell.tsx"));

  it("has no toast asserting an action was taken on the user's behalf", () => {
    const claims = shell.match(/pushToast\("[^"]*(has been|notified|sent to|we have)[^"]*"/gi);

    expect(
      claims,
      `Toast claims an action happened with no request behind it: ${claims?.join(", ") ?? ""}`,
    ).toBeNull();
  });

  it("sends the support form to the API", () => {
    expect(shell).toContain("api.support.send(");
    expect(shell).toContain('openModal("support")');
  });
});

describe("file controls", () => {
  /*
    Every way of getting a file into the app was dead. The Files page "Upload"
    modal asked for a name, a priority and notes, and its Save button ran the
    generic submit, which set a timer and printed a toast. The channel
    composer's paperclip printed "Attachment picker opened" and the direct
    thread's was hardcoded `disabled`. The backend has accepted uploads the
    whole time.
  */
  const shell = read(join(SRC, "components", "nexus", "AppShell.tsx"));
  const pages = read(join(SRC, "pages", "AppPages.tsx"));
  const thread = read(join(SRC, "components", "nexus", "DirectThread.tsx"));

  it("the Files page upload modal has a real picker, not a name field", () => {
    expect(shell).toContain('type="file"');
    expect(shell).toMatch(/api\.files\.upload\(uploadSelection/);
  });

  it("the channel composer posts the file instead of announcing a picker", () => {
    expect(pages).toContain("api.files.sendToChannel(");
    expect(pages).not.toContain("Attachment picker opened");
  });

  it("the direct thread paperclip is enabled and sends", () => {
    expect(thread).toContain("api.files.sendAsMessage(");
    // `disabled` with no condition, next to the aria-label, is the old bug.
    expect(thread).not.toMatch(/aria-label="Attach a file"[^>]*\sdisabled\s*>/);
  });

  it("every file input clears so the same file can be picked twice", () => {
    for (const [name, source] of [
      ["channel composer", pages],
      ["direct thread", thread],
    ] as const) {
      expect(source, `${name} must reset its input`).toContain('event.target.value = ""');
    }
  });

  /*
    Folders are derived from the files that exist, so the Files page's
    "Create Folder" button could only ever lie: it printed "Folder created"
    and stored nothing, and no route has ever created a folder. A folder is
    made by uploading a file into it, so the button is gone and the upload form
    asks for the folder instead.
  */
  it("has no create-folder button that stores nothing", () => {
    expect(pages).not.toContain("Folder created");
    expect(pages).not.toContain("Create Folder");
  });

  it("sorts and filters the real list rather than announcing it", () => {
    expect(pages).not.toContain("Sort changed");
    expect(pages).toContain('setSort(next as "name" | "size")');
  });

  it("puts the folder in the folder sidebar when a file is uploaded", () => {
    expect(shell).toContain("api.files.upload(uploadSelection, uploadFolder)");
  });
});
