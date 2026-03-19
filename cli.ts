#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { compile } from "./compiler";

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
🐱 KittyScript Compiler v0.1.0

Usage:
  ksc <file.kss>              Compile a .kss file to .js
  ksc <file.kss> -o <out.js>  Compile with specific output path
  ksc check <file.kss>        Check for errors without outputting
  ksc --help                 Show this help

Examples:
  ksc app.kss
  ksc src/index.kss -o dist/index.js
  ksc check src/app.kss
`);
}

function formatError(file: string, err: { message: string; line?: number; column?: number }) {
  const loc = err.line ? `:${err.line}${err.column !== undefined ? `:${err.column}` : ""}` : "";
  return `\x1b[31m✗\x1b[0m ${file}${loc}\n  ${err.message}`;
}

if (args.length === 0 || args[0] === "--help") {
  printHelp();
  process.exit(0);
}

const checkOnly = args[0] === "check";
const fileArg = checkOnly ? args[1] : args[0];

if (!fileArg) {
  console.error("Error: no file specified");
  process.exit(1);
}

const inputPath = path.resolve(fileArg);

if (!fs.existsSync(inputPath)) {
  console.error(`Error: file not found: ${inputPath}`);
  process.exit(1);
}

if (!inputPath.endsWith(".kss")) {
  console.error(`Error: KittyScript files must have a .kss extension`);
  process.exit(1);
}

const source = fs.readFileSync(inputPath, "utf-8");
const result = compile(source, inputPath);

if (result.errors.length > 0) {
  for (const err of result.errors) {
    console.error(formatError(path.basename(inputPath), err));
  }
  process.exit(1);
}

if (checkOnly) {
  console.log(`\x1b[32m✓\x1b[0m ${path.basename(inputPath)} — no errors 🐱`);
  process.exit(0);
}

// Determine output path
let outputPath: string;
const outFlagIndex = args.indexOf("-o");
if (outFlagIndex !== -1 && args[outFlagIndex + 1]) {
  outputPath = path.resolve(args[outFlagIndex + 1]);
} else {
  outputPath = inputPath.replace(/\.kss$/, ".js");
}

fs.writeFileSync(outputPath, result.code!, "utf-8");
console.log(`\x1b[32m✓\x1b[0m ${path.basename(inputPath)} → ${path.basename(outputPath)} 🐱`);
