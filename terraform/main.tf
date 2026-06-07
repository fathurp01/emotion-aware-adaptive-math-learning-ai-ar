provider "aws" {
  region = var.aws_region
}

# ==========================================
# 1. SEGMENTED VPCS (Ketentuan Utama A)
# ==========================================

# A. Frontend VPC
resource "aws_vpc" "frontend_vpc" {
  cidr_block           = "10.1.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "AdaptiveLearning-Frontend-VPC" }
}

# B. Backend VPC
resource "aws_vpc" "backend_vpc" {
  cidr_block           = "10.2.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "AdaptiveLearning-Backend-VPC" }
}

# C. Database VPC
resource "aws_vpc" "database_vpc" {
  cidr_block           = "10.3.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "AdaptiveLearning-Database-VPC" }
}

# D. Storage VPC (S3 Endpoint VPC Interface)
resource "aws_vpc" "storage_vpc" {
  cidr_block           = "10.4.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "AdaptiveLearning-Storage-VPC" }
}

# ==========================================
# 2. SUBNETS & GATEWAYS
# ==========================================

resource "aws_subnet" "frontend_public_subnet" {
  vpc_id                  = aws_vpc.frontend_vpc.id
  cidr_block              = "10.1.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "${var.aws_region}a"
  tags                    = { Name = "Frontend-Public-Subnet" }
}

resource "aws_subnet" "backend_public_subnet" {
  vpc_id                  = aws_vpc.backend_vpc.id
  cidr_block              = "10.2.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "${var.aws_region}a"
  tags                    = { Name = "Backend-Public-Subnet" }
}

resource "aws_internet_gateway" "backend_igw" {
  vpc_id = aws_vpc.backend_vpc.id
  tags   = { Name = "Backend-IGW" }
}

resource "aws_subnet" "database_private_subnet_a" {
  vpc_id            = aws_vpc.database_vpc.id
  cidr_block        = "10.3.1.0/24"
  availability_zone = "${var.aws_region}a"
  tags              = { Name = "DB-Private-Subnet-A" }
}

resource "aws_subnet" "database_private_subnet_b" {
  vpc_id            = aws_vpc.database_vpc.id
  cidr_block        = "10.3.2.0/24"
  availability_zone = "${var.aws_region}b"
  tags              = { Name = "DB-Private-Subnet-B" }
}

resource "aws_internet_gateway" "frontend_igw" {
  vpc_id = aws_vpc.frontend_vpc.id
  tags   = { Name = "Frontend-IGW" }
}

resource "aws_route_table" "frontend_rt" {
  vpc_id = aws_vpc.frontend_vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.frontend_igw.id
  }
  tags = { Name = "Frontend-RouteTable" }
}

resource "aws_route_table_association" "frontend_rta" {
  subnet_id      = aws_subnet.frontend_public_subnet.id
  route_table_id = aws_route_table.frontend_rt.id
}

# ==========================================
# 3. VPC PEERING & ROUTING (Connects the segmented VPCs)
# ==========================================

# Peering: Frontend <-> Backend
resource "aws_vpc_peering_connection" "front_to_back" {
  peer_vpc_id = aws_vpc.backend_vpc.id
  vpc_id      = aws_vpc.frontend_vpc.id
  auto_accept = true
  tags        = { Name = "Frontend-to-Backend-Peering" }
}

# Peering: Backend <-> Database
resource "aws_vpc_peering_connection" "back_to_db" {
  peer_vpc_id = aws_vpc.database_vpc.id
  vpc_id      = aws_vpc.backend_vpc.id
  auto_accept = true
  tags        = { Name = "Backend-to-DB-Peering" }
}

# Route in Frontend Route Table to Backend VPC
resource "aws_route" "frontend_to_backend_route" {
  route_table_id            = aws_route_table.frontend_rt.id
  destination_cidr_block    = "10.2.0.0/16"
  vpc_peering_connection_id = aws_vpc_peering_connection.front_to_back.id
}

# Backend Route Table
resource "aws_route_table" "backend_rt" {
  vpc_id = aws_vpc.backend_vpc.id

  route {
    cidr_block                = "10.1.0.0/16"
    vpc_peering_connection_id = aws_vpc_peering_connection.front_to_back.id
  }

  route {
    cidr_block                = "10.3.0.0/16"
    vpc_peering_connection_id = aws_vpc_peering_connection.back_to_db.id
  }

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.backend_igw.id
  }

  tags = { Name = "Backend-RouteTable" }
}

# Backend Route Table Association
resource "aws_route_table_association" "backend_rta" {
  subnet_id      = aws_subnet.backend_public_subnet.id
  route_table_id = aws_route_table.backend_rt.id
}

# Database Route Table
resource "aws_route_table" "database_rt" {
  vpc_id = aws_vpc.database_vpc.id

  route {
    cidr_block                = "10.2.0.0/16"
    vpc_peering_connection_id = aws_vpc_peering_connection.back_to_db.id
  }

  tags = { Name = "Database-RouteTable" }
}

# Database Route Table Associations
resource "aws_route_table_association" "database_rta_a" {
  subnet_id      = aws_subnet.database_private_subnet_a.id
  route_table_id = aws_route_table.database_rt.id
}

resource "aws_route_table_association" "database_rta_b" {
  subnet_id      = aws_subnet.database_private_subnet_b.id
  route_table_id = aws_route_table.database_rt.id
}

# ==========================================
# 4. COMPUTE INSTANCES (EC2)
# ==========================================

# Frontend Server
resource "aws_instance" "frontend_server" {
  ami                    = var.ami_id
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.frontend_public_subnet.id
  vpc_security_group_ids = [aws_security_group.frontend_sg.id]
  key_name               = var.key_name

  tags = { Name = "AdaptiveLearning-Frontend-Server" }
}

# Backend API Server
resource "aws_instance" "backend_server" {
  ami                    = var.ami_id
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.backend_public_subnet.id
  vpc_security_group_ids = [aws_security_group.backend_sg.id]
  key_name               = var.key_name

  tags = { Name = "AdaptiveLearning-Backend-Server" }
}

# ==========================================
# 5. RDS DATABASE (MySQL)
# ==========================================

resource "aws_db_subnet_group" "db_subnet_group" {
  name       = "db-subnet-group"
  subnet_ids = [aws_subnet.database_private_subnet_a.id, aws_subnet.database_private_subnet_b.id]
  tags       = { Name = "DB-Subnet-Group" }
}

resource "aws_db_instance" "mysql_db" {
  allocated_storage      = 20
  engine                 = "mysql"
  engine_version         = "8.0"
  instance_class         = "db.t3.micro"
  db_name                = "emotion_learning_db"
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.db_subnet_group.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  skip_final_snapshot    = true
  tags                   = { Name = "AdaptiveLearning-MySQL" }
}

# Object Storage is handled externally via Cloudflare R2
# (AWS S3 resource removed to strictly enforce multi-cloud compliance)

# ==========================================
# 7. SECURITY GROUPS
# ==========================================

# Frontend SG (Allows HTTP/HTTPS and SSH)
resource "aws_security_group" "frontend_sg" {
  name        = "frontend-sg"
  description = "Allow web traffic to frontend"
  vpc_id      = aws_vpc.frontend_vpc.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Backend SG (Allows traffic from Frontend and SSH)
resource "aws_security_group" "backend_sg" {
  name        = "backend-sg"
  description = "Allow traffic from frontend to API"
  vpc_id      = aws_vpc.backend_vpc.id

  ingress {
    from_port       = 5000
    to_port         = 5000
    protocol        = "tcp"
    security_groups = [aws_security_group.frontend_sg.id]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Allowed for GitHub Actions SSH deploy
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Database SG (Allows traffic from Backend)
resource "aws_security_group" "db_sg" {
  name        = "db-sg"
  description = "Allow MySQL traffic from backend only"
  vpc_id      = aws_vpc.database_vpc.id

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.backend_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
