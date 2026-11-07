import { useState } from "react";
import { createPortal } from "react-dom";
import { CodeEditor } from "../../../components/CodeEditor/CodeEditor";
import { getServiceIcon } from "../aws-services";
import type { CanvasNode } from "../useCanvas";
import { MAX_INLINE_CODE_BYTES } from "../lambdaSource";

type LambdaLanguage = "javascript" | "typescript" | "python" | "go" | "java" | "ruby";

function runtimeLanguage(runtime: string): LambdaLanguage {
  if (runtime.startsWith("python")) return "python";
  if (runtime.startsWith("ruby")) return "ruby";
  if (runtime.startsWith("java")) return "java";
  if (runtime.startsWith("go") || runtime.startsWith("provided")) return "go";
  return "javascript";
}

// The file the handler points at: index.handler runs index.js, index.py or
// index.rb, as the Terraform generator writes it.
function handlerFile(handler: string, language: LambdaLanguage): string {
  if (language === "go") return "main.go";
  if (language === "java") return "Handler.java";
  const module = handler.includes(".") ? handler.slice(0, handler.lastIndexOf(".")) : "index";
  return `${module}${language === "python" ? ".py" : language === "ruby" ? ".rb" : ".js"}`;
}

const DEFAULT_CODE: Record<LambdaLanguage, string> = {
  javascript: `exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello from Lambda!' }),
  };
};`,
  typescript: `import { Handler } from 'aws-lambda';

export const handler: Handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello from Lambda!' }),
  };
};`,
  python: `import json

def handler(event, context):
    print('Event:', json.dumps(event, indent=2))
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Hello from Lambda!'})
    }`,
  go: `package main

import (
    "context"
    "github.com/aws/aws-lambda-go/lambda"
)

type Response struct {
    Message string \`json:"message"\`
}

func Handler(ctx context.Context) (Response, error) {
    return Response{Message: "Hello from Lambda!"}, nil
}

func main() {
    lambda.Start(Handler)
}`,
  java: `import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;

public class Handler implements RequestHandler<Object, String> {
    @Override
    public String handleRequest(Object input, Context context) {
        return "Hello from Lambda!";
    }
}`,
  ruby: `def handler(event:, context:)
  puts "Event: #{event}"
  {
    statusCode: 200,
    body: { message: 'Hello from Lambda!' }.to_json
  }
end`,
};

interface CodeModalProps {
  node: CanvasNode;
  // Roles that cannot change the project read the code without saving it.
  readOnly?: boolean;
  onSave: (code: string) => void;
  onClose: () => void;
}

export function CodeModal({ node, readOnly = false, onSave, onClose }: CodeModalProps) {
  const runtime = String(node.config.runtime ?? "nodejs22.x");
  const language = runtimeLanguage(runtime);
  const [initial] = useState(() =>
    typeof node.config.code === "string" ? node.config.code : DEFAULT_CODE[language],
  );
  const [code, setCode] = useState(initial);

  const icon = getServiceIcon(node.type);
  const bytes = new TextEncoder().encode(code).length;
  const tooBig = bytes > MAX_INLINE_CODE_BYTES;
  const changed = code !== initial || node.config.source !== "inline";

  const handleSave = () => {
    if (tooBig) return;
    onSave(code);
    onClose();
  };

  const handleClose = () => {
    if (!readOnly && code !== initial && !window.confirm("Close without keeping your changes to the code?")) return;
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-page">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-edge/60 shrink-0">
        {icon && (
          <div className="w-7 h-7 rounded-md overflow-hidden shrink-0">{icon}</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">
            {String(node.config.name ?? node.label)} — Code editor
          </p>
          <p className="text-xs text-ink-dim font-mono">{runtime}</p>
        </div>

        {/* Runtime badge */}
        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded shrink-0">
          {runtime}
        </span>

        {/* Actions */}
        {tooBig && (
          <span className="text-xs text-red-500 shrink-0">
            Over {MAX_INLINE_CODE_BYTES / 1024} KB: upload a .zip instead
          </span>
        )}
        {readOnly ? (
          <span className="text-[10px] text-ink-dim border border-edge rounded px-1.5 py-0.5 shrink-0">View only</span>
        ) : (
          <button
            onClick={handleSave}
            disabled={tooBig || !changed}
            title="Keeps the code in the diagram. Save the diagram to store it."
            className="px-3 h-8 rounded-lg text-xs font-medium transition-colors shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Use this code
          </button>
        )}

        <button
          aria-label="Close the code editor"
          onClick={handleClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors shrink-0"
        >
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* File name */}
      <div className="flex items-center gap-0 px-4 border-b border-edge/60 bg-card/30 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-indigo-500 text-xs text-indigo-400 font-medium">
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 1H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4L7 1z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {handlerFile(String(node.config.handler ?? "index.handler"), language)}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <CodeEditor
          value={code}
          onChange={setCode}
          readOnly={readOnly}
          language={language}
          height="100%"
        />
      </div>
    </div>,
    document.body
  );
}
