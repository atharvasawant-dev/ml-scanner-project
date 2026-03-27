# FoodScanner AI

Barcode-based food nutrition analysis system with health scoring and personalized recommendations.

## Tech Stack

- **Backend**: FastAPI
- **Database**: SQLAlchemy (SQLite/PostgreSQL)
- **ML**: scikit-learn (Random Forest for NutriScore prediction)
- **Auth**: JWT (python-jose)
- **Data**: OpenFoodFacts API, Indian packaged foods dataset

## Features

- Barcode lookup with local DB and OpenFoodFacts fallback
- NutriScore prediction when missing
- Detailed health scoring (sugar, salt, fat, protein, fiber, ingredients, additives)
- Diet-aware scoring (diabetic, vegan, vegetarian, low_sodium)
- Daily & weekly health reports
- Goal tracking with progress and recommendations
- Score explanation breakdown per product
- User authentication and profiles

## Setup

### 1. Clone and environment

```bash
git clone https://github.com/atharvasawant-dev/foodscanner-ai.git
cd foodscanner-ai
python -m venv .venv
.\.venv\Scripts\Activate.ps1  # Windows
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Initialize database

```bash
python -m database.init_db
```

### 4. Train ML model (optional)

```bash
python ml_model/train_model.py
```

### 5. Run API server

```bash
uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Visit http://127.0.0.1:8000/docs for interactive API docs.

## Environment

Create `.env` with:

```
DATABASE_URL=sqlite:///database/foodscanner.db
SECRET_KEY=your-secret-key
```

Do not commit `.env`.

## Simple Public Deployment

If you want the mobile APK to work for other people, the backend must be hosted on a public URL.

This repo now includes:

- `.env.example` for required environment variables
- `render.yaml` at the repo root for a simple Render deployment

Recommended start command:

```bash
uvicorn api.main:app --host 0.0.0.0 --port $PORT
```

After deployment, open:

```text
https://your-backend-url/health
https://your-backend-url/docs
```

If both work, use that backend URL in the mobile app's `EXPO_PUBLIC_API_BASE_URL`.
