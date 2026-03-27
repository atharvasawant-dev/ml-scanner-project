# FoodScanner AI – Intelligent Food Health Analysis System

## Project Overview

FoodScanner AI helps users quickly understand whether a packaged food product is healthy or not. By scanning a product’s barcode, the system analyzes nutrition data, ingredients, and food additives to provide:

- A **health score**
- A clear decision: **SAFE / MODERATE / AVOID**
- Simple **explanations** for the decision
- **Daily calorie tracking** to stay within personal limits

The goal is to make healthy eating easier by giving instant, reliable feedback on everyday food products.

## Problem Statement

Many people buy packaged foods without fully understanding their nutritional impact:

- Nutrition labels can be hard to interpret
- Harmful additives are hidden in ingredient lists
- Excess sugar, salt, or fats go unnoticed
- There is no quick way to decide if a product is healthy

FoodScanner AI solves these problems by automatically analyzing food products and providing easy-to-understand advice.

## Key Features

### Barcode Scanning
Users scan a product barcode to instantly retrieve its nutrition information.

### Nutrition Analysis
Analyzes key nutrients:
- Calories
- Sugar
- Salt (sodium)
- Fat
- Protein
- Fiber
- Carbohydrates

### Ingredient Risk Detection
Flags potentially problematic ingredients in the product.

### Additive Detection
Detects and warns about risky food additives (e.g., E621, E211, etc.).

### Health Score Calculation
Generates a health score that reflects how healthy a product is based on nutrition and additives.

### Explainable Decisions
Shows clear reasons why a product is marked SAFE, MODERATE, or AVOID.

### Search System
Allows users to manually search for products by name.

### Indian Dataset Support
Includes a local dataset of Indian packaged foods for products not found in the global database.

### Daily Calorie Tracking
Tracks how many calories a user has consumed today and compares it to their daily limit.

### Scan History
Stores and allows users to view previously scanned products.

## System Architecture

```
┌─────────────────┐
│   FastAPI      │   ← Handles API endpoints (/scan, /search, /history, /today)
│   Backend      │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  Service Layer │   ← Business logic for product analysis,
│                │      nutrition scoring, ingredient/additive checks
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  SQLAlchemy    │   ← ORM for database interactions
│      ORM       │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  PostgreSQL    │   ← Stores products, nutrition, scan history,
│   Database     │      users, and daily food logs
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ OpenFoodFacts  │   ← External API to fetch product data
│      API       │
└─────────────────┘
```

## Technology Stack

### Backend
- **Python** – Core programming language
- **FastAPI** – Modern, fast web framework for APIs

### Database
- **PostgreSQL** – Reliable relational database

### ORM
- **SQLAlchemy** – Python ORM for database operations

### Data Processing
- **Pandas** – Data manipulation and analysis

### Machine Learning
- **Scikit-learn** – Predicts NutriScore when missing from product data

### External APIs
- **OpenFoodFacts** – Source of product nutrition and ingredient data

## Database Design

The system uses the following main tables:

- **products** – Stores product details (barcode, name, brand, ingredients, additives)
- **nutrition** – Stores nutrition values per product (calories, sugar, salt, fat, etc.)
- **scan_history** – Records each barcode scan by a user
- **daily_food_log** – Tracks calories consumed per day
- **users** – Stores user profiles and daily calorie limits

## API Endpoints

### POST /scan
Scan a product barcode and receive a full analysis including health score, decision, reasons, and daily intake.

### GET /search
Search for products by name (supports fuzzy matching).

### GET /history
View the user’s recent scan history.

### GET /today
Check how many calories the user has consumed today and their remaining budget.

## Example API Response

```json
{
  "product": {
    "name": "Maggi Noodles",
    "nutrition": {
      "calories": 430,
      "fat": 15,
      "sugar": 4,
      "salt": 3.5,
      "protein": 9,
      "fiber": 2,
      "carbs": 65
    },
    "nutriscore": "c"
  },
  "analysis": {
    "ingredient_analysis": { ... },
    "additive_analysis": { ... },
    "health_score": 42
  },
  "decision": {
    "final_decision": "MODERATE",
    "reasons": [
      "high sodium level",
      "contains risky additives: E621"
    ]
  },
  "daily_intake": {
    "consumed": 1200,
    "remaining": 800
  }
}
```

## Future Improvements

- **Mobile App with Camera Barcode Scanning**
- **Personalized Diet Profiles**
- **Healthier Product Recommendations**
- **Cloud Deployment for Scalability**

## Authors

FoodScanner AI is a college project focused on intelligent food analysis and helping users make healthier choices.
