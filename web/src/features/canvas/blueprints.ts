/**
 * Ready-made diagrams people can drop on the canvas. Each one generates
 * Terraform that works as is: the placeholders answer until real code and
 * files replace them.
 */

import type { CanvasGraph } from "./useCanvas";

export interface Blueprint {
  id: string;
  name: string;
  description: string;
  services: string[];
  graph: CanvasGraph;
}

const ITEMS_HANDLER = `const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table = process.env.ITEMS_TABLE;

exports.handler = async (event) => {
  if (event.requestContext.http.method === "POST") {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body;
    const item = { id: Date.now().toString(), ...JSON.parse(raw || "{}") };
    await db.send(new PutCommand({ TableName: table, Item: item }));
    return { statusCode: 201, body: JSON.stringify(item) };
  }
  const { Items } = await db.send(new ScanCommand({ TableName: table }));
  return { statusCode: 200, body: JSON.stringify(Items) };
};
`;

const WORKER_HANDLER = `exports.handler = async (event) => {
  // A scheduled run has detail-type "Scheduled Event"; others carry their own.
  console.log(JSON.stringify({ type: event["detail-type"], source: event.source, detail: event.detail }));
  return { ok: true };
};
`;

const PUBLISHER_HANDLER = `const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");

const events = new EventBridgeClient({});

exports.handler = async () => {
  await events.send(new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.EVENT_BUS_NAME,
      Source: "shop.orders",
      DetailType: "order.created",
      Detail: JSON.stringify({ orderId: Date.now().toString() }),
    }],
  }));
  return { statusCode: 202, body: JSON.stringify({ sent: true }) };
};
`;

export const BLUEPRINTS: Blueprint[] = [
  {
    id: "static-site",
    name: "Static website",
    description: "A private S3 bucket served over HTTPS by CloudFront.",
    services: ["s3", "cloudfront"],
    graph: {
      nodes: [
        { type: "cloudfront", offset: { x: 0, y: 0 }, config: { name: "website-cdn", spa: true } },
        { type: "s3", offset: { x: 320, y: 0 }, config: { name: "website", forceDestroy: true } },
      ],
      links: [{ from: 0, to: 1 }],
    },
  },
  {
    id: "serverless-api",
    name: "Serverless API",
    description: "HTTP routes on API Gateway, a Lambda function and a DynamoDB table.",
    services: ["api-gateway", "lambda", "dynamodb"],
    graph: {
      nodes: [
        { type: "api-gateway", offset: { x: 0, y: 0 }, config: { name: "items-api" } },
        { type: "lambda", offset: { x: 320, y: 0 }, config: { name: "items-handler", source: "inline", code: ITEMS_HANDLER } },
        { type: "dynamodb", offset: { x: 640, y: 0 }, config: { name: "items", partitionKey: "id" } },
      ],
      links: [
        { from: 0, to: 1, config: { routes: [{ method: "GET", path: "/items" }, { method: "POST", path: "/items" }] } },
        { from: 1, to: 2, config: { access: "readwrite" } },
      ],
    },
  },
  {
    id: "event-driven",
    name: "Event-driven",
    description: "EventBridge runs a function on a schedule and on events another function sends.",
    services: ["eventbridge", "lambda"],
    graph: {
      nodes: [
        { type: "eventbridge", offset: { x: 0, y: 0 }, config: { name: "every-5-minutes", trigger: "schedule", schedule: "rate(5 minutes)" } },
        { type: "lambda", offset: { x: 320, y: 70 }, config: { name: "worker", source: "inline", code: WORKER_HANDLER } },
        { type: "eventbridge", offset: { x: 0, y: 140 }, config: { name: "order-created", trigger: "pattern", eventPattern: '{"source": ["shop.orders"], "detail-type": ["order.created"]}' } },
        { type: "lambda", offset: { x: -320, y: 140 }, config: { name: "publisher", source: "inline", code: PUBLISHER_HANDLER } },
      ],
      links: [
        { from: 0, to: 1 },
        { from: 2, to: 1 },
        { from: 3, to: 2 },
      ],
    },
  },
];
