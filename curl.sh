curl -I http://localhost:3000/

curl -I http://localhost:3000/ -H "Host: example.com"

curl -I http://localhost:3000/products/ -H "Host: thing.google"

curl -I http://localhost:3000/ -H "Host: example.com" -H "X-Authenticated-Scope: all the scopes"