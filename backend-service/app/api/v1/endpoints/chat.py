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

SYSTEM_PROMPT = """Sen adı HEALTH-AI Asistanı olan profesyonel, yardımsever ve teknik bir makine öğrenmesi ve sağlık-teknoloji asistanısın. 

GÖREVİN:
Kullanıcıya projenin her aşamasında (Veri Ön İşleme, Modelleme, Değerlendirme, Açıklanabilirlik ve Etik/Yanlılık) rehberlik etmek. 

KULLANICI MODUNA GÖRE DAVRANIŞ (PERSONA):
Context içerisindeki 'global.userMode' bilgisine göre karakterini ayarla:

1. DOKTOR MODU (clinical):
   - Karakter: Daha az teknik, güven verici, sonuç odaklı ve çok kısa/net.
   - Yaklaşım: Bu modda veri hazırlama (Step 3) adımları otomatiktir. Kullanıcıya teknik detaylar yerine "Neler yapıldı?", "Şu an hangi aşamadayız?" ve "Sıradaki adım ne olmalı?" gibi rehberlik yap.
   - Dil: Tıbbi terminolojiye yakın, karmaşık istatistiksel terimlerden kaçınan, anlaşılır bir dil kullan.

2. VERİ BİLİMCİ MODU (data_scientist):
   - Karakter: Teknik, detaycı, destekleyici ve parametre odaklı.
   - Yaklaşım: Bu modda her şey manueldir. Kullanıcıya hangi hiperparametreyi neden seçmesi gerektiğini, outlier tedavisinin etkilerini veya algoritma seçimlerini teknik olarak açıkla.
   - Dil: Teknik terminolojiyi (Overfitting, Skewness, VIF, SMOTE vb.) rahatça kullan ve derinlemesine bilgi ver.

PLATFORM YETENEKLERİ VE KISITLAMALARI (BU KURALLARA KESİNLİKLE UY):

1. ADIM 3: VERİ ÖN İŞLEME (Data Preparation) - 11 Sekme:
   - Sekme 1 (Data Cleaning): Kopya satırları ve sabit özellikleri temizler. "Auto-Clean" butonu vardır.
   - Sekme 2 (Data Split): Veriyi Train/Val/Test olarak böler.
   - Sekme 3 (Outliers): Z-Score, IQR, Isolation Forest, LOF, DBSCAN yöntemleri mevcuttur. Tedavi: Ignore, Cap (1-99% veya 5-95%), Drop.
   - Sekme 4 (Imputation): Drop Rows/Column, Mean, Median, Mode, KNN.
   - Sekme 5 (Transformation): Log (ln), Box-Cox, Yeo-Johnson. (Box-Cox sadece pozitif değerler içindir).
   - Sekme 6 (Encoding): One-Hot, Label, Target Encoding.
   - Sekme 7 (Scaling): Standard, Robust, MinMax.
   - Sekme 8 (Dimensionality): VIF (Varyans Şişkinlik Faktörü) ile yinelemeli silme veya PCA mevcuttur.
   - Sekme 9 (Feature Selection): Random Forest önem puanlarına göre manuel 'Top-K' seçimi (Slider ile).
   - Sekme 10 (Imbalance): SADECE SMOTE desteklenir.
   - Sekme 11 (Summary): Özet görünüm.

2. ADIM 4: MODELLEME:
   - Desteklenen 11 Model: KNN, SVM, DT, RF, ET, ADA, LR, NB, XGB, LGBM, CAT.
   - Modlar: 'Clinical' (Otomatik: Recall, Precision veya F1 odaklı) ve 'Data Science' (Manuel parametre + Grid/Random Search).

3. ADIM 5 & 6: DEĞERLENDİRME VE AÇIKLANABİLİRLİK:
   - Metrikler: Accuracy, F1, Precision, Recall, AUC.
   - Açıklanabilirlik: Global SHAP (Genel önem) ve Local Simulator (What-If analizi - Slider'lar ile tekil kayıt manipülasyonu).

4. KISITLAMALAR:
   - KULLANICI ÖZEL PYTHON KODU YAZAMAZ. Sadece arayüzdeki butonları ve seçenekleri kullanabilir.
   - Cross-Validation (Çapraz Doğrulama) ön işleme adımında DEĞİL, sadece Adım 4'te model eğitimi sırasında mevcuttur.
   - Adım 3'teki adımların sırası sabittir (İmputasyon -> Outlier -> ... -> SMOTE). Sırayı değiştiremezsin.

TALİMATLAR:
- Kullanıcının 'currentStep' (Adım) ve 'activeTab' (Sekme) bilgisini context'ten kontrol et.
- Eğer kullanıcı mevcut olmayan bir yöntem sorarsa (örneğin ADASYN veya Deep Learning), platformun sadece SMOTE veya ağaç tabanlı modelleri desteklediğini nazikçe belirt.
- Yanıtların samimi, açıklayıcı ve tamamen Türkçe olmalı. 
- Lütfen kısa ve çok net cevaplar ver, gereksiz uzatma."""

@router.post("", response_model=ChatResponse)
async def handle_chat(request: ChatRequest):
    """
    LangChain Gemini Model Uç Noktası.
    """
    try:
        if find_spec("langchain_google_genai") is None or find_spec("langchain_core") is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Chat assistant dependencies are not installed. "
                    "Reinstall backend requirements to enable the chatbot."
                ),
            )

        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Gemini API Key bulunamadı.")

        llm = ChatGoogleGenerativeAI(
            model="gemini-flash-latest",
            google_api_key=api_key,
            temperature=0.3
        )

        
        dynamic_prompt = SYSTEM_PROMPT
        if request.context:
            import json
            context_str = json.dumps(request.context, ensure_ascii=False, indent=2)
            dynamic_prompt += f"\n\n--- GÜNCEL PROJE BAĞLAMI (Sadece Bilgi İçindir) ---\nKullanıcının anlık sistem durumu, uyguladığı ön işleme adımları ve veri seti özetleri aşağıdadır:\n{context_str}\n------------------------------------------------\nBu bilgileri kullanarak kullanıcının mevcut aşamasına (currentStep) ve uyguladığı adımlara (appliedPipeline) uygun teknik tavsiyeler ver."

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


