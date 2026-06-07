output "frontend_public_ip" {
  value       = aws_instance.frontend_server.public_ip
  description = "Public IP Address of the Frontend web server"
}

output "backend_private_ip" {
  value       = aws_instance.backend_server.private_ip
  description = "Private IP Address of the Backend API server"
}

output "database_endpoint" {
  value       = aws_db_instance.mysql_db.endpoint
  description = "MySQL database endpoint connection string"
}

output "s3_bucket_domain" {
  value       = aws_s3_bucket.storage_bucket.bucket_regional_domain_name
  description = "S3 Object Storage Bucket Regional Domain Name"
}
