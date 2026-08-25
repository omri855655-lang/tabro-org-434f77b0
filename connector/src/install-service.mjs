import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const connectorDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const node = process.execPath;

if (process.platform === "darwin") {
  const agentsDir = path.join(os.homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(agentsDir, "org.tabro.finance-connector.plist");
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>org.tabro.finance-connector</string>
<key>ProgramArguments</key><array><string>${node}</string><string>${path.join(connectorDir, "src", "index.mjs")}</string><string>daemon</string></array>
<key>WorkingDirectory</key><string>${connectorDir}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>${path.join(os.homedir(), ".tabro-finance-connector", "connector.log")}</string>
<key>StandardErrorPath</key><string>${path.join(os.homedir(), ".tabro-finance-connector", "connector-error.log")}</string>
</dict></plist>`;
  await fs.mkdir(agentsDir, { recursive: true });
  await fs.writeFile(plistPath, plist);
  await exec("launchctl", ["unload", plistPath]).catch(() => {});
  await exec("launchctl", ["load", plistPath]);
  console.log("Automatic sync installed and started for macOS.");
} else if (process.platform === "linux") {
  const serviceDir = path.join(os.homedir(), ".config", "systemd", "user");
  const servicePath = path.join(serviceDir, "tabro-finance-connector.service");
  const service = `[Unit]\nDescription=Tabro Finance Connector\nAfter=network-online.target\n\n[Service]\nExecStart=${node} ${path.join(connectorDir, "src", "index.mjs")} daemon\nWorkingDirectory=${connectorDir}\nRestart=always\n\n[Install]\nWantedBy=default.target\n`;
  await fs.mkdir(serviceDir, { recursive: true });
  await fs.writeFile(servicePath, service);
  await exec("systemctl", ["--user", "daemon-reload"]);
  await exec("systemctl", ["--user", "enable", "--now", "tabro-finance-connector.service"]);
  console.log("Automatic sync installed and started for Linux.");
} else if (process.platform === "win32") {
  const script = path.join(connectorDir, "src", "index.mjs");
  await exec("schtasks", ["/Create", "/F", "/SC", "ONLOGON", "/TN", "Tabro Finance Connector", "/TR", `\"${node}\" \"${script}\" daemon`]);
  console.log("Automatic sync task installed for Windows. It starts at the next sign-in.");
} else {
  throw new Error(`Automatic service installation is not supported on ${process.platform}. Use npm run daemon.`);
}
