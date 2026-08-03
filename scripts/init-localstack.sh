#!/bin/sh
set -eu

awslocal s3api head-bucket --bucket gacha-revenue-raw-local >/dev/null 2>&1 || \
  awslocal s3api create-bucket --bucket gacha-revenue-raw-local >/dev/null
awslocal sqs get-queue-url --queue-name gacha-ingestion >/dev/null 2>&1 || \
  awslocal sqs create-queue --queue-name gacha-ingestion >/dev/null
