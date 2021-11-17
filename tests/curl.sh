curl -I http://localhost:3000/

curl -I http://localhost:3000/ -H "Host: example.com"

curl -I http://localhost:3000/products/ -H "Host: thing.google"

curl -I http://localhost:3000/ -H "Host: example.com" -H "X-Authenticated-Scope: all the scopes"

curl -I http://localhost:3000/jwt/ -H "Host: example.com" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZXN0IjoiMSJ9.JDfCu69YMtGgGfImZq9j0xapAIkEM9Hf6VM_wvd4Z9M"