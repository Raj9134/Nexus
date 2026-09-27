// Set a known password for a hand-made account in the LOCAL database, so the
// login used during development works without depending on a hash copied from
// another database. Development convenience only; it refuses to touch Atlas.
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const LOCAL = "mongodb://127.0.0.1:27017/NEXUS";

(async () => {
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)/.test(LOCAL)) {
    console.log("refusing: this script only touches the local database");
    process.exit(1);
  }

  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log("usage: node set-local-password.cjs <email> <password>");
    process.exit(1);
  }

  const conn = await mongoose
    .createConnection(LOCAL, { serverSelectionTimeoutMS: 10000 })
    .asPromise();

  const users = conn.db.collection("users");
  const hash = await bcrypt.hash(password, 10);

  const result = await users.updateOne(
    { email: email.toLowerCase() },
    { $set: { password: hash } },
  );

  if (result.matchedCount === 0) {
    console.log("no such account:", email);
  } else {
    console.log("password updated for", email, "(matched " + result.matchedCount + ")");
  }

  await conn.close();
  process.exit(0);
})().catch((error) => {
  console.log("ERR", error.message);
  process.exit(1);
});
