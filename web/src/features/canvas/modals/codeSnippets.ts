// Snippets the code editor suggests, in Monaco's snippet syntax ($1, ${1:text}).
// Environment variables from the function's connections fill them in.

export interface Snippet {
  label: string;
  detail: string;
  body: string;
}

const pick = (env: string[], suffix: string, fallback: string) => env.find((e) => e.endsWith(suffix)) ?? fallback;

// Monaco treats $ and } as snippet syntax, so literal text escapes them.
const esc = (s: string) => s.replace(/[$}\\]/g, (c) => `\\${c}`);

export function snippetsFor(language: "python" | "javascript", env: string[]): Snippet[] {
  const table = esc(pick(env, "_TABLE", "MY_TABLE"));
  const bucket = esc(pick(env, "_BUCKET", "MY_BUCKET"));
  if (language === "python") {
    return [
      {
        label: "handler",
        detail: "Lambda handler",
        body: "def handler(event, context):\n    ${1:pass}\n    return {\"statusCode\": 200, \"body\": json.dumps(${2:{}})}\n",
      },
      {
        label: "respond",
        detail: "JSON response for API Gateway",
        body: "return {\n    \"statusCode\": ${1:200},\n    \"headers\": {\"Content-Type\": \"application/json\"},\n    \"body\": json.dumps(${2:body}),\n}",
      },
      {
        label: "body",
        detail: "Read the JSON body of an API Gateway request",
        body: "raw = event.get(\"body\") or \"\"\nif event.get(\"isBase64Encoded\"):\n    raw = base64.b64decode(raw).decode(\"utf-8\")\n${1:body} = json.loads(raw or \"{}\")",
      },
      {
        label: "table",
        detail: "boto3 DynamoDB table",
        body: `\${1:table} = boto3.resource("dynamodb").Table(os.environ["\${2:${table}}"])`,
      },
      {
        label: "query",
        detail: "Query a table or one of its indexes",
        body: "from boto3.dynamodb.conditions import Key\n\nresult = ${1:table}.query(\n    IndexName=\"${2:by-status}\",\n    KeyConditionExpression=Key(\"${3:status}\").eq(${4:value}),\n)\nitems = result[\"Items\"]",
      },
      {
        label: "bucket",
        detail: "boto3 S3 client and bucket name",
        body: `s3 = boto3.client("s3")\nbucket = os.environ["\${1:${bucket}}"]`,
      },
      {
        label: "put_events",
        detail: "Send an event to EventBridge",
        body: "boto3.client(\"events\").put_events(Entries=[{\n    \"EventBusName\": os.environ[\"EVENT_BUS_NAME\"],\n    \"Source\": \"${1:my.app}\",\n    \"DetailType\": \"${2:thing.happened}\",\n    \"Detail\": json.dumps(${3:{}}),\n}])",
      },
      {
        label: "log",
        detail: "Structured log line",
        body: "logger.info(json.dumps({\"${1:message}\": ${2:value}}))",
      },
    ];
  }
  return [
    {
      label: "handler",
      detail: "Lambda handler",
      body: "exports.handler = async (event) => {\n  $1\n  return { statusCode: 200, body: JSON.stringify(${2:{}}) };\n};",
    },
    {
      label: "table",
      detail: "DynamoDB document client",
      body: `const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");\nconst { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");\n\nconst db = DynamoDBDocumentClient.from(new DynamoDBClient({}));\nconst table = process.env.\${1:${table}};`,
    },
  ];
}
