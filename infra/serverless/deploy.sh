#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required}"
: "${API_ZIP:?API_ZIP is required}"
: "${COLLECTOR_ZIP:?COLLECTOR_ZIP is required}"
: "${BACKEND_PROXY_TOKEN:?BACKEND_PROXY_TOKEN is required}"
if (( ${#BACKEND_PROXY_TOKEN} < 32 || ${#BACKEND_PROXY_TOKEN} > 256 )); then
  printf '%s\n' "BACKEND_PROXY_TOKEN must contain 32-256 bytes" >&2
  exit 1
fi

RANK_COLLECTION_STARTED_AT="${RANK_COLLECTION_STARTED_AT:-2026-08-04T02:00:00Z}"
CALENDAR_FEED_URL="${CALENDAR_FEED_URL:-}"
CALENDAR_FEED_TOKEN="${CALENDAR_FEED_TOKEN:-}"
RANK_HISTORY_FEED_URL="${RANK_HISTORY_FEED_URL:-}"
RANK_HISTORY_FEED_TOKEN="${RANK_HISTORY_FEED_TOKEN:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/infra/serverless"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
PREFIX="gacha-revenue-free"
TABLE_NAME="$PREFIX-data"
API_FUNCTION="$PREFIX-api"
COLLECTOR_FUNCTION="$PREFIX-collector"
LAMBDA_ROLE="$PREFIX-lambda-role"
SCHEDULER_ROLE="$PREFIX-scheduler-role"
RANK_SCHEDULE_NAME="$PREFIX-hourly-ranks"
REVENUE_SCHEDULE_NAME="$PREFIX-six-hour-revenue"
WORK_DIR="$(mktemp -d)"

LAMBDA_ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$LAMBDA_ROLE"
SCHEDULER_ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$SCHEDULER_ROLE"
TABLE_ARN="arn:aws:dynamodb:$AWS_REGION:$ACCOUNT_ID:table/$TABLE_NAME"
COLLECTOR_ARN="arn:aws:lambda:$AWS_REGION:$ACCOUNT_ID:function:$COLLECTOR_FUNCTION"

jq -cn \
  --arg table "$TABLE_NAME" \
  --arg proxy "$BACKEND_PROXY_TOKEN" \
  --arg started "$RANK_COLLECTION_STARTED_AT" \
  --arg calendar_url "$CALENDAR_FEED_URL" \
  --arg calendar_token "$CALENDAR_FEED_TOKEN" \
  --arg history_url "$RANK_HISTORY_FEED_URL" \
  --arg history_token "$RANK_HISTORY_FEED_TOKEN" \
  '{Variables:{DYNAMODB_TABLE:$table,PROXY_TOKEN:$proxy,RANK_COLLECTION_STARTED_AT:$started,CALENDAR_FEED_URL:$calendar_url,CALENDAR_FEED_TOKEN:$calendar_token,RANK_HISTORY_FEED_URL:$history_url,RANK_HISTORY_FEED_TOKEN:$history_token}}' \
  >"$WORK_DIR/api-environment.json"
jq -cn --arg table "$TABLE_NAME" '{Variables:{DYNAMODB_TABLE:$table}}' >"$WORK_DIR/collector-environment.json"

cat >"$WORK_DIR/lambda-policy.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:$AWS_REGION:$ACCOUNT_ID:log-group:/aws/lambda/$PREFIX-*:*"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:Query", "dynamodb:PutItem"],
      "Resource": "$TABLE_ARN"
    }
  ]
}
JSON

cat >"$WORK_DIR/scheduler-policy.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "$COLLECTOR_ARN"
    }
  ]
}
JSON

ensure_role() {
  local role_name="$1"
  local trust_file="$2"
  local policy_name="$3"
  local policy_file="$4"
  if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
    aws iam update-assume-role-policy --role-name "$role_name" --policy-document "file://$trust_file"
  else
    aws iam create-role \
      --role-name "$role_name" \
      --assume-role-policy-document "file://$trust_file" \
      --description "No-VPC execution role for the gacha revenue free backend" \
      --tags Key=Project,Value=gacha-revenue Key=CostProfile,Value=free-tier >/dev/null
  fi
  aws iam put-role-policy --role-name "$role_name" --policy-name "$policy_name" --policy-document "file://$policy_file"
}

ensure_role "$LAMBDA_ROLE" "$DEPLOY_DIR/lambda-trust-policy.json" "$PREFIX-lambda" "$WORK_DIR/lambda-policy.json"
ensure_role "$SCHEDULER_ROLE" "$DEPLOY_DIR/scheduler-trust-policy.json" "$PREFIX-scheduler" "$WORK_DIR/scheduler-policy.json"

if ! aws dynamodb describe-table --table-name "$TABLE_NAME" >/dev/null 2>&1; then
  aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
    --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
    --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
    --billing-mode PROVISIONED \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --tags Key=Project,Value=gacha-revenue Key=CostProfile,Value=free-tier >/dev/null
fi
aws dynamodb wait table-exists --table-name "$TABLE_NAME"
TTL_STATUS="$(aws dynamodb describe-time-to-live --table-name "$TABLE_NAME" --query TimeToLiveDescription.TimeToLiveStatus --output text)"
if [[ "$TTL_STATUS" == "DISABLED" ]]; then
  aws dynamodb update-time-to-live --table-name "$TABLE_NAME" --time-to-live-specification Enabled=true,AttributeName=expires_at >/dev/null
fi

ensure_log_group() {
  local function_name="$1"
  local group="/aws/lambda/$function_name"
  local found
  found="$(aws logs describe-log-groups --log-group-name-prefix "$group" --query "length(logGroups[?logGroupName=='$group'])" --output text)"
  if [[ "$found" == "0" ]]; then
    aws logs create-log-group --log-group-name "$group"
  fi
  aws logs put-retention-policy --log-group-name "$group" --retention-in-days 7
}

ensure_log_group "$API_FUNCTION"
ensure_log_group "$COLLECTOR_FUNCTION"

create_function_with_retry() {
  local function_name="$1"
  local zip_file="$2"
  local memory="$3"
  local timeout="$4"
  local environment_file="$5"
  local attempt
  for attempt in 1 2 3 4 5; do
    if aws lambda create-function \
      --function-name "$function_name" \
      --runtime provided.al2023 \
      --handler bootstrap \
      --architectures arm64 \
      --role "$LAMBDA_ROLE_ARN" \
      --zip-file "fileb://$zip_file" \
      --memory-size "$memory" \
      --timeout "$timeout" \
      --environment "file://$environment_file" \
      --tags Project=gacha-revenue,CostProfile=free-tier >/dev/null; then
      return 0
    fi
    if [[ "$attempt" != "5" ]]; then
      sleep 6
    fi
  done
  return 1
}

ensure_function() {
  local function_name="$1"
  local zip_file="$2"
  local memory="$3"
  local timeout="$4"
  local environment_file="$5"
  if aws lambda get-function --function-name "$function_name" >/dev/null 2>&1; then
    aws lambda update-function-code --function-name "$function_name" --zip-file "fileb://$zip_file" --architectures arm64 >/dev/null
    aws lambda wait function-updated --function-name "$function_name"
    aws lambda update-function-configuration \
      --function-name "$function_name" \
      --runtime provided.al2023 \
      --handler bootstrap \
      --role "$LAMBDA_ROLE_ARN" \
      --memory-size "$memory" \
      --timeout "$timeout" \
      --environment "file://$environment_file" >/dev/null
  else
    create_function_with_retry "$function_name" "$zip_file" "$memory" "$timeout" "$environment_file"
  fi
  aws lambda wait function-updated --function-name "$function_name"
}

ensure_function "$API_FUNCTION" "$API_ZIP" 256 30 "$WORK_DIR/api-environment.json"
ensure_function "$COLLECTOR_FUNCTION" "$COLLECTOR_ZIP" 256 45 "$WORK_DIR/collector-environment.json"

# AWS requires at least 100 account concurrency units to remain unreserved.
# New accounts can start below that threshold, so apply the cost guard only
# when the regional quota can legally support both function caps.
UNRESERVED_CONCURRENCY="$(aws lambda get-account-settings --query AccountLimit.UnreservedConcurrentExecutions --output text)"
if [[ "$UNRESERVED_CONCURRENCY" =~ ^[0-9]+$ ]] && (( UNRESERVED_CONCURRENCY >= 103 )); then
  aws lambda put-function-concurrency --function-name "$API_FUNCTION" --reserved-concurrent-executions 2 >/dev/null
  aws lambda put-function-concurrency --function-name "$COLLECTOR_FUNCTION" --reserved-concurrent-executions 1 >/dev/null
else
  printf '%s\n' "AWS account concurrency is $UNRESERVED_CONCURRENCY; reserved concurrency caps require 103 unreserved units and were not changed."
fi

CORS_JSON='{"AllowOrigins":["*"],"AllowMethods":["GET"],"AllowHeaders":["content-type"],"MaxAge":86400}'
if aws lambda get-function-url-config --function-name "$API_FUNCTION" >/dev/null 2>&1; then
  aws lambda update-function-url-config --function-name "$API_FUNCTION" --auth-type NONE --cors "$CORS_JSON" >/dev/null
else
  aws lambda create-function-url-config --function-name "$API_FUNCTION" --auth-type NONE --cors "$CORS_JSON" >/dev/null
fi

add_public_permission() {
  local sid="$1"
  shift
  local policy
  policy="$(aws lambda get-policy --function-name "$API_FUNCTION" --query Policy --output text 2>/dev/null || true)"
  if [[ -z "$policy" ]] || ! jq -e --arg sid "$sid" '.Statement[]? | select(.Sid == $sid)' <<<"$policy" >/dev/null; then
    aws lambda add-permission --function-name "$API_FUNCTION" --statement-id "$sid" "$@" >/dev/null
  fi
}

add_public_permission "FunctionURLAllowPublicAccess" --action lambda:InvokeFunctionUrl --principal '*' --function-url-auth-type NONE
add_public_permission "FunctionURLInvokeAllowPublicAccess" --action lambda:InvokeFunction --principal '*' --invoked-via-function-url

ensure_schedule() {
  local schedule_name="$1"
  local description="$2"
  local expression="$3"
  local payload="$4"
  local target_json
  target_json="$(jq -cn --arg arn "$COLLECTOR_ARN" --arg role "$SCHEDULER_ROLE_ARN" --arg input "$payload" '{Arn:$arn,RoleArn:$role,Input:$input,RetryPolicy:{MaximumEventAgeInSeconds:3600,MaximumRetryAttempts:2}}')"
  if aws scheduler get-schedule --name "$schedule_name" >/dev/null 2>&1; then
    aws scheduler update-schedule \
      --name "$schedule_name" \
      --schedule-expression "$expression" \
      --schedule-expression-timezone UTC \
      --flexible-time-window '{"Mode":"OFF"}' \
      --target "$target_json" \
      --state ENABLED >/dev/null
  else
    aws scheduler create-schedule \
      --name "$schedule_name" \
      --description "$description" \
      --schedule-expression "$expression" \
      --schedule-expression-timezone UTC \
      --flexible-time-window '{"Mode":"OFF"}' \
      --target "$target_json" \
      --state ENABLED >/dev/null
  fi
}

ensure_schedule "$RANK_SCHEDULE_NAME" "Collect Apple Top Grossing ranks once per hour" 'cron(8 * * * ? *)' '{"job":"rank"}'
ensure_schedule "$REVENUE_SCHEDULE_NAME" "Refresh public monthly revenue histories every six hours" 'cron(23 0/6 * * ? *)' '{"job":"revenue"}'

invoke_collector() {
  local job="$1"
  local output_file="$WORK_DIR/collector-$job-output.json"
  local invoke_error
  invoke_error="$(aws lambda invoke --function-name "$COLLECTOR_FUNCTION" --cli-binary-format raw-in-base64-out --payload "{\"job\":\"$job\"}" "$output_file" --query FunctionError --output text)"
  if [[ "$invoke_error" != "None" ]]; then
    cat "$output_file"
    exit 1
  fi
}

invoke_collector rank
invoke_collector revenue

FUNCTION_URL="$(aws lambda get-function-url-config --function-name "$API_FUNCTION" --query FunctionUrl --output text)"
echo "api_url=$FUNCTION_URL" >>"${GITHUB_OUTPUT:-/dev/null}"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "## Free AWS backend"
    echo
    echo "- API: ${FUNCTION_URL}v1"
    echo "- DynamoDB: $TABLE_NAME (provisioned 5 RCU / 5 WCU)"
    echo "- Schedules: ranks hourly at minute 08 UTC; revenue every six hours at minute 23 UTC"
    echo "- No VPC, NAT, ECS, RDS, Redis, ALB, ECR, S3 or API Gateway"
  } >>"$GITHUB_STEP_SUMMARY"
fi

printf '%s\n' "Deployed free backend: ${FUNCTION_URL}v1"
