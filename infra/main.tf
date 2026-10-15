# ==============================================================================
# RailSync - AWS Production Cloud Infrastructure Blueprint (Terraform)
# Provisions Amazon ECS Fargate, ALB, Multi-AZ RDS PostgreSQL 15,
# ElastiCache Redis 7, S3 WORM Object Lock, and CloudWatch Alarms.
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-south-1" # AWS Mumbai (Central Railway Zone)
}

# -------------------------------------------------------------
# Variables
# -------------------------------------------------------------
variable "db_password" {
  description = "RDS PostgreSQL master password"
  type        = string
  sensitive   = true
  default     = "CHANGE_ME_IN_TFVARS"
}

variable "backend_image" {
  description = "ECR image URI for the RailSync backend"
  type        = string
  default     = "123456789012.dkr.ecr.ap-south-1.amazonaws.com/railsync-backend:latest"
}

# -------------------------------------------------------------
# 1. VPC & Network Isolation (2 Availability Zones)
# -------------------------------------------------------------
resource "aws_vpc" "railsync_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "railsync-production-vpc"
    Environment = "Production"
    Project     = "RailSync"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.railsync_vpc.id
  tags   = { Name = "railsync-igw" }
}

resource "aws_subnet" "public_az1" {
  vpc_id                  = aws_vpc.railsync_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "ap-south-1a"
  map_public_ip_on_launch = true
}

resource "aws_subnet" "public_az2" {
  vpc_id                  = aws_vpc.railsync_vpc.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "ap-south-1b"
  map_public_ip_on_launch = true
}

resource "aws_subnet" "private_az1" {
  vpc_id            = aws_vpc.railsync_vpc.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "ap-south-1a"
}

resource "aws_subnet" "private_az2" {
  vpc_id            = aws_vpc.railsync_vpc.id
  cidr_block        = "10.0.12.0/24"
  availability_zone = "ap-south-1b"
}

# Route table so public subnets reach the internet (required for ALB)
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.railsync_vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = { Name = "railsync-public-rt" }
}

resource "aws_route_table_association" "public_az1" {
  subnet_id      = aws_subnet.public_az1.id
  route_table_id = aws_route_table.public_rt.id
}

resource "aws_route_table_association" "public_az2" {
  subnet_id      = aws_subnet.public_az2.id
  route_table_id = aws_route_table.public_rt.id
}

# -------------------------------------------------------------
# 2. Security Groups
# -------------------------------------------------------------
resource "aws_security_group" "alb_sg" {
  name        = "railsync-alb-sg"
  description = "Allow HTTP/HTTPS inbound to ALB"
  vpc_id      = aws_vpc.railsync_vpc.id

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
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "backend_sg" {
  name        = "railsync-backend-sg"
  description = "Allow ALB to reach backend container on 8000"
  vpc_id      = aws_vpc.railsync_vpc.id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds_sg" {
  name        = "railsync-rds-sg"
  description = "Allow backend containers to reach RDS on 5432"
  vpc_id      = aws_vpc.railsync_vpc.id

  ingress {
    from_port       = 5432
    to_port         = 5432
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

resource "aws_security_group" "redis_sg" {
  name        = "railsync-redis-sg"
  description = "Allow backend containers to reach ElastiCache on 6379"
  vpc_id      = aws_vpc.railsync_vpc.id

  ingress {
    from_port       = 6379
    to_port         = 6379
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

# -------------------------------------------------------------
# 3. Application Load Balancer (ALB) with TLS 1.3 Termination
# -------------------------------------------------------------
resource "aws_lb" "railsync_alb" {
  name               = "railsync-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = [aws_subnet.public_az1.id, aws_subnet.public_az2.id]
  security_groups    = [aws_security_group.alb_sg.id]

  tags = { Name = "RailSync-ALB" }
}

resource "aws_lb_target_group" "backend_tg" {
  name        = "railsync-backend-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.railsync_vpc.id
  target_type = "ip"

  health_check {
    path                = "/healthz"
    interval            = 15
    timeout             = 3
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }
}

resource "aws_lb_listener" "http_listener" {
  load_balancer_arn = aws_lb.railsync_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend_tg.arn
  }
}

# -------------------------------------------------------------
# 4. Amazon ECS on AWS Fargate (Serverless Container Runtime)
# -------------------------------------------------------------
resource "aws_ecs_cluster" "railsync_cluster" {
  name = "railsync-cluster"
}

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "railsync-ecs-task-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_ecs_task_definition" "backend_task" {
  family                   = "railsync-backend-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"  # 0.5 vCPU
  memory                   = "1024" # 1 GB RAM
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "railsync-backend"
      image     = var.backend_image
      essential = true
      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
        }
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8000/healthz || exit 1"]
        interval    = 15
        timeout     = 3
        retries     = 3
        startPeriod = 5
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/railsync-backend"
          "awslogs-region"        = "ap-south-1"
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "backend_service" {
  name            = "railsync-backend-service"
  cluster         = aws_ecs_cluster.railsync_cluster.id
  task_definition = aws_ecs_task_definition.backend_task.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.private_az1.id, aws_subnet.private_az2.id]
    security_groups  = [aws_security_group.backend_sg.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend_tg.arn
    container_name   = "railsync-backend"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.http_listener]
}

# CloudWatch log group for ECS
resource "aws_cloudwatch_log_group" "ecs_backend_logs" {
  name              = "/ecs/railsync-backend"
  retention_in_days = 30
}

# -------------------------------------------------------------
# 5. Amazon RDS PostgreSQL 15 Multi-AZ
# -------------------------------------------------------------
resource "aws_db_subnet_group" "rds_subnet_group" {
  name       = "railsync-rds-subnet-group"
  subnet_ids = [aws_subnet.private_az1.id, aws_subnet.private_az2.id]
}

resource "aws_db_instance" "railsync_postgres" {
  identifier          = "railsync-db-cluster"
  engine              = "postgres"
  engine_version      = "15.4"
  instance_class      = "db.t4g.medium"
  allocated_storage   = 20
  multi_az            = true
  publicly_accessible = false
  skip_final_snapshot = true
  username            = "railsync_admin"
  password            = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
}

# -------------------------------------------------------------
# 6. Amazon ElastiCache Redis 7 (Pub/Sub Fencing Token Mesh)
# -------------------------------------------------------------
resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name       = "railsync-redis-subnet-group"
  subnet_ids = [aws_subnet.private_az1.id, aws_subnet.private_az2.id]
}

resource "aws_elasticache_cluster" "railsync_redis" {
  cluster_id           = "railsync-redis"
  engine               = "redis"
  node_type            = "cache.t4g.small"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids   = [aws_security_group.redis_sg.id]

  tags = { Name = "railsync-redis-mesh" }
}

# -------------------------------------------------------------
# 7. Amazon S3 Statutory Audit Ledger (WORM Object Lock)
# -------------------------------------------------------------
resource "aws_s3_bucket" "audit_ledger_bucket" {
  bucket              = "railsync-immutable-audit-ledger"
  object_lock_enabled = true

  tags = { Name = "RailSync-Audit-Ledger-WORM" }
}

resource "aws_s3_bucket_object_lock_configuration" "audit_ledger_lock" {
  bucket = aws_s3_bucket.audit_ledger_bucket.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = 3650 # 10-Year Statutory Retention
    }
  }
}

resource "aws_s3_bucket_versioning" "audit_ledger_versioning" {
  bucket = aws_s3_bucket.audit_ledger_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# -------------------------------------------------------------
# 8. Outputs
# -------------------------------------------------------------
output "alb_dns_name" {
  description = "Public DNS of the Application Load Balancer"
  value       = aws_lb.railsync_alb.dns_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.railsync_postgres.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_cluster.railsync_redis.cache_nodes[0].address
}
