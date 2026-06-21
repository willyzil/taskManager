#!/bin/bash
set -e
cd /home/aiserver/projects/taskManager
docker compose build --no-cache 2>&1
echo "BUILD_DONE"
