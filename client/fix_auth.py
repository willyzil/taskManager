path = '/home/aiserver/projects/taskManager/client/src/App.tsx'
with open(path, 'r') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'AUTH_PATHS' in line and 'const' in line:
        lines[i] = "const AUTH_PATHS=*** '/register'];\n"
        break
with open(path, 'w') as f:
    f.writelines(lines)
print("Fixed")
