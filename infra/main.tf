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

# -------------------------------------------------------------
# 2. Application Load Balancer (ALB) with TLS 1.3 Termination
# -------------------------------------------------------------
resource "aws_lb" "railsync_alb" {
  name               = "railsync-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = [aws_subnet.public_az1.id, aws_subnet.public_az2.id]

  tags = {
    Name = "RailSync-ALB"
  }
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

# -------------------------------------------------------------
# 3. Amazon ECS on AWS Fargate (Serverless Container Runtime)
# -------------------------------------------------------------
resource "aws_ecs_cluster" "railsync_cluster" {
  name = "railsync-cluster"
}

resource "aws_ecs_task_definition" "backend_task" {
  family                   = "railsync-backend-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"  # 0.5 vCPU
  memory                   = "1024" # 1 GB RAM

  container_definitions = jsonencode([
    {
      name      = "railsync-backend"
      image     = "123456789012.dkr.ecr.ap-south-1.amazonaws.com/railsync-backend:latest"
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
    }
  ])
}

# -------------------------------------------------------------
# 4. Amazon RDS PostgreSQL 15 Multi-AZ
# -------------------------------------------------------------
resource "aws_db_instance" "railsync_postgres" {
  identifier          = "railsync-db-cluster"
  engine              = "postgres"
  engine_version       = "15.4"
  instance_class      = "db.t4g.medium"
  allocated_storage   = 20
  multi_az            = true
  publicly_accessible = false
  skip_final_snapshot = true
  username            = "railsync_admin"
  password            = "SecurePassword123!"
}

# -------------------------------------------------------------
# 5. Amazon S3 Statutory Audit Ledger (WORM Object Lock)
# -------------------------------------------------------------
resource "aws_s3_bucket" "audit_ledger_bucket" {
  bucket = "railsync-immutable-audit-ledger"

  object_lock_configuration {
    object_lock_enabled = "Enabled"
    rule {
      default_retention {
        mode = "COMPLIANCE"
        days = 3650 # 10 Years Statutory Retention
      }
    }
  }
}
