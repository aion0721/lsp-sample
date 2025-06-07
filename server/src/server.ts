import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  type WatchDog,
  TextDocumentSyncKind,
  Diagnostic,
  DiagnosticSeverity,
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as jsYaml from "js-yaml";

const connection = createConnection(
  (_logger) => {
    return require("vscode-languageserver").createProtocolConnection(
      process.stdin,
      process.stdout,
      _logger
    );
  },
  {} as WatchDog,
  ProposedFeatures.all
);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { triggerCharacters: [":", '"'] },
    },
  };
});

documents.onDidChangeContent((change) => {
  validateYamlDocument(change.document);
});

documents.listen(connection);

connection.listen();

function validateYamlDocument(textDocument: TextDocument): void {
  const text = textDocument.getText();
  let yamlData: any;
  const diagnostics: Diagnostic[] = [];

  try {
    yamlData = jsYaml.load(text);
  } catch (error: any) {
    const line = error.mark?.line ?? 0;
    const col = error.mark?.column ?? 0;
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: line, character: col },
        end: { line: line, character: col + 1 },
      },
      message: `YAMLの構文エラー: ${error.message}`,
      source: "yaml-lsp",
    });
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    return;
  }

  if (typeof yamlData === "object" && yamlData !== null) {
    // Rule1: check exist servername
    if (!Object.prototype.hasOwnProperty.call(yamlData, "servername")) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
        message: "必須のキー'servername'が存在しません",
        source: "yaml-lsp",
      });
    } else {
      // Rule2: servername value is string
      const value = yamlData["servername"];
      if (typeof value !== "string") {
        const textLines = text.split(/\r?\n/);
        let lineNum = 0;
        for (let i = 0; i < textLines.length; i++) {
          if (/^servername\s*:/.test(textLines[i])) {
            lineNum = i;
            break;
          }
        }
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: lineNum, character: 0 },
            end: { line: lineNum, character: textLines[lineNum].length },
          },
          message: "キー'servername'の値は文字列である必要があります。",
          source: "yaml-lsp",
        });
      }
    }
  }
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onCompletion((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    return [];
  }

  let suggestions: CompletionItem[] = [];

  let yamlData: any;
  try {
    yamlData = jsYaml.load(doc.getText());
  } catch {
    yamlData = null;
  }

  if (
    typeof yamlData === "object" &&
    yamlData !== null &&
    !("servername" in yamlData)
  ) {
    suggestions.push({
      label: "servername",
      kind: CompletionItemKind.Property,
      insertText: "servername: ",
      insertTextFormat: InsertTextFormat.PlainText,
      detail: "サーバ名（文字列）を指定する必須プロパティ",
    });
  }

  return suggestions;
});
