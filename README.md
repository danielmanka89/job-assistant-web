# job-assistant-web
## Running the frontend

```bash
npm install
cp .env.example .env   # set NEXT_PUBLIC_MOCK_API="true" to run without the backend
npm run dev
```

Open http://localhost:3000. Pages: `/login`, `/register`, `/dashboard` (requires a session cookie).

### Mock mode test inputs

- Register with `taken@example.com` to see an email field error.
- Log in with password `wrongpass` to see an invalid credentials error.
- Upload a file with `fail` in its name to see a parse error.
