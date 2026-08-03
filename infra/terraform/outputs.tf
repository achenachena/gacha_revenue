output "api_repository_url" { value = aws_ecr_repository.api.repository_url }
output "worker_repository_url" { value = aws_ecr_repository.worker.repository_url }
output "raw_data_bucket" { value = aws_s3_bucket.raw.bucket }
output "ingestion_queue_url" { value = aws_sqs_queue.ingestion.url }
output "cognito_user_pool_id" { value = aws_cognito_user_pool.main.id }
output "cognito_client_id" { value = aws_cognito_user_pool_client.web.id }
output "rds_endpoint" { value = aws_db_instance.postgres.address sensitive = true }
output "redis_primary_endpoint" { value = aws_elasticache_replication_group.redis.primary_endpoint_address sensitive = true }

