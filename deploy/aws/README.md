# Deploying to AWS ECS

This directory deploys the single frontend+backend image to **ECS on Fargate**, with a managed
PostgreSQL database, a public Application Load Balancer and secrets in SSM Parameter Store.

The defaults are chosen for the lowest practical monthly bill while still keeping the database
managed and the container at **4 GB**:

| Choice | Why |
| --- | --- |
| Fargate **Spot** | Up to ~70% cheaper than on-demand Fargate; ECS reschedules a reclaimed task automatically. |
| **2 vCPU / 4 GB** task | Extra CPU for faster JVM startup and request handling; memory stays at 4 GB. |
| **No NAT gateway** | Tasks run in two public subnets and get public IPs; saves ~$33/month. Security groups keep them reachable only through the ALB. |
| **RDS db.t4g.micro, single-AZ, 20 GiB gp3** | Cheapest managed PostgreSQL that still gives automated backups and patching. |
| **SSM SecureString** parameters | Free at the standard tier; no Secrets Manager charge. |
| CloudWatch retention **7 days**, container insights **off**, ALB access logs **off** | Removes optional logging charges. |
| One task, stop-then-start deployments | Never runs two 4 GB tasks during a release. |

Approximate **us-east-1** cost (prices change; check the AWS calculator):

| Item | Monthly |
| --- | --- |
| Fargate Spot, 2 vCPU / 4 GB, always on | $22 – $31 |
| Application Load Balancer + minimal LCU | $18 – $22 |
| RDS db.t4g.micro + 20 GiB gp3 + backups | ~$14 |
| ECR image, logs, SSM | ~$1 |
| **Total** | **~$55 – $67** |

Without Spot the same shape is ~$105 – $112/month. Much larger savings are available if they
fit the requirements:

- The application does not need 2 vCPU / 4 GB. `task_cpu = 512`, `task_memory = 2048` brings compute
  down to roughly $7 – $10/month on Spot (total ~$40 – $46).
- `cpu_architecture = "ARM64"` is ~20% cheaper on Fargate, but the image must be built for
  `linux/arm64`.

## What gets created

```
Internet
   │  :80 / :443
   ▼
Application Load Balancer  ──►  ECS service (1 task, Fargate Spot)
                                      │  2 vCPU / 4 GB
                                      │  Spring Boot serves the SPA and /api/v1
                                      ▼
                              RDS PostgreSQL 16 (db.t4g.micro)

Public subnets in 2 AZs, no NAT. ALB is the only public entry point;
the task security group accepts 8080 only from the ALB;
RDS accepts 5432 only from the task security group.
```

The image contains the exported web client inside the jar, so the ALB target group needs only
port 8080. Database migrations run through Flyway on every container start.

## Prerequisites

- Terraform **1.9+** (validated with 1.9.8; earlier versions reject the cross-variable validation)
  and AWS credentials with permission to create VPC, ECS,
  RDS, ALB, IAM, ECR, CloudWatch and SSM resources.
- Docker with Buildx to build and push the image (or any CI that can build a Dockerfile).
- AWS CLI v2.

## Deploy

### 1. Configure

```bash
cd deploy/aws
cp terraform.tfvars.example terraform.tfvars
# edit admin_email and admin_password (minimum 10 characters)
terraform init
```

Use an immutable image tag such as a git SHA for `image_tag`, not `latest`, so ECS rolls to a new
task definition on every release. `latest` works, but requires a forced new deployment after each
push.

### 2. Create the image repository, then build and push

The ECS service needs an image before it can become healthy, so create ECR first:

```bash
terraform apply -target=aws_ecr_repository.app

REPO=$(terraform output -raw ecr_repository_url)
./build-push.sh us-east-1 "$REPO" <tag> linux/amd64
# ARM64 task size: ./build-push.sh us-east-1 "$REPO" <tag> linux/arm64
```

The build uses the Dockerfile at the repository root and produces one image with both the React
Native Web bundle and the Spring Boot API.

If Docker is unavailable locally, run the same `docker buildx build --platform linux/amd64
--push` step in CI (GitHub Actions, CodeBuild, etc.).

### 3. Create the rest of the stack

```bash
terraform apply
terraform output -raw alb_url
```

This creates the VPC, ALB, RDS instance (5–10 minutes), SSM parameters, IAM roles, ECS cluster,
task definition and service. The first task starts once RDS is available and the ALB health check
passes. The check calls `/api/v1/public/plans`, which reads from PostgreSQL, so a task with a
broken database connection stays unhealthy instead of serving a working page with a dead API.
Allow about three minutes after the apply finishes for the first boot.

### 4. Sign in

Open the `alb_url` and sign in with `admin_email` / `admin_password`. Administrators use a
password only; auditors enrol TOTP after accepting their invitation.

If this is the first boot, the administrator is created automatically. Changing
`admin_password` later does **not** rotate the existing account password — sign in and change it,
or rotate it through the API.

## HTTPS

HTTP is enabled by default because ACM needs a domain. For any real deployment, add TLS:

1. Request (or import) an ACM certificate in the **same region** for your domain.
2. Point the domain at the ALB with a Route 53 alias record (use `terraform output alb_dns_name`).
3. Set in `terraform.tfvars`:

   ```hcl
   acm_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/..."
   frontend_url        = "https://directory.example.com"
   cors_origins        = "https://directory.example.com"
   ```

4. Run `terraform apply`. Port 80 then redirects to 443, and email links use the new URL.
   Terraform refuses to apply with a certificate set and a `frontend_url` that is empty or
   not `https://`, so the emailed links cannot fall back to the plain ALB host name.

Without HTTPS, passwords and bearer tokens cross the internet in clear text, so treat the default
HTTP listener as development-only.

## Releasing a new version

```bash
REPO=$(terraform output -raw ecr_repository_url)
./build-push.sh us-east-1 "$REPO" <new-tag> linux/amd64
# update image_tag in terraform.tfvars, then:
terraform apply
```

Using `latest` instead? After pushing, force a new deployment:

```bash
aws ecs update-service \
  --cluster "$(terraform output -raw ecs_cluster_name)" \
  --service "$(terraform output -raw ecs_service_name)" \
  --force-new-deployment
```

Watch the rollout and application logs:

```bash
aws logs tail "$(terraform output -raw log_group_name)" --follow
```

## Operations and trade-offs

- **Spot interruptions.** Fargate Spot can reclaim the task with a two-minute warning. The service
  reschedules automatically, so expect a short outage with `desired_count = 1`. Set
  `desired_count = 2` (or `use_fargate_spot = false`) if the site must stay up. Two tasks double
  compute cost.
- **Deployment downtime.** `deployment_minimum_healthy_percent = 0` replaces the task before
  starting the new one, deliberately avoiding two 4 GB tasks at once. A release takes the usual
  minute or two to boot Spring Boot and run migrations. Set the values to 100/200 for zero
  downtime at the cost of briefly running two tasks.
- **Concurrent migrations.** Flyway takes a database lock, so more than one task at startup is
  safe, but rolling deployments and schema changes should still be watched in the logs.
- **Database lifecycle.** `db_skip_final_snapshot = true` keeps `terraform destroy` cheap but
  deletes all data. Set it to `false` and `db_deletion_protection = true` for production.
  Automated backups are kept for `db_backup_retention_days` (7 by default).
- **ECR cleanup.** The repository keeps the last five images; `force_delete = true` lets
  `terraform destroy` remove the repository with its images.
- **Secrets.** Generated values live in SSM under `/<name>/<environment>/` and in Terraform state.
  For shared environments, use an encrypted S3 backend with state locking and restrict access to
  the state bucket. SMTP and payment secrets are only created when their variables are non-empty.
- **No SSH / ECS Exec.** ECS Exec is disabled. Use CloudWatch Logs for troubleshooting.
- **Image tag drift.** With `image_tag = "latest"`, Terraform cannot see a new image. Prefer
  immutable tags.
- **Single AZ.** The database is single-AZ, matching the low-cost goal. Multi-AZ roughly doubles
  the RDS cost.

## Destroy

```bash
terraform destroy
```

This removes the ALB, ECS service, cluster, RDS instance (without a final snapshot by default),
SSM parameters, logs and the ECR repository. Data and images are not recoverable afterwards.
