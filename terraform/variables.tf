variable "aws_region" {
  type        = string
  default     = "ap-southeast-1" # Singapore
  description = "Target AWS Region"
}

variable "ami_id" {
  type        = string
  default     = "ami-0c55b159cbfafe1f0" # Ubuntu Server 22.04 LTS
  description = "Compute Instance OS Image AMI ID"
}

variable "key_name" {
  type        = string
  default     = "adaptive-learning-key"
  description = "AWS EC2 Key Pair name for SSH access"
}

variable "db_username" {
  type        = string
  default     = "admin"
  description = "MySQL database admin username"
}

variable "db_password" {
  type        = string
  default     = "DB_password_123_secure"
  description = "MySQL database admin password"
  sensitive   = true
}

variable "bucket_name" {
  type        = string
  default     = "adaptive-learning-assets-multi-cloud"
  description = "Multi-Cloud Object Storage Bucket Name"
}
