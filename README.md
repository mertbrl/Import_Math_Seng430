# 🏥 HEALTH-AI: ML Visualization Tool

## 📖 Project Overview
HEALTH-AI is an interactive, web-based educational platform built for healthcare professionals (doctors, nurses, clinical researchers) and students.
Its main goal is to make AI and ML in clinical workflows understandable, transparent, and practical.

The platform is designed as a guided 7-step experience where users can:
- work with clinical datasets,
- train ML models,
- interpret predictions,
- evaluate fairness,
- and generate a structured summary certificate.

## ✨ Core Features: 7-Step Clinical ML Journey
1. **Clinical Context**
   Define the medical specialty, use case, and prediction objective.

2. **Data Exploration**
   Use built-in datasets (20 specialties) or upload a custom CSV file (up to 50 MB).
   Includes schema checks and column/target validation.

3. **Data Preparation**
   Configure train/test split, missing value handling, normalization, and optional SMOTE.

4. **Model Selection & Parameters**
   Train and tune 6 model families:
   KNN, SVM, Decision Tree, Random Forest, Logistic Regression, Naive Bayes.

5. **Results & Evaluation**
   Review Accuracy, Sensitivity, Specificity, Precision, F1, AUC-ROC and confusion matrix outputs.

6. **Explainability**
   Inspect global feature effects and local (single-patient) explanations.

7. **Ethics & Certificate**
   Run subgroup fairness checks and generate a final PDF-style summary output.

## 🏗️ Technical Architecture
The project follows a component-based frontend and layered backend architecture.

### Frontend Layer
- **Framework:** React 18 + Vite
- **HTTP Client:** Axios
- **Flow Model:** Step-based pipeline state (7-step UI)
- **Current Styling:** Component-level styles
- **Planned UI Upgrade:** Tailwind CSS based design system

### Backend Layer
- **Framework:** FastAPI
- **Validation:** Pydantic v2
- **Server:** Uvicorn
- **API Contract:** OpenAPI/Swagger
- **Execution Model:**
  - synchronous endpoints for data, explainability, fairness, certificate
  - asynchronous train start + status polling for model training

### ML/Domain Layer
- Structured service and engine folders for:
  - data preparation,
  - model training,
  - evaluation,
  - explainability,
  - fairness,
  - certificate generation.

### Data/State Strategy
- **Current state storage:** In-memory session/task state (no database yet)
- **Implication:** Good for demo/education; not production-persistent.

## 🧰 Tools & Technologies
### Core Runtime
- Python 3.11+
- Node.js 20+
- npm 10+

### Frontend
- React 18
- Vite
- Axios
- (Planned) Tailwind CSS

### Backend
- FastAPI
- Pydantic
- Uvicorn
- python-multipart

### Testing & Quality
- pytest
- httpx (API testing)
- Lighthouse / axe (accessibility and UX quality)

### Product & Collaboration
- Jira (stories and acceptance criteria)
- Figma (UI/UX)
- GitHub (code + wiki/docs)

## 🔌 API Endpoints (Current Active v1)
Base prefix: `/api/v1`

### 1) System & Data
1. `GET /health`
   - API health check.

2. `GET /data/datasets`
   - Returns built-in clinical datasets (20 specialties).

3. `POST /data/upload`
   - Upload CSV (max 50 MB), profile columns, missing rates, class balance.

4. `POST /data/validate-mapping`
   - Validates target column and mapping rules.

5. `POST /data/prepare`
   - Applies split + preprocessing configuration + optional SMOTE summary.

### 2) Model Training (Async)
6. `GET /models`
   - Returns supported models and parameter bounds.

7. `POST /models/train/start`
   - Starts background model training, returns `task_id`.

8. `GET /models/train/status/{task_id}`
   - Poll training status and retrieve results when completed.

### 3) Explainability, Fairness, Certificate
9. `POST /insights/explain/global`
   - Global explanation output.

10. `POST /insights/explain/local`
    - Local, single-patient explanation output.

11. `POST /insights/fairness`
    - Subgroup fairness metrics + bias flag.

12. `POST /certificate/generate`
    - Generates final summary certificate payload.

### Extra Health Route
- `GET /healthz` (non-schema quick health route)

## 🗂️ Repository Structure
```text
imp_math_back/
├── backend-service/
│   ├── app/
│   │   ├── api/v1/endpoints/
│   │   ├── core/
│   │   ├── ml_core/
│   │   ├── schemas/
│   │   └── services/
│   ├── tests/
│   └── requirements.txt
├── frontend-app/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   └── store/
│   └── package.json
└── README.md
```

## ▶️ Run Locally (No Docker)
### Backend
```bash
cd /Users/mertbursalioglu/workspace/imp_math_back/backend-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 5001
```

### Frontend
```bash
cd /Users/mertbursalioglu/workspace/imp_math_back/frontend-app
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

## 🌐 Local URLs
- Backend API: `http://localhost:5001`
- Swagger UI: `http://localhost:5001/docs`
- OpenAPI JSON: `http://localhost:5001/openapi.json`
- Frontend: `http://localhost:5173`


