/**
 * Ready-made diagrams people can drop on the canvas. Each one generates
 * Terraform that works as is, and every function is Python with only the
 * libraries the runtime includes (boto3), so nothing needs installing.
 */

import type { CanvasGraph } from "./useCanvas";

export interface Blueprint {
  id: string;
  name: string;
  description: string;
  services: string[];
  graph: CanvasGraph;
}

// Settings every blueprint function shares.
const PYTHON = { runtime: "python3.13", architecture: "arm64", handler: "app.handler", memory: 256, timeout: 10, source: "inline" };

const LIST_ITEMS = `"""GET /items: one page of items, newest first within the page.

Query parameters:
  limit   1 to 100, 25 by default
  cursor  the nextCursor of the previous page
"""
import base64
import json
import logging
import os
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

table = boto3.resource("dynamodb").Table(os.environ["ITEMS_TABLE"])


def handler(event, context):
    params = event.get("queryStringParameters") or {}
    try:
        limit = int(params.get("limit", "25"))
    except ValueError:
        return error(400, "invalid_limit", "limit must be a number from 1 to 100")
    if not 1 <= limit <= 100:
        return error(400, "invalid_limit", "limit must be a number from 1 to 100")

    scan = {"Limit": limit}
    if params.get("cursor"):
        try:
            scan["ExclusiveStartKey"] = json.loads(base64.urlsafe_b64decode(params["cursor"]))
        except ValueError:
            return error(400, "invalid_cursor", "cursor is not one this API returned")

    page = table.scan(**scan)
    items = sorted(page.get("Items", []), key=lambda i: i.get("createdAt", ""), reverse=True)
    cursor = None
    if "LastEvaluatedKey" in page:
        cursor = base64.urlsafe_b64encode(json.dumps(page["LastEvaluatedKey"], default=str).encode()).decode()

    logger.info(json.dumps({"route": "GET /items", "count": len(items), "requestId": context.aws_request_id}))
    return respond(200, {"items": items, "nextCursor": cursor})


def respond(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=to_json),
    }


def error(status, code, message):
    return respond(status, {"error": {"code": code, "message": message}})


def to_json(value):
    # DynamoDB returns numbers as Decimal.
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError(f"{type(value).__name__} is not JSON")
`;

const GET_ITEM = `"""GET /items/{id}: one item, or 404."""
import json
import logging
import os
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

table = boto3.resource("dynamodb").Table(os.environ["ITEMS_TABLE"])


def handler(event, context):
    item_id = (event.get("pathParameters") or {}).get("id", "")
    item = table.get_item(Key={"id": item_id}).get("Item")
    logger.info(json.dumps({"route": "GET /items/{id}", "id": item_id, "found": item is not None, "requestId": context.aws_request_id}))
    if item is None:
        return error(404, "not_found", f"there is no item {item_id}")
    return respond(200, item)


def respond(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=to_json),
    }


def error(status, code, message):
    return respond(status, {"error": {"code": code, "message": message}})


def to_json(value):
    # DynamoDB returns numbers as Decimal.
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError(f"{type(value).__name__} is not JSON")
`;

const CREATE_ITEM = `"""POST /items: creates an item from a JSON object with at least a name.

  {"name": "Coffee beans", "price": 12.5, "tags": ["food"]}

Answers 201 with the item, which gets an id and timestamps.
"""
import base64
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

table = boto3.resource("dynamodb").Table(os.environ["ITEMS_TABLE"])

RESERVED = {"id", "createdAt", "updatedAt"}


def handler(event, context):
    body, problem = read_json(event)
    if problem:
        return error(400, "invalid_body", problem)
    name = body.get("name")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 200:
        return error(400, "invalid_name", "name must be text of 1 to 200 characters")
    if RESERVED & body.keys():
        return error(400, "reserved_field", "id, createdAt and updatedAt are set by the API")

    now = datetime.now(timezone.utc).isoformat()
    item = {**body, "name": name.strip(), "id": str(uuid.uuid4()), "createdAt": now, "updatedAt": now}
    table.put_item(Item=item, ConditionExpression="attribute_not_exists(id)")

    logger.info(json.dumps({"route": "POST /items", "id": item["id"], "requestId": context.aws_request_id}))
    response = respond(201, item)
    response["headers"]["Location"] = f"/items/{item['id']}"
    return response


def read_json(event):
    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    try:
        # DynamoDB stores numbers as Decimal, not float.
        body = json.loads(raw or "{}", parse_float=Decimal)
    except ValueError:
        return None, "the body is not valid JSON"
    if not isinstance(body, dict):
        return None, "send a JSON object"
    return body, None


def respond(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=to_json),
    }


def error(status, code, message):
    return respond(status, {"error": {"code": code, "message": message}})


def to_json(value):
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError(f"{type(value).__name__} is not JSON")
`;

const UPDATE_ITEM = `"""PATCH /items/{id}: changes the fields sent, keeps the rest.

  {"price": 14, "tags": ["food", "sale"]}

Answers 200 with the whole item, or 404 if it does not exist.
"""
import base64
import json
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

table = boto3.resource("dynamodb").Table(os.environ["ITEMS_TABLE"])

RESERVED = {"id", "createdAt", "updatedAt"}


def handler(event, context):
    item_id = (event.get("pathParameters") or {}).get("id", "")
    body, problem = read_json(event)
    if problem:
        return error(400, "invalid_body", problem)
    if not body:
        return error(400, "nothing_to_change", "send at least one field")
    if RESERVED & body.keys():
        return error(400, "reserved_field", "id, createdAt and updatedAt are set by the API")
    if "name" in body and (not isinstance(body["name"], str) or not 1 <= len(body["name"].strip()) <= 200):
        return error(400, "invalid_name", "name must be text of 1 to 200 characters")

    body["updatedAt"] = datetime.now(timezone.utc).isoformat()
    # Placeholders keep field names that are DynamoDB reserved words working.
    names = {f"#f{i}": key for i, key in enumerate(body)}
    values = {f":v{i}": value for i, value in enumerate(body.values())}
    sets = ", ".join(f"#f{i} = :v{i}" for i in range(len(body)))
    try:
        result = table.update_item(
            Key={"id": item_id},
            UpdateExpression=f"SET {sets}",
            ConditionExpression="attribute_exists(id)",
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW",
        )
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        return error(404, "not_found", f"there is no item {item_id}")

    logger.info(json.dumps({"route": "PATCH /items/{id}", "id": item_id, "fields": sorted(body), "requestId": context.aws_request_id}))
    return respond(200, result["Attributes"])


def read_json(event):
    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    try:
        body = json.loads(raw or "{}", parse_float=Decimal)
    except ValueError:
        return None, "the body is not valid JSON"
    if not isinstance(body, dict):
        return None, "send a JSON object"
    return body, None


def respond(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=to_json),
    }


def error(status, code, message):
    return respond(status, {"error": {"code": code, "message": message}})


def to_json(value):
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError(f"{type(value).__name__} is not JSON")
`;

const DELETE_ITEM = `"""DELETE /items/{id}: removes the item. Answers 204, or 404 if it does not exist."""
import json
import logging
import os

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

table = boto3.resource("dynamodb").Table(os.environ["ITEMS_TABLE"])


def handler(event, context):
    item_id = (event.get("pathParameters") or {}).get("id", "")
    try:
        table.delete_item(Key={"id": item_id}, ConditionExpression="attribute_exists(id)")
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": {"code": "not_found", "message": f"there is no item {item_id}"}}),
        }
    logger.info(json.dumps({"route": "DELETE /items/{id}", "id": item_id, "requestId": context.aws_request_id}))
    return {"statusCode": 204}
`;

const WORKER = `"""Runs on the schedule and on every order.created event.

A scheduled run has detail-type "Scheduled Event"; events from other
functions carry their own source and detail.
"""
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    kind = event.get("detail-type")
    logger.info(json.dumps({"type": kind, "source": event.get("source"), "detail": event.get("detail"), "requestId": context.aws_request_id}))

    if kind == "Scheduled Event":
        # Periodic work goes here: cleanups, reports, syncs.
        return {"ok": True, "ran": "schedule"}

    order = event.get("detail") or {}
    # React to the order here: send an email, reserve stock, call a webhook.
    return {"ok": True, "order": order.get("orderId")}
`;

const PUBLISHER = `"""Sends an order.created event to the default event bus.

Invoke it with {"orderId": "..."}, or with nothing to get a new ID.
"""
import json
import logging
import os
import uuid

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

events = boto3.client("events")


def handler(event, context):
    order_id = (event or {}).get("orderId") or str(uuid.uuid4())
    result = events.put_events(
        Entries=[
            {
                "EventBusName": os.environ["EVENT_BUS_NAME"],
                "Source": "shop.orders",
                "DetailType": "order.created",
                "Detail": json.dumps({"orderId": order_id}),
            }
        ]
    )
    if result["FailedEntryCount"]:
        logger.error(json.dumps({"failed": result["Entries"]}))
        raise RuntimeError("EventBridge did not take the event")

    logger.info(json.dumps({"sent": order_id, "requestId": context.aws_request_id}))
    return {"sent": True, "orderId": order_id}
`;

// One function per route: each can be changed, scaled and given access on
// its own, and only the ones that write can write.
const ROUTES: { name: string; method: string; path: string; access: "read" | "write" | "readwrite"; code: string }[] = [
  { name: "list-items", method: "GET", path: "/items", access: "read", code: LIST_ITEMS },
  { name: "get-item", method: "GET", path: "/items/{id}", access: "read", code: GET_ITEM },
  { name: "create-item", method: "POST", path: "/items", access: "write", code: CREATE_ITEM },
  { name: "update-item", method: "PATCH", path: "/items/{id}", access: "readwrite", code: UPDATE_ITEM },
  { name: "delete-item", method: "DELETE", path: "/items/{id}", access: "write", code: DELETE_ITEM },
];
const ROW = 110;

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
    description: "A REST-style API for items: one Python function per route on API Gateway, and a DynamoDB table.",
    services: ["api-gateway", "lambda", "dynamodb"],
    graph: {
      nodes: [
        { type: "api-gateway", offset: { x: 0, y: 2 * ROW }, config: { name: "items-api", cors: true } },
        ...ROUTES.map((r, i) => ({ type: "lambda", offset: { x: 340, y: i * ROW }, config: { ...PYTHON, name: r.name, code: r.code } })),
        { type: "dynamodb", offset: { x: 680, y: 2 * ROW }, config: { name: "items", partitionKey: "id" } },
      ],
      links: [
        ...ROUTES.map((r, i) => ({ from: 0, to: i + 1, config: { routes: [{ method: r.method, path: r.path }] } })),
        ...ROUTES.map((r, i) => ({ from: i + 1, to: ROUTES.length + 1, config: { access: r.access } })),
      ],
    },
  },
  {
    id: "event-driven",
    name: "Event-driven",
    description: "EventBridge runs a Python function on a schedule and on events another function sends.",
    services: ["eventbridge", "lambda"],
    graph: {
      nodes: [
        { type: "eventbridge", offset: { x: 0, y: 0 }, config: { name: "every-5-minutes", trigger: "schedule", schedule: "rate(5 minutes)" } },
        { type: "lambda", offset: { x: 320, y: 70 }, config: { ...PYTHON, name: "worker", code: WORKER } },
        { type: "eventbridge", offset: { x: 0, y: 140 }, config: { name: "order-created", trigger: "pattern", eventPattern: '{"source": ["shop.orders"], "detail-type": ["order.created"]}' } },
        { type: "lambda", offset: { x: -320, y: 140 }, config: { ...PYTHON, name: "publisher", code: PUBLISHER } },
      ],
      links: [
        { from: 0, to: 1 },
        { from: 2, to: 1 },
        { from: 3, to: 2 },
      ],
    },
  },
];
