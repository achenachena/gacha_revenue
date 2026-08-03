locals {
  name = "${var.project}-${var.environment}"
}

data "aws_caller_identity" "current" {}

resource "aws_ecr_repository" "api" {
  name                 = "${local.name}-api"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

resource "aws_ecr_repository" "worker" {
  name                 = "${local.name}-worker"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

resource "aws_s3_bucket" "raw" {
  bucket = var.raw_data_bucket_name
}

resource "aws_s3_bucket_versioning" "raw" {
  bucket = aws_s3_bucket.raw.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "raw" {
  bucket = aws_s3_bucket.raw.id
  rule { apply_server_side_encryption_by_default { sse_algorithm = "AES256" } }
}

resource "aws_s3_bucket_public_access_block" "raw" {
  bucket                  = aws_s3_bucket.raw.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_sqs_queue" "ingestion_dlq" {
  name                      = "${local.name}-ingestion-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled    = true
}

resource "aws_sqs_queue" "ingestion" {
  name                       = "${local.name}-ingestion"
  visibility_timeout_seconds = 180
  message_retention_seconds  = 345600
  sqs_managed_sse_enabled     = true
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ingestion_dlq.arn
    maxReceiveCount     = 5
  })
}

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = var.private_subnet_ids
}

resource "aws_db_instance" "postgres" {
  identifier                     = local.name
  engine                         = "postgres"
  engine_version                 = "17.4"
  instance_class                 = "db.t4g.medium"
  allocated_storage              = 50
  max_allocated_storage          = 500
  storage_encrypted              = true
  db_name                        = "gacha"
  username                       = "gacha_admin"
  manage_master_user_password    = true
  db_subnet_group_name           = aws_db_subnet_group.main.name
  vpc_security_group_ids         = var.security_group_ids
  backup_retention_period        = 14
  deletion_protection            = true
  performance_insights_enabled   = true
  auto_minor_version_upgrade     = true
  publicly_accessible            = false
  skip_final_snapshot            = false
  final_snapshot_identifier       = "${local.name}-final"
}

resource "aws_elasticache_subnet_group" "main" {
  name       = local.name
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = local.name
  description                = "Revenue API cache and distributed rate limits"
  engine                     = "redis"
  node_type                  = "cache.t4g.small"
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = var.security_group_ids
}

resource "aws_cognito_user_pool" "main" {
  name = local.name
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 2
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${local.name}-web"
  user_pool_id = aws_cognito_user_pool.main.id
  generate_secret = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows  = ["code"]
  allowed_oauth_scopes = ["openid", "email", "profile"]
  callback_urls = ["https://example.com/auth/callback"]
  logout_urls   = ["https://example.com/"]
  supported_identity_providers = ["COGNITO"]
}

resource "aws_cognito_user_group" "roles" {
  for_each     = toset(["viewer", "editor", "admin"])
  name         = each.value
  user_pool_id = aws_cognito_user_pool.main.id
  precedence   = each.value == "admin" ? 10 : each.value == "editor" ? 20 : 30
}

resource "aws_ecs_cluster" "main" {
  name = local.name
  setting { name = "containerInsights" value = "enabled" }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name}/api"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name}/worker"
  retention_in_days = 30
}

resource "aws_iam_role" "ecs_execution" {
  name = "${local.name}-ecs-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name = "${local.name}-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "task" {
  name = "least-privilege-data-access"
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = "${aws_s3_bucket.raw.arn}/*" },
      { Effect = "Allow", Action = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:SendMessage"], Resource = aws_sqs_queue.ingestion.arn }
    ]
  })
}

resource "aws_secretsmanager_secret" "application" {
  name = "${local.name}/application"
  description = "Database credentials and licensed provider tokens; values are set out-of-band."
}

resource "aws_ssm_parameter" "model_version" {
  name  = "/${local.name}/model-version"
  type  = "String"
  value = "1.4.0"
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions = jsonencode([{
    name      = "api"
    image     = var.api_image
    essential = true
    portMappings = [{ containerPort = 8080, protocol = "tcp" }]
    environment = [
      { name = "APP_ENV", value = var.environment },
      { name = "HTTP_ADDRESS", value = ":8080" },
      { name = "RAW_DATA_BUCKET", value = aws_s3_bucket.raw.bucket },
      { name = "INGESTION_QUEUE_URL", value = aws_sqs_queue.ingestion.url },
      { name = "COGNITO_ISSUER", value = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}" },
      { name = "COGNITO_CLIENT_ID", value = aws_cognito_user_pool_client.web.id },
      { name = "AUTH_REQUIRED", value = "true" }
    ]
    logConfiguration = { logDriver = "awslogs", options = { awslogs-group = aws_cloudwatch_log_group.api.name, awslogs-region = var.aws_region, awslogs-stream-prefix = "api" } }
  }])
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions = jsonencode([{
    name      = "worker"
    image     = var.worker_image
    essential = true
    environment = [
      { name = "APP_ENV", value = var.environment },
      { name = "RAW_DATA_BUCKET", value = aws_s3_bucket.raw.bucket },
      { name = "INGESTION_QUEUE_URL", value = aws_sqs_queue.ingestion.url }
    ]
    logConfiguration = { logDriver = "awslogs", options = { awslogs-group = aws_cloudwatch_log_group.worker.name, awslogs-region = var.aws_region, awslogs-stream-prefix = "worker" } }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "${local.name}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }

  lifecycle { ignore_changes = [task_definition] }
}

resource "aws_ecs_service" "worker" {
  name            = "${local.name}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }

  lifecycle { ignore_changes = [task_definition] }
}

resource "aws_cloudwatch_event_rule" "daily_ingestion" {
  name                = "${local.name}-daily-ingestion"
  schedule_expression = "cron(15 2 * * ? *)"
}

resource "aws_sqs_queue_policy" "eventbridge" {
  queue_url = aws_sqs_queue.ingestion.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action = "sqs:SendMessage"
      Resource = aws_sqs_queue.ingestion.arn
      Condition = { ArnEquals = { "aws:SourceArn" = aws_cloudwatch_event_rule.daily_ingestion.arn } }
    }]
  })
}

resource "aws_cloudwatch_event_target" "daily_ingestion" {
  rule = aws_cloudwatch_event_rule.daily_ingestion.name
  arn  = aws_sqs_queue.ingestion.arn
  input = jsonencode({ type = "scheduled_full_refresh", model_version = "1.4.0" })
}
