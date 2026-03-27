# FoodScanner Mobile

Expo React Native app for barcode scanning, OCR nutrition-label scanning, food analysis, and daily tracking.

## What You Need For A Shareable APK

For an APK that other people can use:

1. Deploy the backend to a public URL.
2. Set `EXPO_PUBLIC_API_BASE_URL` to that public backend URL.
3. Build the Android APK with EAS Build.
4. Install the APK on a real phone and test login, scan, OCR, and reports.

GitHub is useful for backup and deployment, but it is not enough by itself. If the app still points to a local IP address, the APK will not work for other people.

## Local Setup

```bash
npm install
```

Create `.env` in this folder:

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-public-backend-url.onrender.com
```

Start the app:

```bash
npx expo start
```

## Build An APK Without Android Studio

Log in to Expo:

```bash
npx expo login
```

Create or link the EAS project:

```bash
npx eas init
```

Build the APK:

```bash
npm run build:apk
```

This uses the `preview` profile in `eas.json`, which generates an installable Android APK.

## Important Notes

- `EXPO_PUBLIC_API_BASE_URL` must be a public backend URL, not `localhost` and not your home Wi-Fi IP.
- The backend should allow traffic from the app and keep required files like the database and ML model available on the server.
- Ignored files like local databases, generated model files, and Expo generated typings usually do not need to go to GitHub unless your deployment strategy specifically depends on them.
