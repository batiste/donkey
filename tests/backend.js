

const http = require("http");

const host = 'localhost';
const port = 8000;

const requestListener = function (req, res) {
  console.log('Request on backend')
  res.setHeader("Content-Type", "application/json");
  res.writeHead(200);

  if (req.url === '/users/me/meta') {
    return res.end(JSON.stringify({
      uuid: 'asd-2332',
      scopes: 'read-book create-books',
      rateLimitationBy: {second: 5, minute: 5, hour: 120},
      orgRateLimitationBy: {second: 5, minute: 25, hour: 400}
    }));
  }

  res.end(`{"message": "This is a JSON response"}`);
  // setTimeout(() => {

  // }, 200)
};

const server = http.createServer(requestListener);
server.listen(port, () => {
    console.log(`Backend is running on http://${host}:${port}`);
});

