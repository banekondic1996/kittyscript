import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { compile } from "kittyscript";

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection("kittyscript");
  context.subscriptions.push(diagnosticCollection);

  // Lint on open
  if (vscode.window.activeTextEditor?.document.languageId === "kittyscript") {
    lintDocument(vscode.window.activeTextEditor.document);
  }

  // Lint on change (debounced)
  let debounceTimer: NodeJS.Timeout;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId !== "kittyscript") return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => lintDocument(e.document), 400);
    })
  );

  // Lint on open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === "kittyscript") lintDocument(doc);
    })
  );

  // Compile on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.languageId !== "kittyscript") return;
      const config = vscode.workspace.getConfiguration("kittyscript");
      if (config.get("compileOnSave")) {
        compileDocument(doc, true);
      }
    })
  );

  // Command: compile current file
  context.subscriptions.push(
    vscode.commands.registerCommand("kittyscript.compile", () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (!doc || doc.languageId !== "kittyscript") {
        vscode.window.showWarningMessage("Open a .kss file first 🐱");
        return;
      }
      compileDocument(doc, false);
    })
  );

  // Command: compile all .kss files
  context.subscriptions.push(
    vscode.commands.registerCommand("kittyscript.compileAll", async () => {
      const files = await vscode.workspace.findFiles("**/*.kss", "**/node_modules/**");
      let compiled = 0;
      let failed = 0;
      for (const file of files) {
        const doc = await vscode.workspace.openTextDocument(file);
        const ok = compileDocument(doc, false);
        if (ok) compiled++; else failed++;
      }
      vscode.window.showInformationMessage(
        `KittyScript: compiled ${compiled} file(s)${failed ? `, ${failed} with errors` : ""} 🐱`
      );
    })
  );

  console.log("KittyScript extension activated 🐱");
}

function lintDocument(doc: vscode.TextDocument) {
  const source = doc.getText();
  const result = compile(source, doc.fileName);

  const diagnostics: vscode.Diagnostic[] = [];

  for (const err of result.errors) {
    const line = (err.line ?? 1) - 1;
    const col = err.column ?? 0;
    const range = new vscode.Range(
      new vscode.Position(Math.max(0, line), col),
      new vscode.Position(Math.max(0, line), col + 100)
    );
    const diagnostic = new vscode.Diagnostic(
      range,
      err.message,
      vscode.DiagnosticSeverity.Error
    );
    diagnostic.source = "KittyScript 🐱";
    diagnostics.push(diagnostic);
  }

  diagnosticCollection.set(doc.uri, diagnostics);
}

function compileDocument(doc: vscode.TextDocument, silent: boolean): boolean {
  const source = doc.getText();
  const result = compile(source, doc.fileName);

  if (result.errors.length > 0) {
    if (!silent) {
      vscode.window.showErrorMessage(`KittyScript: ${result.errors[0].message}`);
    }
    return false;
  }

  // Determine output path
  const config = vscode.workspace.getConfiguration("kittyscript");
  const outputDir = config.get<string>("outputDir") || "";

  const inputPath = doc.fileName;
  let outputPath: string;

  if (outputDir) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
    const relPath = path.relative(workspaceRoot, inputPath);
    outputPath = path.join(workspaceRoot, outputDir, relPath.replace(/\.kss$/, ".js"));
  } else {
    outputPath = inputPath.replace(/\.kss$/, ".js");
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, result.code!, "utf-8");

  if (!silent) {
    vscode.window.showInformationMessage(
      `KittyScript: compiled → ${path.basename(outputPath)} 🐱`
    );
  }

  return true;
}

export function deactivate() {
  diagnosticCollection?.dispose();
}
