#!/usr/bin/env python3
"""Check that every Lambda gets the environment variables its code reads.

A Lambda that reads a variable Terraform does not set gets an empty string and
fails at runtime, which no unit test sees. This compares each `os.Getenv` in a
Lambda's Go code with the `environment_variables` of its module in infra/api.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
# Set by AWS, or by the Lambda module for every function.
PROVIDED = {"CORS_ALLOW_ORIGIN"}

MODULE = re.compile(r'module "(?P<name>[\w-]+)" \{(?P<body>.*?)\n\}', re.S)
PATH = re.compile(r'path_directory_file\s*=\s*"(?P<path>[^"]+)"')
ENV_BLOCK = re.compile(r"environment_variables\s*=\s*\{(?P<vars>.*?)\n\s*\}", re.S)
ENV_NAME = re.compile(r"^\s*([A-Z][A-Z0-9_]*)\s*=", re.M)
GETENV = re.compile(r'os\.Getenv\("([A-Z][A-Z0-9_]*)"\)')

problems = []
checked = 0
for tf in sorted((ROOT / "infra/api").glob("*.tf")):
    for module in MODULE.finditer(tf.read_text()):
        body = module.group("body")
        if "modules/lambda/golang" not in body:
            continue
        source_dir = ROOT / "services" / pathlib.Path(PATH.search(body).group("path")).parent
        block = ENV_BLOCK.search(body)
        given = set(ENV_NAME.findall(block.group("vars"))) if block else set()
        read = set()
        for go in source_dir.glob("*.go"):
            if not go.name.endswith("_test.go"):
                read |= set(GETENV.findall(go.read_text()))
        read = {v for v in read if not v.startswith("AWS_")} - PROVIDED
        checked += 1
        for missing in sorted(read - given):
            problems.append(f"{tf.name}: {module.group('name')} reads {missing}, but Terraform does not set it")
        for unused in sorted(given - read):
            problems.append(f"{tf.name}: {module.group('name')} sets {unused}, but its code never reads it")

if problems:
    print("\n".join(problems))
    sys.exit(1)
print(f"Lambda environment variables match their code ({checked} Lambdas)")
