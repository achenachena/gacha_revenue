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

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnets across at least two availability zones."
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security groups allowing API-to-RDS/Redis traffic and approved ingress."
}

variable "raw_data_bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name for immutable licensed-source payloads."
}

variable "api_image" {
  type        = string
  description = "Immutable ECR API image URI including digest or tag."
}

variable "worker_image" {
  type        = string
  description = "Immutable ECR worker image URI including digest or tag."
}

