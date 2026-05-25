#!/usr/bin/env node
/**
 * Print SHA1 (and SHA256) for an Android upload keystore so you can compare
 * with Google Play Console → App integrity → Upload key certificate.
 *
 * Requires JDK keytool on PATH.
 *
 * Usage:
 *   ANDROID_KEYSTORE_PATH=/path/to/upload.jks \
 *   ANDROID_KEYSTORE_PASSWORD=... \
 *   ANDROID_KEY_ALIAS=... \
 *   ANDROID_KEY_PASSWORD=... \   # optional if same as store password
 *   node scripts/verify-android-keystore-sha1.mjs
 *
 * Expected IFCDC Barbers upload cert (from Play error message):
 *   SHA1: 7F:5A:F4:AE:44:C6:59:50:D6:96:85:E6:DE:F0:7E:DD:49:A4:EB:14
 */
import { spawnSync } from "node:child_process";

const keystore = process.env.ANDROID_KEYSTORE_PATH;
const storePass = process.env.ANDROID_KEYSTORE_PASSWORD;
const alias = process.env.ANDROID_KEY_ALIAS;
const keyPass = process.env.ANDROID_KEY_PASSWORD || storePass;

if (!keystore || !storePass || !alias) {
  console.error(
    "Missing env vars. Set ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS (optional: ANDROID_KEY_PASSWORD)",
  );
  process.exit(1);
}

const args = [
  "-list",
  "-v",
  "-keystore",
  keystore,
  "-alias",
  alias,
  "-storepass",
  storePass,
];
if (keyPass && keyPass !== storePass) {
  args.push("-keypass", keyPass);
}

const r = spawnSync("keytool", args, { encoding: "utf8" });
if (r.error) {
  console.error(r.error.message);
  console.error("Install a JDK and ensure `keytool` is on your PATH.");
  process.exit(1);
}
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(r.status ?? 1);
}

const out = r.stdout || r.stderr;
console.log(out);

const sha1Raw = out.match(/SHA1:\s*([0-9a-fA-F:]+)/)?.[1]?.trim();
const sha1 = sha1Raw ? sha1Raw.toUpperCase() : null;
const expected = "7F:5A:F4:AE:44:C6:59:50:D6:96:85:E6:DE:F0:7E:DD:49:A4:EB:14";
if (sha1) {
  console.log("\n---");
  if (sha1.replace(/:/g, "") === expected.replace(/:/g, "").toUpperCase()) {
    console.log("SHA1 matches Google Play’s expected UPLOAD certificate. Use this keystore on Expo / EAS.");
  } else {
    console.log("SHA1 does NOT match Play’s expected upload cert.");
    console.log("  This file:     ", sha1);
    console.log("  Play expects:  ", expected);
    console.log("Do not use this file for Play until you either switch to the correct keystore or complete an upload-key reset in Play Console.");
  }
}
