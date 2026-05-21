# FoodScanner AI

FoodScanner AI is a full-stack food scanning app that helps users scan packaged foods, look up product details, analyze ingredients, and get health-focused nutrition insights.

## Live Links

- Live app: https://foodscanner-mobile.onrender.com
- Backend API: https://foodscanner-ai.onrender.com
- API health check: https://foodscanner-ai.onrender.com/health
- API docs: https://foodscanner-ai.onrender.com/docs

## Project Structure

- `foodscanner-ai/` - FastAPI backend, ML scoring, product lookup, auth, database, and reporting logic.
- `foodscanner-mobile/` - Expo React Native app for mobile/web users.

## Features

- User registration and login
- Barcode/product scan flow
- Manual food entry
- Nutrition and ingredient analysis
- Daily and weekly reports
- Public web deployment through Render

## Local Development

Start the backend:

```bash
cd foodscanner-ai
py -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

Start the mobile app:

```bash
cd foodscanner-mobile
npx expo start --tunnel
```

For local Expo testing, set `foodscanner-mobile/.env` to your machine URL:

```bash
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LOCAL_IP:8000
```

For deployed builds, use the public backend URL:

```bash
EXPO_PUBLIC_API_BASE_URL=https://foodscanner-ai.onrender.com
```
