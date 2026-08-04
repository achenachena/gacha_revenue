resource "aws_iam_role" "scheduler" {
  name = "${local.name}-scheduler"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "scheduler.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "scheduler" {
  name = "send-ingestion-message"
  role = aws_iam_role.scheduler.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = ["sqs:SendMessage"], Resource = [aws_sqs_queue.ingestion.arn, aws_sqs_queue.ingestion_dlq.arn] }]
  })
}

resource "aws_scheduler_schedule" "hourly_ranks" {
  name                = "${local.name}-hourly-ranks"
  schedule_expression = "cron(8 * * * ? *)"
  state               = "ENABLED"

  flexible_time_window { mode = "OFF" }

  target {
    arn      = aws_sqs_queue.ingestion.arn
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ type = "hourly_rank_refresh" })

    retry_policy {
      maximum_event_age_in_seconds = 3600
      maximum_retry_attempts       = 5
    }

    dead_letter_config { arn = aws_sqs_queue.ingestion_dlq.arn }
  }
}
