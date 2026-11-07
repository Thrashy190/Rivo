// Serve Monaco from this app. By default @monaco-editor/react downloads a fixed
// version from a public CDN, which ignores the version in package.json and does
// not load on a network without internet access.
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import JsonWorker from "monaco-editor/language/json/json.worker.js?worker";
import HtmlWorker from "monaco-editor/language/html/html.worker.js?worker";
import CssWorker from "monaco-editor/language/css/css.worker.js?worker";
import TypeScriptWorker from "monaco-editor/language/typescript/ts.worker.js?worker";

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === "typescript" || label === "javascript") return new TypeScriptWorker();
    if (label === "json") return new JsonWorker();
    if (label === "html") return new HtmlWorker();
    if (label === "css") return new CssWorker();
    return new EditorWorker();
  },
};

loader.config({ monaco });
