# AGENTS.md

## Cursor Cloud specific instructions

This is a React + TypeScript SPA (Vite) with a Firebase serverless backend. See `README.md` for project overview and `package.json` for available scripts.

### Key commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (port 3000, `0.0.0.0`) |
| Lint / type-check | `npm run lint` (`tsc --noEmit`) |
| Production build | `npm run build` |
| Clean | `npm run clean` |

### Notes

- **Pre-existing TS error**: `src/components/PreparationList.tsx` references an unimported `Save` icon; `npm run lint` exits with code 2. The build (`npm run build`) succeeds because Vite does not run type-checking.
- **Firebase config is hardcoded** in `firebase-applet-config.json`; no local Firebase emulator setup is needed. Firestore and Auth are cloud-hosted and require internet access.
- **Push notifications (FCM)** are optional: set `VITE_FIREBASE_VAPID_KEY` (Web Push public key from Firebase Console) for device tokens. On Vercel, set `FIREBASE_SERVICE_ACCOUNT_JSON` so `/api/notify` can send multicast pushes (Firebase free tier). In-app notifications in Firestore work without these.
- **No `.env` file is required** for basic dev. `GEMINI_API_KEY` is only needed for AI features (currently not wired into the UI). The app loads and is fully interactive without it.
- **No backend server** to start; Express is a dependency but has no entry point in `src/`.
- **HMR** is enabled by default in dev. Set `DISABLE_HMR=true` to disable (used by AI Studio).
