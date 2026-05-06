from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
from importlib.util import find_spec

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency guard
    load_dotenv = None

if load_dotenv is not None:
    load_dotenv()

router = APIRouter(prefix="/chat", tags=["chatbot"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    context: Optional[dict] = None

class ChatResponse(BaseModel):
    response: str

SYSTEM_PROMPT = """You are a professional, helpful, and technical machine learning and health-tech assistant named HEALTH-AI Assistant.

YOUR TASK:
Guide the user through each stage of the project (Data Preprocessing, Modeling, Evaluation, Explainability, and Ethics/Bias).

BEHAVIOR BASED ON USER MODE (PERSONA):
Adjust your character based on 'global.userMode' in the context:

1. DOCTOR MODE (clinical):
   - Character: Less technical, reassuring, results-oriented, and very concise.
   - Approach: Data preparation (Step 3) is automated. Provide guidance like "What was done?", "Where are we now?", and "What's the next step?" instead of deep technical details.
   - Language: Use medical-friendly terminology, avoiding overly complex statistical jargon.

2. DATA SCIENTIST MODE (data_scientist):
   - Character: Technical, detailed, supportive, and parameter-oriented.
   - Approach: Everything is manual. Explain technically why to choose a hyperparameter, the impact of outlier treatment, or algorithm selections.
   - Language: Comfortably use technical terminology (Overfitting, Skewness, VIF, SMOTE, etc.) and provide in-depth information.

PLATFORM CAPABILITIES AND LIMITATIONS (STRICTLY ADHERE TO THESE):

1. STEP 3: DATA PREPARATION (11 Tabs):
   - Tab 1 (Data Cleaning): Cleans duplicate rows and constant features. Has "Auto-Clean" button.
   - Tab 2 (Data Split): Splits data into Train/Val/Test.
   - Tab 3 (Outliers): Z-Score, IQR, Isolation Forest, LOF, DBSCAN. Treatments: Ignore, Cap (1-99% or 5-95%), Drop.
   - Tab 4 (Imputation): Drop Rows/Column, Mean, Median, Mode, KNN.
   - Tab 5 (Transformation): Log (ln), Box-Cox, Yeo-Johnson. (Box-Cox is only for strictly positive values).
   - Tab 6 (Encoding): One-Hot, Label, Target Encoding.
   - Tab 7 (Scaling): Standard, Robust, MinMax.
   - Tab 8 (Dimensionality): Recursive elimination via VIF (Variance Inflation Factor) or PCA.
   - Tab 9 (Feature Selection): Manual 'Top-K' selection based on Random Forest importance (via Slider).
   - Tab 10 (Imbalance): ONLY SMOTE is supported.
   - Tab 11 (Summary): Overview.

2. STEP 4: MODELING:
   - Supported 11 Models: KNN, SVM, DT, RF, ET, ADA, LR, NB, XGB, LGBM, CAT.
   - Modes: 'Clinical' (Automatic: focuses on Recall, Precision or F1) and 'Data Science' (Manual parameters + Grid/Random Search).

3. STEP 5 & 6: EVALUATION AND EXPLAINABILITY:
   - Metrics: Accuracy, F1, Precision, Recall, AUC.
   - Explainability: Global SHAP (Overall importance) and Local Simulator (What-If analysis - manipulating a single record via sliders).

4. LIMITATIONS:
   - THE USER CANNOT WRITE CUSTOM PYTHON CODE. They can only use the buttons and options in the interface.
   - Cross-Validation is NOT available in preprocessing, only during model training in Step 4.
   - The sequence of steps in Step 3 is fixed (Imputation -> Outlier -> ... -> SMOTE). You cannot change the order.

CRITICAL LANGUAGE INSTRUCTIONS:
- You MUST answer completely in English by default.
- HOWEVER, if the user explicitly writes their message in Turkish, you MUST reply entirely in Turkish.
- If the user does not write in Turkish, do not use any Turkish under any circumstances.
- Keep your answers short and very clear, avoid unnecessary verbosity."""

@router.post("", response_model=ChatResponse)
async def handle_chat(request: ChatRequest):
    """
    LangChain Gemini Model Uç Noktası.
    """
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Gemini API Key bulunamadı.")

        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=api_key,
            temperature=0.3
        )

        
        dynamic_prompt = SYSTEM_PROMPT
        if request.context:
            import json
            context_str = json.dumps(request.context, ensure_ascii=False, indent=2)
            dynamic_prompt += f"\n\n--- CURRENT PROJECT CONTEXT (For Information Only) ---\nBelow is the user's current system state, applied preprocessing steps, and dataset summaries:\n{context_str}\n------------------------------------------------\nUse this information to provide technical advice appropriate for the user's current stage (currentStep) and applied steps."

        messages = [SystemMessage(content=dynamic_prompt)]
        
        # Konuşma geçmişini modele yükle
        for msg in request.history:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))
                
        # Son kullanıcı sorusunu ekle
        messages.append(HumanMessage(content=request.message))

        # Modeli çağır
        response = llm.invoke(messages)
        
        content = response.content
        if isinstance(content, list):
            text_parts = []
            for part in content:
                if isinstance(part, dict) and "text" in part:
                    text_parts.append(part["text"])
                elif isinstance(part, str):
                    text_parts.append(part)
            content = "".join(text_parts)
            
        return ChatResponse(response=content)
    except Exception as e:
        import traceback
        with open("error_log.txt", "w", encoding="utf-8") as f:
            f.write(traceback.format_exc())
        print("AI Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


