#!/bin/bash
# Fix Docker network labels that get lost after `docker compose down`
docker network rm taskmanager_default 2>/dev/null
docker network create --label com.docker.compose.network=default --label com.docker.compose.project=taskmanager taskmanager_default
