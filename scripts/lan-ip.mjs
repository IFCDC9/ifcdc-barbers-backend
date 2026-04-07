#!/usr/bin/env node
import { execSync } from "node:child_process";
import os from "node:os";

function tryExec(cmd) {
  try {
    return String(execSync(cmd, { encoding: "utf8" })).trim();
  } catch {
    return "";
  }
}

function fromInterfaces() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      const fam = n.family;
      const isV4 = fam === "IPv4" || fam === 4;
      if (isV4 && !n.internal) return n.address;
    }
  }
  return "";
}

const mac = tryExec("ipconfig getifaddr en0") || tryExec("ipconfig getifaddr en1");
const ip = mac || fromInterfaces();
if (!ip) {
  console.error("Could not detect LAN IPv4. Set EXPO_PUBLIC_API_URL manually in mobile/.env.");
  process.exit(1);
}
console.log(ip);
