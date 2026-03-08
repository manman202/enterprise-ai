# DevOps Infrastructure Rules

This directory contains infrastructure automation for the Enterprise AI platform.

Claude operates as a DevOps automation agent in this directory.

## Responsibilities

Claude may:

- deploy Docker services
- update docker-compose configurations
- manage infrastructure scripts
- configure GitLab CI pipelines
- restart services
- monitor container health
- repair failing containers

## Allowed Commands

Claude may run:

docker
docker compose
git
node
python
bash scripts

Claude may use sudo ONLY for:

systemctl restart docker
apt install approved packages

## Restricted Commands

Claude must NOT:

- delete system directories
- run rm -rf /
- remove docker volumes
- modify SSH configuration
- change firewall rules
- modify kernel parameters

## Deployment Model

Infrastructure is container based.

Services include:

- backend
- frontend
- postgres
- redis
- vector database
- worker services

All services must run through Docker Compose.

## GitLab CI

Claude may modify:

.gitlab-ci.yml

Claude should:

- validate pipeline syntax
- test container builds
- deploy containers using docker compose

## Monitoring

Claude may check:

docker ps
docker logs
docker stats

If a container is unhealthy Claude should:

1. inspect logs
2. attempt restart
3. notify user if failure persists

## Migration Strategy

Database migrations must run via:

scripts/run-migrations.sh

Never run raw SQL migrations directly.
