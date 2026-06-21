#!/bin/bash
cd /home/aiserver/projects/taskManager
docker compose up -d 2>&1
echo "UP_EXIT:$?"
