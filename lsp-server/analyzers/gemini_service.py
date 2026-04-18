import os
import logging
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

# Load variables from an .env file relative to this script
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path)

import google.generativeai as genai
from supabase import create_client, Client

logger = logging.getLogger(__name__)

# Constants
GEMINI_MODEL = 'models/text-embedding-004'
REFACTORING_MODEL = 'gemini-1.5-flash'
SIMILARITY_THRESHOLD = 0.90

class GeminiService:
    def __init__(self):
        self.ai_client_initialized = False
        self.supabase_client: Optional[Client] = None
        
        # Initialize Gemini
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.ai_client_initialized = True
        else:
            logger.warning("GEMINI_API_KEY not found in environment.")

        # Initialize Supabase
        supabase_url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("VITE_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY")
        if supabase_url and supabase_key:
            self.supabase_client = create_client(supabase_url, supabase_key)
        else:
            logger.warning("Supabase credentials not found in environment.")
            
    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate a 768-d embedding for the given text."""
        if not self.ai_client_initialized:
            return None
        try:
            result = genai.embed_content(
                model=GEMINI_MODEL,
                content=text,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return None
            
    def find_duplicates(self, embedding: List[float]) -> List[Dict[str, Any]]:
        """Query supabase for similar functions."""
        if not self.supabase_client:
            return []
        try:
            # We call the RPC method we defined in pgvector-schema.sql
            response = self.supabase_client.rpc(
                'match_function_embeddings',
                {'query_embedding': embedding, 'match_threshold': SIMILARITY_THRESHOLD, 'match_count': 5}
            ).execute()
            return response.data
        except Exception as e:
            logger.error(f"Error querying duplicates: {e}")
            return []

    def upsert_function_embedding(self, file_path: str, function_name: str, content: str, embedding: List[float]):
        """Upsert a function embedding into Supabase."""
        if not self.supabase_client:
            return
        try:
            self.supabase_client.table('function_embeddings').upsert({
                'file_path': file_path,
                'function_name': function_name,
                'content': content,
                'embedding': embedding
            }, on_conflict='file_path,function_name').execute()
        except Exception as e:
            logger.error(f"Error upserting embedding: {e}")

    def generate_refactoring_suggestion(self, function_a_content: str, function_b_content: str) -> str:
        """Query Gemini to suggest a refactoring strategy for two duplicate functions."""
        if not self.ai_client_initialized:
            return "Refactor: Extract into a shared utility function."
            
        prompt = f"""
We found two structurally identical or highly similar functions in a Python codebase.
Function A:
```python
{function_a_content}
```

Function B:
```python
{function_b_content}
```

Provide a concise, 1-2 sentence recommendation for how the user should refactor these cloned logics into a single shared utility or class method.
DO NOT provide the full refactored code. Just the architectural suggestion.
        """
        try:
            model = genai.GenerativeModel(REFACTORING_MODEL)
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Error generating refactoring suggestion: {e}")
            return "Refactor: Extract common logic into a shared utility method to prevent duplication."
