output "api_repository_url" { value = aws_ecr_repository.api.repository_url }
output "worker_repository_url" { value = aws_ecr_repository.worker.repository_url }
output "raw_data_bucket" { value = aws_s3_bucket.raw.bucket }
output "ingestion_queue_url" { value = aws_sqs_queue.ingestion.url }
output "api_base_url" { value = "https://${var.api_domain_name}/v1" }
output "api_health_url" { value = "https://${var.api_domain_name}/healthz" }
output "api_load_balancer_dns_name" { value = aws_lb.api.dns_name }
output "ecs_cluster_name" { value = aws_ecs_cluster.main.name }
output "migration_task_definition_arn" { value = aws_ecs_task_definition.migrate.arn }
output "rank_feed_secret_arn" { value = aws_secretsmanager_secret.rank_feed.arn }
output "public_subnet_ids" { value = var.public_subnet_ids }
output "tasks_security_group_id" { value = aws_security_group.tasks.id }
output "api_service_name" { value = aws_ecs_service.api.name }
output "worker_service_name" { value = aws_ecs_service.worker.name }
output "rds_endpoint" {
  value     = aws_db_instance.postgres.address
  sensitive = true
}
output "redis_primary_endpoint" {
  value     = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive = true
}
