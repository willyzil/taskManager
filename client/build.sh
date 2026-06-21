#!/bin/bash
cd /home/aiserver/projects/taskManager/client
node_modules/.bin/vite build 2>&1
echo "BUILD_EXIT:$?"
