# RailSync: AWS Monthly Production Cost Analysis ($145/Month Model)

## 1. Executive Cost Summary
To meet the student evaluation rubric and provide an enterprise-grade yet cost-efficient architecture for the **Central Railway Nagpur Division Pilot**, RailSync is architected to operate at an estimated **\$145.20 / month (~₹12,050 / month)** in `ap-south-1` (AWS Mumbai).

---

## 2. Granular Service Breakdown

| Service Component | Sizing & Configuration | Monthly Cost (USD) | Justification & Optimization |
| :--- | :--- | :--- | :--- |
| **AWS ECS on Fargate** | 2 Tasks × 0.25 vCPU, 0.5 GB RAM (Stateless FastAPI Backend) | **\$14.80** | Serverless compute eliminated EC2 idle OS overhead; auto-scales up to 4 tasks only during corridor peak bursts (>70% CPU). |
| **AWS Application Load Balancer (ALB)** | 1 ALB with TLS 1.3 termination, path routing, and target health checks | **\$22.50** | Handles high-frequency WebSocket streams, DDoS absorption, and seamless task draining. |
| **Amazon RDS PostgreSQL 15** | Single-AZ `db.t4g.micro` with 20GB GP3 SSD storage (Scalable to Multi-AZ in Phase 2) | **\$18.90** | Cost-effective ARM Graviton instance delivering ACID consistency, row-level locks, and foreign key cascades. |
| **Amazon ElastiCache Redis 7** | `cache.t4g.micro` (0.5 GB memory, sub-5ms latency) | **\$13.20** | Handles sub-5ms pub/sub broadcasting to video walls and monotonic fencing token locks. |
| **Amazon S3 with Object Lock** | Standard S3 Storage (10 GB) with WORM Compliance Legal Hold | **\$0.30** | Immutable statutory audit ledger featuring SHA-256 hash chains with 11 nines of data durability. |
| **AWS CloudWatch & Synthetics** | 1 Synthetic Canary (15s frequency) + Container Insights + Alarms | **\$15.50** | Real-time monitoring of Four Golden Signals and automated TTR failover alarms. |
| **AWS Secrets Manager & KMS** | 2 Database Credential Secrets + Customer Managed Key | **\$1.50** | Zero hardcoded credentials in containers; automated password rotation. |
| **AWS Route 53 & Data Transfer** | 1 Hosted Zone + ~50GB Data Transfer Out to Internet | **\$5.50** | Latency-based DNS routing with health checks. |
| **Reserve Buffer & Contingency** | Peak burst margin & load testing overhead | **\$53.00** | Covers Locust load tests (500 virtual users) and multi-region backup snapshots. |
| **TOTAL ESTIMATED MONTHLY SPEND** | **Pilot Production Deployment** | **$145.20** | **~₹12,050 / month** |

---

## 3. Strict Budget Alert Configuration
- **AWS Budget Threshold:** Configured at **\$10.00** hard alert for student development to prevent unintended charges.
- **Auto-Shutdown Action:** If spend exceeds \$25, an SNS alert triggers an automated Lambda function that scales ECS desired count to 0 and pauses non-essential services.
