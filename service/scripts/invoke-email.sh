#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="SiteStack"
LOGICAL_ID="EmailFunction"

echo "Looking up function name from CloudFormation..."
FUNCTION_NAME=$(aws --profile personal cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --query "StackResources[?starts_with(LogicalResourceId, '${LOGICAL_ID}') && ResourceType=='AWS::Lambda::Function'].PhysicalResourceId | [0]" \
  --output text)

echo "Invoking: $FUNCTION_NAME"
RESPONSE_FILE=$(mktemp)
aws --profile personal lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload file://$(dirname "$0")/email-test-event.json \
  --cli-binary-format raw-in-base64-out \
  --no-cli-pager \
  "$RESPONSE_FILE" >/dev/null

echo "Response payload:"
cat "$RESPONSE_FILE"
rm -f "$RESPONSE_FILE"
