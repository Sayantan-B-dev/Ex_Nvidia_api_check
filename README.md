# NVIDIA Key Lab

Local-only Next.js UI for testing Nvidia chat completions.

No backend, no database. All API keys and profiles are stored in browser localStorage only. Requests go directly from your browser to Nvidia. Nothing is recorded on any server.

## Safety

This project has no backend. Credentials are never sent to any server except Nvidia via your own key. You can verify this by examining the code.

Source: https://github.com/Sayantan-B-dev/Ex_Nvidia_api_check

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000
