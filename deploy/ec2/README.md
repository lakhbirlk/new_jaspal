# Single-instance deployment (EC2 + Postgres + Elastic IP)

One `t4g.small` (2 vCPU, 2 GiB, Graviton/ARM64) runs PostgreSQL and the
application container. There is no load balancer and no RDS.

| Resource | Cost (us-east-1, on-demand) |
|---|---|
| `t4g.small` | $0.0168/hour → $12.26/month |
| 30 GiB gp3 root volume | $2.40/month |
| Elastic IP (attached) | $0.00 |
| **Total** | **≈ $14.66/month** |

Compare with ≈ $57/month for Fargate + RDS + ALB.

## Usage

```bash
cd deploy/ec2
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

Terraform returns in about a minute with the Elastic IP, but the application
is **not live yet**. The first boot clones the repo, installs Docker, builds
the image and starts both containers — expect **15–25 minutes** on this size.
Watch progress with:

```bash
aws ssm start-session --target <instance_id>
tail -f /var/log/user-data.log
```

Then open `terraform output app_url`.

## How it runs

- The boot script builds the image natively for arm64, so no registry or
  build machine is needed.
- PostgreSQL runs as `app-db` with a named volume `app-pgdata`.
- The application runs as `app`, publishing port 8080.
- A 4 GiB swap file is created because the Maven + Expo build does not fit in
  2 GiB of RAM. It is slow but reliable.
- `SEED_DEMO=true` creates the demo researcher, business and auditor accounts.

## Access

SSH is disabled by default. Use SSM Session Manager (the instance profile
grants it):

```bash
aws ssm start-session --target <instance_id>
```

Set `ssh_cidr` to your IP if you want SSH instead.

## Cost and durability notes

- **Stopping** the instance (`aws ec2 stop-instances`), not terminating it,
  drops compute cost to ~$2.40/month for storage. The Elastic IP is charged
  at $0.005/hour while the instance is stopped.
- **The database lives on the root volume.** Terminating the instance destroys
  it. Take a snapshot or copy dumps if the data matters.
- There is no load balancer, so nothing performs health checks or restarts a
  broken container beyond Docker's `restart: unless-stopped` policy.
- Adding a domain and running Caddy on ports 80/443 would give HTTPS for free;
  the security group already allows those ports.
