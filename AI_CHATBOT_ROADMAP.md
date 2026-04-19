# HEALTH-AI Chatbot Entegrasyon Yol Haritası

Şu anda projenizde (`HelpChatbotDrawer.tsx` içinde) statik bir sözlük (GLOSSARY_TERMS) ile çalışan basit bir "Ask AI" taslağı bulunuyor. Bunu gerçek bir Yapay Zeka (AI) sohbet asistanına dönüştürmek için aşağıdaki adımları sırasıyla uygulamanız gerekmektedir. 

## 📌 Aşama 1: Teknoloji Seçimi ve Planlama (API Modeli Belirleme)
Gerçek bir yapay zeka entegrasyonu için öncelikle hangi Dil Modelini (LLM) kullanacağınıza karar vermelisiniz.

*   **API Sağlayıcıları:** 
    *   **OpenAI (GPT-3.5/GPT-4):** En yaygın, API entegrasyonu ve dokümantasyonu en bol olanıdır.
    *   **Google Gemini:** Langchain ile kolayca entegre edilebilir ve kullanımı genelde caziptir.
    *   **Local (Ollama vb.):** Veri gizliliği kritikse, lokal sunucunuzda kendi modelinizi çalıştırabilirsiniz ama daha meşakkatlidir.
*   **Orkestrasyon Aracı (LangChain):** Modelleri doğrudan API ile çağırmak yerine, **LangChain** (Python) platformunu kullanmak işinizi çok kolaylaştırır. Prompt zincirleri kurmak, hafıza (memory) eklemek ve kendi dokümanlarınızla RAG yapmak için harikadır.

## 📌 Aşama 2: Backend (FastAPI) Entegrasyonu
Yapay zeka anahtarlarınızı (API Key) asla frontend'de (React) tutmamalısınız. Tüm AI haberleşme mantığı backend üzerinden yürümelidir.

1.  **Gerekli Kütüphanelerin Kurulumu:**
    *   Backend dizininde `requirements.txt` dosyasına paketleri ekleyin: `langchain`, `langchain-openai`, `langchain-google-genai`, `python-dotenv`.
2.  **API Key Yönetimi:**
    *   Backend projesinde `.env` dosyası oluşturun ve anahtarı ekleyin (örneğin: `OPENAI_API_KEY=sk-...` ve `GEMINI_API_KEY=...`).
3.  **Chatbot Route'u Oluşturma:**
    *   FastAPI projesinde (`routes/` klasörü ya da `main.py` içinde) yeni bir uç nokta oluşturun: `POST /api/chat`. 
4.  **Prompt Engineering (Sistem Komutu):**
    *   AI'a nasıl davranması gerektiğini belirten bir "System Prompt" eklemelisiniz. 

## 📌 Aşama 3: Frontend (React) İletişimi
Mevcut `HelpChatbotDrawer.tsx` yapısını backend uç noktanızla haberleşecek şekilde güncellemeniz gerekir.

1.  **Frontend Kodunu Temizleme:**
    *   Şu anki `setTimeout` ve statik `GLOSSARY_TERMS` kodlarını silin.
2.  **Mesaj Gönderme İstegi (Fetch):**
    *   `fetch` veya `axios` ile FastAPI'nin `/api/chat` adresine POST gönderin ve yükleniyor pencerisini gösterin.
3.  **Geçmiş (Konuşma Memory) İletimi:**
    *   AI API'sine sadece son soruyu değil, API'ye o ana kadarki sohbet geçmişini de iletin.

---

## 🌟 Aşama 4: Hibrit (OpenAI + Gemini) ve Hızlı Entegrasyon Stratejisi
Yapay zeka ajanı olan Antigravity (benim) yardımımla tüm bu sistemi kodlamak **sadece 30-40 dakika (maksimum 2-3 saat)** sürecektir. Projenize ileride aşağıdaki mimarileri de kolayca entegre edebilirsiniz:

1.  **Hibrit Çalışma (Fallback / Yönlendirme Mimari):**
    *   **Yedekli Yapı:** Soruyu önce OpenAI'a gönderirsiniz, eğer OpenAI kotası aşılır veya çökerse, Langchain üzerinden sistem aynı soruyu otomatik olarak yedekteki Gemini'ye yönlendirir.
    *   **Görev Dağılım Modeli:** Metin okuyup veritabanına kaydetme (Embedding) işlemi için maliyet-etkin OpenAI modellerini, hızlı text yanıtları için Gemini Pro modellerini kombine edebilirsiniz. LangChain framework'ü ile bunları birleştirmek yalnızca birkaç satır koddur.

## 🌟 Aşama 5: Kendi Verilerinizle Eğitme (RAG - Retrieval-Augmented Generation)
Chatbotunuzu sıfırdan "Eğitmek" (Fine-Tuning) zor ve statiktir. Bunun yerine LangChain & ChromaDB ile RAG yapısı kullanılacaktır.
1.  Kendi dokümanlarınızı (pdf, txt veya db tabloları) Vektör Veritabanına (Vector DB) gömme (embedding) işlemi ile kaydedersiniz.
2.  Kullanıcı bir soru sorduğunda ("Bizim veritabanındaki en yaygın hastalık nedir?"), sistem Vector DB'de arama yapar, bulduğu cevabı OpenAI/Gemini'ye "Bu dokümanı baz alarak cevap ver" diye gönderir.

**Özetle:** Kısa sürede sadece bir API anahtarı ile çalışan sistemi kurabilir, daha sonra Hibrit modelini veya RAG doküman sistemlerini proje kodlarına kademeli olarak ekleyebilirsiniz!
