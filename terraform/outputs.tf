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

# Regional S3 bucket output removed as Object Storage is on Cloudflare R2
