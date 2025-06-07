import * as path from "path";
import * as vscode from "vscode";
import {
  LanguageClient,
  TransportKind,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join("out", "server", "src", "server.js")
  );
  const ServerOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "yaml" }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/.yaml"),
    },
  };

  client = new LanguageClient(
    "yamlLspServer",
    "YAML LSP Server",
    ServerOptions,
    clientOptions
  );
  client.start();
}

export function deactive(): Thenable<void> | undefined {
  return client ? client.stop() : undefined;
}
