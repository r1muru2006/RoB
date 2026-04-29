/**
 * FSA API call logger using Puppeteer.
 * Hooks all FSA API functions in the browser and logs call sequences.
 *
 * Usage: node fsa_hook.js <url> [output.json]
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const FSA_FUNCTIONS = [
  "showDirectoryPicker",
  "showOpenFilePicker",
  "showSaveFilePicker",
];

const FILE_HANDLE_METHODS = [
  "getFile",
  "createWritable",
  "isSameEntry",
  "queryPermission",
  "requestPermission",
];

const DIR_HANDLE_METHODS = [
  "getFileHandle",
  "getDirectoryHandle",
  "removeEntry",
  "resolve",
  "values",
  "keys",
  "entries",
];

const WRITABLE_METHODS = ["write", "seek", "truncate", "close"];

async function main() {
  const url = process.argv[2] || "https://googlechromelabs.github.io/text-editor/";
  const outputFile = process.argv[3] || "fsa_log.json";

  console.log(`[*] Launching browser and navigating to: ${url}`);

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--enable-features=FileSystemAccess"],
  });

  const page = await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    window.__fsaLog = [];

    function logCall(name) {
      window.__fsaLog.push({
        fn: name,
        ts: Date.now(),
      });
    }

    const origShowDirPicker = window.showDirectoryPicker;
    if (origShowDirPicker) {
      window.showDirectoryPicker = async function (...args) {
        logCall("showDirectoryPicker");
        return origShowDirPicker.apply(this, args);
      };
    }

    const origShowOpenPicker = window.showOpenFilePicker;
    if (origShowOpenPicker) {
      window.showOpenFilePicker = async function (...args) {
        logCall("showOpenFilePicker");
        return origShowOpenPicker.apply(this, args);
      };
    }

    const origShowSavePicker = window.showSaveFilePicker;
    if (origShowSavePicker) {
      window.showSaveFilePicker = async function (...args) {
        logCall("showSaveFilePicker");
        return origShowSavePicker.apply(this, args);
      };
    }

    const fileHandleMethods = [
      "getFile", "createWritable", "isSameEntry",
      "queryPermission", "requestPermission",
    ];
    for (const method of fileHandleMethods) {
      const orig = FileSystemFileHandle.prototype[method];
      if (orig) {
        FileSystemFileHandle.prototype[method] = function (...args) {
          logCall(method);
          return orig.apply(this, args);
        };
      }
    }

    const dirHandleMethods = [
      "getFileHandle", "getDirectoryHandle", "removeEntry",
      "resolve", "values", "keys", "entries",
    ];
    for (const method of dirHandleMethods) {
      const orig = FileSystemDirectoryHandle.prototype[method];
      if (orig) {
        FileSystemDirectoryHandle.prototype[method] = function (...args) {
          logCall(method);
          return orig.apply(this, args);
        };
      }
    }

    const writableMethods = ["write", "seek", "truncate", "close"];
    for (const method of writableMethods) {
      if (FileSystemWritableFileStream && FileSystemWritableFileStream.prototype[method]) {
        const orig = FileSystemWritableFileStream.prototype[method];
        FileSystemWritableFileStream.prototype[method] = function (...args) {
          logCall(method);
          return orig.apply(this, args);
        };
      }
    }
  });

  await page.goto(url, { waitUntil: "networkidle2" });
  console.log("[*] Page loaded. Interact with the web app to generate FSA API calls.");
  console.log("[*] Press Ctrl+C to stop and save the log.\n");

  process.on("SIGINT", async () => {
    console.log("\n[*] Collecting FSA API call log...");
    const log = await page.evaluate(() => window.__fsaLog);

    const output = {
      url,
      timestamp: new Date().toISOString(),
      total_calls: log.length,
      fsa_calls: log.map((entry) => entry.fn),
      raw_log: log,
    };

    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`[+] Saved ${log.length} FSA API calls to ${outputFile}`);

    await browser.close();
    process.exit(0);
  });

  await new Promise(() => {});
}

main().catch(console.error);
