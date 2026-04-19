from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

load_dotenv()

router = APIRouter(prefix="/chat", tags=["chatbot"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

class ChatResponse(BaseModel):
    response: str

SYSTEM_PROMPT = """Sen adı HEALTH-AI Asistanı olan profesyonel, yardımsever ve teknik bir makine öğrenmesi ve sağlık-teknoloji asistanısın. 
Kullanıcıya yapay zeka modelleri, model doğruluk metrikleri (SMOTE, AUC-ROC vb.) ve sağlık veri analitiği hakkında yardımcı olmakla görevlisin.
Yanıtların samimi, açıklayıcı ve tamamen Türkçe olmalı. Hasta/Gerçek tıbbi karar vermemelisin, teşhis koymamalısın; sadece tıp ve yapay zeka kesişimi ile bu projenin teknolojisi hakkında rehberlik yapmalısın.
Kritik terimleri yorumlarken markdown formatında **kalın** yazarak vurgulayabilirsin. Lütfen kısa ve çok net cevaplar ver, destan yazma."""

@router.post("", response_model=ChatResponse)
async def handle_chat(request: ChatRequest):
    """
    LangChain Gemini Model Uç Noktası.
    """
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Gemini API Key bulunamadı.")

        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=api_key,
            temperature=0.3
        )

        messages = [SystemMessage(content=SYSTEM_PROMPT)]
        
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
        
        return ChatResponse(response=response.content)
    except Exception as e:
        import traceback
        with open("error_log.txt", "w", encoding="utf-8") as f:
            f.write(traceback.format_exc())
        print("AI Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


