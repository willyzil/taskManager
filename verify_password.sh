#!/bin/bash
# This script verifies the database password
echo "Password: taskmanager_pass"
docker exec taskmanager-postgres-1 pg_isready -U taskmanager -d taskmanager
