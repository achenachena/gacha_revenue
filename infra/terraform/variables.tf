variable "project" {
  type    = string
  default = "gacha-revenue"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "aws_region" {
  type    = string
  default = "ap-northeast-1"
}

variable "vpc_id" {
  type        = string
  description = "VPC that contains the public ECS/ALB subnets and private data subnets."
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "At least two public subnets in different availability zones for ALB and outbound-enabled Fargate tasks."
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnets across at least two availability zones."
}

variable "api_domain_name" {
  type        = string
  description = "Public HTTPS API hostname, for example api.revenue.example.com."
}

variable "route53_zone_id" {
  type        = string
  description = "Route 53 public hosted zone ID containing api_domain_name."
}

variable "raw_data_bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name for immutable licensed-source payloads."
}

variable "image_tag" {
  type        = string
  description = "Immutable release tag shared by the API, worker and migration images; use the Git commit SHA."
}

variable "api_desired_count" {
  type        = number
  default     = 2
  description = "Number of API Fargate tasks. Use 1 for a lower-cost non-HA deployment."
}

variable "worker_desired_count" {
  type    = number
  default = 1
}

variable "rds_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.small"
}

variable "redis_num_cache_clusters" {
  type    = number
  default = 2
}

variable "deletion_protection" {
  type    = bool
  default = true
}
