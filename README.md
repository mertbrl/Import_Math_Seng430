# IMP ML Tool Backend + Frontend

Bu proje, saglik alanina yonelik 7 adimli bir ML egitim/pipeline deneyimini backend ve frontend katmanlariyla sunar.
Yapi Docker'siz gelistirme akisini hedefler.

## 1. Ne Saglar

1. Session bazli pipeline yonetimi
2. Dataset yukleme/degistirme ve versiyonlama (`dataset_version`)
3. Mapping dogrulama ve step kilit acma mantigi
4. Preprocessing config + run
5. Training config + coklu run yonetimi
6. Evaluation, explainability, fairness ciktilari
7. Certificate olusturma
8. Legacy endpointlerle geriye donuk uyumluluk

## 2. Mimarinin Omurgasi

1. `Session`:
- Her kullanici akisi bir `session_id` altinda tutulur.
- Tum adim ciktilari session state icinde saklanir.

2. `Dataset Versioning`:
- Dataset create/patch/delete islemlerinde `dataset_version` artar.
- Eski run ve analizler stale kabul edilir.

3. `Pipeline Revision`:
- Session state degistikce `pipeline_revision` artar.
- Hangi cikti hangi revizyonda olustu takip edilir.

4. `Run`:
- Training sonucu `run_id` ile tutulur.
- Evaluation/Explainability/Fairness run bazli sorgulanir.

## 3. Invalidation Kurallari

1. Dataset degisirse:
- Mapping, preprocessing, training runs, evaluation, explainability, fairness, certificate invalid edilir.

2. Mapping degisirse:
- Preprocessing ve sonrasi invalid edilir.

3. Preprocessing degisirse:
- Training ve sonrasi invalid edilir.

4. Training config/run degisirse:
- Evaluation, explainability, fairness, certificate invalid edilir.

## 4. Klasor Yapisi

1. Backend:
- `backend-service/app/main.py`: FastAPI app girisi
- `backend-service/app/api/v1/router.py`: tum router baglantilari
- `backend-service/app/api/v1/endpoints/`: endpoint katmani
- `backend-service/app/services/`: is kurali ve orchestration
- `backend-service/app/schemas/`: request/response modelleri
- `backend-service/app/core/`: config ve exception altyapisi
- `backend-service/tests/`: backend testleri

2. Frontend:
- `frontend-app/src/pages/HomePage.jsx`: ana ekran ve step akisi
- `frontend-app/src/features/`: step bazli UI modulleri
- `frontend-app/src/services/pipelineApi.js`: API cagrilari
- `frontend-app/src/store/pipelineStore.js`: ilk state ve step sabitleri

## 5. Gereksinimler

1. Python `3.11+` (projede `3.13` ile test edildi)
2. Node `20+` (projede `24.x` ile test edildi)
3. npm `10+`

## 6. Docker'siz Calistirma

1. Backend kurulum:

```bash
cd /Users/mertbursalioglu/workspace/imp_math_back/backend-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Backend calistirma (5001):

```bash
cd /Users/mertbursalioglu/workspace/imp_math_back/backend-service
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 5001
```

3. Frontend kurulum:

```bash
cd /Users/mertbursalioglu/workspace/imp_math_back/frontend-app
npm install
```

4. Frontend calistirma:

```bash
cd /Users/mertbursalioglu/workspace/imp_math_back/frontend-app
npm run dev -- --host 0.0.0.0 --port 5173
```

## 7. URL'ler

1. Backend health:
- `http://localhost:5001/healthz`

2. Swagger:
- `http://localhost:5001/docs`

3. OpenAPI JSON:
- `http://localhost:5001/openapi.json`

4. Frontend:
- `http://localhost:5173`

## 8. API Ozeti (Yeni Session-First Yapi)

### 8.1 Session

1. `POST /api/v1/sessions`
2. `GET /api/v1/sessions`
3. `GET /api/v1/sessions/{session_id}`
4. `PATCH /api/v1/sessions/{session_id}`
5. `DELETE /api/v1/sessions/{session_id}`

### 8.2 Dataset

1. `POST /api/v1/sessions/{session_id}/dataset`
2. `GET /api/v1/sessions/{session_id}/dataset`
3. `PATCH /api/v1/sessions/{session_id}/dataset`
4. `DELETE /api/v1/sessions/{session_id}/dataset`

### 8.3 Mapping

1. `PUT /api/v1/sessions/{session_id}/mapping`
2. `GET /api/v1/sessions/{session_id}/mapping`
3. `POST /api/v1/sessions/{session_id}/mapping/validate`
4. `DELETE /api/v1/sessions/{session_id}/mapping`

### 8.4 Preprocessing

1. `PUT /api/v1/sessions/{session_id}/preprocessing`
2. `POST /api/v1/sessions/{session_id}/preprocessing/run`
3. `GET /api/v1/sessions/{session_id}/preprocessing/result`
4. `DELETE /api/v1/sessions/{session_id}/preprocessing/result`

### 8.5 Training

1. `PUT /api/v1/sessions/{session_id}/training/config`
2. `POST /api/v1/sessions/{session_id}/training/run`
3. `GET /api/v1/sessions/{session_id}/training/runs`
4. `GET /api/v1/sessions/{session_id}/training/runs/{run_id}`
5. `DELETE /api/v1/sessions/{session_id}/training/runs/{run_id}`

### 8.6 Analysis

1. `GET /api/v1/sessions/{session_id}/evaluation/{run_id}`
2. `GET /api/v1/sessions/{session_id}/explainability/{run_id}/global`
3. `POST /api/v1/sessions/{session_id}/explainability/{run_id}/local`
4. `GET /api/v1/sessions/{session_id}/fairness/{run_id}`

### 8.7 Certificate

1. `POST /api/v1/sessions/{session_id}/certificate`
2. `GET /api/v1/sessions/{session_id}/certificate`
3. `DELETE /api/v1/sessions/{session_id}/certificate`

## 9. Legacy Endpointler (Geriye Donuk)

Asagidaki endpointler korunmustur:

1. `POST /api/v1/context`
2. `POST /api/v1/data/explore`
3. `POST /api/v1/preprocess`
4. `POST /api/v1/train`
5. `POST /api/v1/evaluation`
6. `POST /api/v1/explainability`
7. `POST /api/v1/fairness`
8. `POST /api/v1/certificate`
9. `GET /api/v1/model/catalog`
10. `GET /api/v1/insights/session/{session_id}`

## 10. Hizli E2E Ornek Akis

```bash
# 1) Session olustur
curl -X POST http://localhost:5001/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"domain":"Cardiology","use_case":"Demo"}'

# 2) Dataset set et
curl -X POST http://localhost:5001/api/v1/sessions/<SESSION_ID>/dataset \
  -H "Content-Type: application/json" \
  -d '{"source":"upload","target_column":"DEATH_EVENT","file_name":"demo.csv","row_count":400,"column_count":14}'

# 3) Mapping + validate
curl -X PUT http://localhost:5001/api/v1/sessions/<SESSION_ID>/mapping \
  -H "Content-Type: application/json" \
  -d '{"problem_type":"binary_classification","target_column":"DEATH_EVENT","roles":{"patient_id":"ignore"}}'

curl -X POST http://localhost:5001/api/v1/sessions/<SESSION_ID>/mapping/validate

# 4) Preprocessing
curl -X PUT http://localhost:5001/api/v1/sessions/<SESSION_ID>/preprocessing \
  -H "Content-Type: application/json" \
  -d '{"train_split":80,"missing_strategy":"median","normalization":"zscore","imbalance_strategy":"smote"}'

curl -X POST http://localhost:5001/api/v1/sessions/<SESSION_ID>/preprocessing/run

# 5) Training
curl -X PUT http://localhost:5001/api/v1/sessions/<SESSION_ID>/training/config \
  -H "Content-Type: application/json" \
  -d '{"algorithm":"knn","parameters":{"k":5}}'

curl -X POST http://localhost:5001/api/v1/sessions/<SESSION_ID>/training/run
```

## 11. Test ve Build

1. Backend test:

```bash
cd /Users/mertbursalioglu/workspace/imp_math_back
PYTHONPATH=/Users/mertbursalioglu/workspace/imp_math_back/backend-service \
/Users/mertbursalioglu/workspace/imp_math_back/backend-service/.venv/bin/pytest -q backend-service/tests
```

2. Frontend build:

```bash
cd /Users/mertbursalioglu/workspace/imp_math_back/frontend-app
npm run build
```

## 12. Notlar

1. Bu repo su anda "structure-first" bir implementasyondur.
2. ML hesaplamalari demonstratif/mock degerler doner.
3. Uretim icin kalici depolama, auth, audit trail, ve gercek model pipeline entegrasyonu gerekir.
