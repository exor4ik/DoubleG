from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
import re
from urllib.parse import urlparse
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="EgorNetwork Search Indexer")

# CORS для GitHub Pages
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://твой-ник.github.io", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase клиент
SUPABASE_URL = "https://qnlxseqghjkruytnoken.supabase.co"
SUPABASE_KEY = "sb_publishable_i-u9JVsVApur0I_6LK0ujg_73N0zHqs"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class IndexRequest(BaseModel):
    url: str
    title: str = None
    content: str = None

class IndexResponse(BaseModel):
    success: bool
    message: str
    document_id: int = None

def extract_text_from_html(html: str) -> str:
    """Извлекает чистый текст из HTML"""
    soup = BeautifulSoup(html, 'html.parser')
    
    # Удаляем скрипты, стили, навигацию
    for script in soup(["script", "style", "nav", "header", "footer", "aside"]):
        script.decompose()
    
    # Получаем текст
    text = soup.get_text(separator=' ', strip=True)
    
    # Убираем лишние пробелы
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()

def extract_title_from_html(html: str, soup: BeautifulSoup) -> str:
    """Извлекает заголовок страницы"""
    # Пробуем <title>
    if soup.title and soup.title.string:
        return soup.title.string.strip()
    
    # Пробуем <h1>
    h1 = soup.find('h1')
    if h1:
        return h1.get_text(strip=True)
    
    return "Без названия"

@app.get("/")
async def root():
    return {
        "service": "EgorNetwork Search Indexer",
        "version": "1.0.0",
        "status": "running"
    }

@app.post("/index", response_model=IndexResponse)
async def index_url(request: IndexRequest):
    """Индексирует один URL"""
    url = request.url.strip()
    
    # Валидация URL
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Некорректный URL")
    
    logger.info(f"Индексация: {url}")
    
    try:
        # Если контент уже предоставлен (ручная индексация)
        if request.content:
            title = request.title or "Без названия"
            content = request.content
        else:
            # Скачиваем страницу
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            # Парсим HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Извлекаем заголовок и контент
            title = request.title or extract_title_from_html(response.text, soup)
            content = extract_text_from_html(response.text)
        
        # Проверяем, не проиндексирован ли уже этот URL
        existing = supabase.table('documents').select('id').eq('url', url).execute()
        
        if existing.data:
            # Обновляем существующую запись
            doc_id = existing.data[0]['id']
            supabase.table('documents').update({
                'title': title,
                'content': content
            }).eq('id', doc_id).execute()
            
            logger.info(f"Обновлен документ ID {doc_id}: {url}")
            return IndexResponse(
                success=True,
                message="Документ обновлен",
                document_id=doc_id
            )
        else:
            # Создаем новую запись
            result = supabase.table('documents').insert({
                'url': url,
                'title': title,
                'content': content
            }).execute()
            
            doc_id = result.data[0]['id']
            logger.info(f"Создан документ ID {doc_id}: {url}")
            
            return IndexResponse(
                success=True,
                message="Документ проиндексирован",
                document_id=doc_id
            )
    
    except requests.exceptions.Timeout:
        logger.error(f"Таймаут при индексации: {url}")
        raise HTTPException(status_code=504, detail="Таймаут при загрузке страницы")
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Ошибка загрузки: {url} - {str(e)}")
        raise HTTPException(status_code=400, detail=f"Ошибка загрузки страницы: {str(e)}")
    
    except Exception as e:
        logger.error(f"Ошибка индексации: {url} - {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка индексации: {str(e)}")

@app.post("/index-batch")
async def index_batch(urls: list[str]):
    """Индексирует несколько URL за раз"""
    results = []
    for url in urls:
        try:
            result = await index_url(IndexRequest(url=url))
            results.append({"url": url, "success": True, "id": result.document_id})
        except HTTPException as e:
            results.append({"url": url, "success": False, "error": e.detail})
    
    return {"indexed": len([r for r in results if r["success"]]), "results": results}

@app.get("/stats")
async def get_stats():
    """Статистика индексации"""
    count = supabase.table('documents').select('*', count='exact').execute()
    return {
        "total_documents": count.count,
        "status": "ok"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
