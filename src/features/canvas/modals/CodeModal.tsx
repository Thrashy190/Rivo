import { useState } from "react";
import { createPortal } from "react-dom";
import { CodeEditor, type CodeLanguage } from "../../../components/CodeEditor/CodeEditor";
import { AWS_SERVICE_CATEGORIES } from "../aws-services";
import type { CanvasNode } from "../useCanvas";

const RUNTIME_LANGUAGE: Record<string, CodeLanguage> = {
  "nodejs20.x": "javascript",
  "nodejs18.x": "javascript",
  "python3.12": "python",
  "python3.11": "python",
  "python3.10": "python",
  "go1.x": "go",
  java21: "java",
  "ruby3.3": "ruby",
};

const DEFAULT_CODE: Record<CodeLanguage, string> = {
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

function getServiceIcon(type: string) {
  for (const cat of AWS_SERVICE_CATEGORIES) {
    const svc = cat.services.find((s) => s.id === type);
    if (svc) return svc.icon;
  }
  return null;
}

interface CodeModalProps {
  node: CanvasNode;
  onClose: () => void;
}

export function CodeModal({ node, onClose }: CodeModalProps) {
  const runtime = String(node.config.runtime ?? "nodejs20.x");
  const language: CodeLanguage = RUNTIME_LANGUAGE[runtime] ?? "javascript";
  const [code, setCode] = useState(DEFAULT_CODE[language]);
  const [saved, setSaved] = useState(false);

  const icon = getServiceIcon(node.type);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
        <button
          onClick={handleSave}
          className={[
            "px-3 h-8 rounded-lg text-xs font-medium transition-colors shrink-0",
            saved
              ? "bg-emerald-600 text-white"
              : "bg-indigo-600 hover:bg-indigo-500 text-white",
          ].join(" ")}
        >
          {saved ? "Saved ✓" : "Save code"}
        </button>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors shrink-0"
        >
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* File tabs strip (placeholder for multi-file support) */}
      <div className="flex items-center gap-0 px-4 border-b border-edge/60 bg-card/30 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-indigo-500 text-xs text-indigo-400 font-medium">
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 1H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4L7 1z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {language === "javascript" ? "index.js" : language === "python" ? "handler.py" : language === "go" ? "main.go" : "Handler.java"}
        </div>
        <button className="ml-2 flex items-center gap-1.5 px-2 py-1.5 text-xs text-ink-dim hover:text-ink hover:bg-raised rounded-md transition-colors">
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M6 1v10M1 6h10" />
          </svg>
          Add file
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <CodeEditor
          value={code}
          onChange={setCode}
          language={language}
          height="100%"
        />
      </div>
    </div>,
    document.body
  );
}
