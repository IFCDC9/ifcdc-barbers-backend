#!/usr/bin/env node
/**
 * Prints the latest finished *store* iOS build IPA download URL from EAS.
 * Use when `eas submit` fails and Expo never attaches submission logFiles.
 *
 * Run from repo: npm run eas:ipa:url --prefix mobile
 * Or:          cd mobile && npm run eas:ipa:url
 */
const { spawnSync } = require("child_process");
const path = require("path");

const mobileRoot = path.join(__dirname, "..");
const args = [
  "eas-cli",
  "build:list",
  "-p",
  "ios",
  "-e",
  "production",
  "--distribution",
  "store",
  "--status",
  "finished",
  "--limit",
  "1",
  "--json",
  "--non-interactive",
];

const r = spawnSync("npx", args, {
  cwd: mobileRoot,
  encoding: "utf-8",
  env: process.env,
  shell: process.platform === "win32",
});

const stderr = (r.stderr || "").trim();
if (stderr) {
  process.stderr.write(stderr + "\n");
}
if (r.status !== 0) {
  process.stderr.write(`\nbuild:list exited with code ${r.status}. Log in: npx eas-cli login\n`);
  process.exit(r.status || 1);
}

let builds;
try {
  builds = JSON.parse((r.stdout || "").trim());
} catch {
  process.stderr.write("Could not parse JSON from build:list stdout.\n");
  process.exit(1);
}

if (!Array.isArray(builds) || builds.length === 0) {
  console.log("No finished store iOS builds found for profile production.");
  process.exit(0);
}

const b = builds[0];
const url = b?.artifacts?.applicationArchiveUrl;
console.log("Build ID:     ", b.id);
console.log("App version:  ", b.appVersion, "  Build number:", b.appBuildVersion);
console.log("Completed:    ", b.completedAt);
if (!url) {
  console.log("No applicationArchiveUrl on this build record (build may still be processing).");
  process.exit(0);
}
console.log("\nIPA download URL (expires after a limited time — submit or download soon):");
console.log(url);
console.log("\nSubmit this IPA to App Store Connect without downloading:");
console.log(`  npx eas-cli submit -p ios -e production --url "${url}"`);
console.log("\nOr download then submit:");
console.log(`  curl -L -o IFCDC-Barbers.ipa "${url}"`);
console.log(`  npx eas-cli submit -p ios -e production --path ./IFCDC-Barbers.ipa`);
console.log("\nOr open Apple Transporter (Mac), sign in, and drag the .ipa file.");
