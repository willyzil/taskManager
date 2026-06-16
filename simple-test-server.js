const http = require('http');
const port = 5001;
const server = http.createServer((req, res) => {
  res.writeHead(200, {"Content-Type": "text/plain"});
  res.end("Task Manager API is running on port 5001");
});

server.listen(port, () => {
  console.log(`Test server running on port ${port}`);
  console.log(`Access from another machine: http://$(hostname -I | awk '{print $1}'):${port}`);
});