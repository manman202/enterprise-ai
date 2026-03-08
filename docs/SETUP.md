# Aiyedun — Complete VPS Setup Guide

This guide walks you from a **bare Ubuntu 22.04 VPS** to a fully operational Aiyedun platform with SSL, CI/CD, and Docker. Follow every step in order.

---

## Table of Contents

1. [DNS Records](#1-dns-records)
2. [Initial Server Setup](#2-initial-server-setup)
3. [Swap Space](#3-swap-space)
4. [Firewall (UFW)](#4-firewall-ufw)
5. [Fail2ban](#5-fail2ban)
6. [Docker](#6-docker)
7. [Nginx](#7-nginx)
8. [SSL with Certbot](#8-ssl-with-certbot)
9. [GitLab CE](#9-gitlab-ce)
10. [GitLab Runner](#10-gitlab-runner)
11. [GitHub Mirror](#11-github-mirror)
12. [Deploy Aiyedun](#12-deploy-aiyedun)
13. [Health Check](#13-health-check)

---

## 1. DNS Records

Create the following **A records** at your DNS provider pointing to the VPS public IP:

| Hostname              | Type | Value        | TTL  |
|-----------------------|------|--------------|------|
| `aiyedun.online`      | A    | `<VPS_IP>`   | 300  |
| `admin.aiyedun.online`| A    | `<VPS_IP>`   | 300  |
| `api.aiyedun.online`  | A    | `<VPS_IP>`   | 300  |
| `gitlab.aiyedun.online`| A   | `<VPS_IP>`   | 300  |

Verify propagation before proceeding:

```bash
dig +short aiyedun.online
dig +short admin.aiyedun.online
dig +short api.aiyedun.online
```

---

## 2. Initial Server Setup

```bash
# Update all packages
sudo apt update && sudo apt upgrade -y

# Install essential utilities
sudo apt install -y \
    curl wget git unzip \
    ca-certificates gnupg \
    lsb-release software-properties-common \
    htop ncdu ufw fail2ban

# Set timezone
sudo timedatectl set-timezone UTC

# Create a non-root deploy user (skip if you already have one)
sudo adduser deploy
sudo usermod -aG sudo docker deploy
```

---

## 3. Swap Space

Ollama and the full stack together can spike RAM. Add 8 GB swap as a safety net.

```bash
# Check if swap already exists
free -h

# Create an 8 GB swapfile
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make it permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Tune swappiness (keep RAM preferred)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Verify
free -h
```

---

## 4. Firewall (UFW)

```bash
# Allow SSH before enabling (critical — do not skip)
sudo ufw allow 22/tcp comment 'SSH'

# HTTP and HTTPS for Nginx
sudo ufw allow 80/tcp  comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Enable firewall
sudo ufw --force enable

# Verify rules
sudo ufw status verbose
```

> **Note:** Application ports (3000, 4000, 8000, 8080) are deliberately blocked externally — Nginx proxies to them internally.

---

## 5. Fail2ban

```bash
# Install (already done in step 2)
sudo systemctl enable --now fail2ban

# Create a local jail config (overrides defaults safely)
sudo tee /etc/fail2ban/jail.local > /dev/null <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = ssh
EOF

sudo systemctl restart fail2ban

# Verify SSH jail is active
sudo fail2ban-client status sshd
```

---

## 6. Docker

```bash
# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine + Compose plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Allow current user to run docker without sudo
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker version
docker compose version
```

---

## 7. Nginx

Nginx acts as the reverse proxy and SSL terminator for all services.

```bash
# Install Nginx
sudo apt install -y nginx

# Remove the default site
sudo rm -f /etc/nginx/sites-enabled/default

# Create Nginx virtual hosts
# ── User Portal ──────────────────────────────────────────────────────────────
sudo tee /etc/nginx/sites-available/aiyedun.online > /dev/null <<'EOF'
server {
    listen 80;
    server_name aiyedun.online;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
EOF

# ── Admin Panel ───────────────────────────────────────────────────────────────
sudo tee /etc/nginx/sites-available/admin.aiyedun.online > /dev/null <<'EOF'
server {
    listen 80;
    server_name admin.aiyedun.online;

    location / {
        proxy_pass         http://127.0.0.1:4000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
EOF

# ── API ───────────────────────────────────────────────────────────────────────
sudo tee /etc/nginx/sites-available/api.aiyedun.online > /dev/null <<'EOF'
server {
    listen 80;
    server_name api.aiyedun.online;

    client_max_body_size 50M;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
EOF

# Enable all sites
sudo ln -sf /etc/nginx/sites-available/aiyedun.online       /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/admin.aiyedun.online /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/api.aiyedun.online   /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

---

## 8. SSL with Certbot

```bash
# Install Certbot + Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Issue certificates for all three domains
sudo certbot --nginx \
    -d aiyedun.online \
    -d admin.aiyedun.online \
    -d api.aiyedun.online \
    --non-interactive --agree-tos \
    --email admin@aiyedun.online

# Verify auto-renewal timer
sudo systemctl status certbot.timer

# Test renewal (dry run)
sudo certbot renew --dry-run
```

Certbot will automatically rewrite your Nginx configs to add HTTPS and redirect HTTP → HTTPS.

---

## 9. GitLab CE

GitLab is the primary CI/CD server. Run it as a Docker container.

```bash
# Create a persistent data directory
sudo mkdir -p /srv/gitlab/{config,logs,data}

# Run GitLab CE
sudo docker run --detach \
    --hostname gitlab.aiyedun.online \
    --publish 8080:80 \
    --publish 2222:22 \
    --name gitlab \
    --restart always \
    --volume /srv/gitlab/config:/etc/gitlab \
    --volume /srv/gitlab/logs:/var/log/gitlab \
    --volume /srv/gitlab/data:/var/opt/gitlab \
    --shm-size 256m \
    gitlab/gitlab-ce:latest

# GitLab takes 2-5 minutes to start. Watch logs:
sudo docker logs -f gitlab

# Retrieve initial root password
sudo docker exec -it gitlab grep 'Password:' /etc/gitlab/initial_root_password
```

Add a GitLab site to Nginx (port 8080):

```bash
sudo tee /etc/nginx/sites-available/gitlab.aiyedun.online > /dev/null <<'EOF'
server {
    listen 80;
    server_name gitlab.aiyedun.online;

    client_max_body_size 250M;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/gitlab.aiyedun.online /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Issue SSL for GitLab
sudo certbot --nginx -d gitlab.aiyedun.online \
    --non-interactive --agree-tos --email admin@aiyedun.online
```

Log in at `https://gitlab.aiyedun.online` with `root` and the retrieved password.
Create a new project named **enterprise-ai**.

---

## 10. GitLab Runner

```bash
# Install GitLab Runner on the same VPS
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" \
    | sudo bash
sudo apt install -y gitlab-runner

# Add runner to docker group so it can run Docker commands in pipelines
sudo usermod -aG docker gitlab-runner

# Register the runner
# Go to: GitLab → enterprise-ai project → Settings → CI/CD → Runners
# Copy the registration token, then run:
sudo gitlab-runner register \
    --url "https://gitlab.aiyedun.online" \
    --registration-token "<YOUR_RUNNER_TOKEN>" \
    --executor "shell" \
    --description "aiyedun-shell-runner" \
    --tag-list "aiyedun,shell,docker" \
    --run-untagged="true" \
    --locked="false"

sudo systemctl enable --now gitlab-runner
sudo systemctl status gitlab-runner
```

---

## 11. GitHub Mirror

The GitLab pipeline mirrors `main` and `develop` to GitHub automatically.

**Step 1 — Create a GitHub PAT:**
1. GitHub → Settings → Developer Settings → Personal access tokens → Tokens (classic)
2. Generate token with `repo` scope
3. Copy the token

**Step 2 — Add CI variable in GitLab:**
1. GitLab → enterprise-ai → Settings → CI/CD → Variables
2. Add variable:
   - Key: `GITHUB_TOKEN`
   - Value: `<your_github_pat>`
   - Masked: yes, Protected: yes

**Step 3 — Confirm mirror job in `.gitlab-ci.yml`:**

The `mirror:github` job in the pipeline pushes to:
```
https://oauth2:${GITHUB_TOKEN}@github.com/aiyedun/enterprise-ai.git
```

This runs automatically on every push to `main` or `develop`.

---

## 12. Deploy Aiyedun

```bash
# Clone the repository (use HTTPS or SSH depending on your setup)
cd /opt
sudo mkdir -p aiyedun
sudo chown $USER:$USER aiyedun
git clone https://gitlab.aiyedun.online/root/enterprise-ai.git aiyedun/enterprise-ai
cd aiyedun/enterprise-ai

# Create environment file
cp backend/.env.example .env

# Edit .env — at minimum change these values:
nano .env
# SECRET_KEY=<generate with: openssl rand -hex 32>
# POSTGRES_PASSWORD=<strong_password>

# Pull Mistral model into Ollama (one-time, ~4 GB download)
# Start Ollama first so we can pull the model
cd infra
docker compose up -d ollama
sleep 15
docker exec aiyedun-ollama ollama pull mistral

# Start the full stack
docker compose up -d

# Watch startup logs
docker compose logs -f

# Verify all containers are healthy
docker ps
```

Wait approximately 60 seconds for all healthchecks to pass, then verify:

```bash
curl -s http://localhost:8000/api/v1/health | python3 -m json.tool
```

Expected output:
```json
{
    "api": "ok",
    "postgres": "ok",
    "chromadb": "ok",
    "ollama": "ok"
}
```

---

## 13. Health Check

Run the built-in health check script at any time:

```bash
chmod +x /opt/aiyedun/enterprise-ai/infra/scripts/health-check.sh
/opt/aiyedun/enterprise-ai/infra/scripts/health-check.sh
```

**Set up nightly backup** (runs at 02:00 UTC):

```bash
chmod +x /opt/aiyedun/enterprise-ai/infra/scripts/backup.sh

# Add to root's crontab
sudo crontab -e
# Add this line:
# 0 2 * * * /opt/aiyedun/enterprise-ai/infra/scripts/backup.sh
```

**Verify platform is live:**

| URL                              | Expected                      |
|----------------------------------|-------------------------------|
| `https://aiyedun.online`         | User login page               |
| `https://admin.aiyedun.online`   | Admin login page              |
| `https://api.aiyedun.online/api/v1/health` | JSON health status  |
| `https://gitlab.aiyedun.online`  | GitLab CE dashboard           |

The platform is live. Proceed to create the first admin user via the API or database seed script.
