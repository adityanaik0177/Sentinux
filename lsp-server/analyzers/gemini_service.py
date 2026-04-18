import os
import json
import time
import logging
import concurrent.futures
from typing import Optional, List, Dict, Any, Tuple
from dotenv import load_dotenv

# Load variables from an .env file relative to this script
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path)

import google.generativeai as genai
from supabase import create_client, Client

logger = logging.getLogger(__name__)

# Constants  — verified against genai.list_models() for this API key
GEMINI_EMBED_MODEL   = 'models/gemini-embedding-001'    # supports embedContent
REFACTORING_MODEL    = 'models/gemini-2.0-flash-lite'   # higher free-tier quota
GEMINI_MODEL         = GEMINI_EMBED_MODEL                # backward-compat alias
SIMILARITY_THRESHOLD = 0.90
MAX_WORKERS          = 4     # parallel Supabase queries
MAX_RETRIES          = 3     # retry on 429 rate-limit


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

    # ── Retry helper ───────────────────────────────────────────────────────

    def _call_gemini(self, prompt: str) -> Optional[str]:
        """
        Call Gemini with automatic exponential-backoff retry on 429 quota errors.
        Returns the text response or None if all retries fail.
        """
        model = genai.GenerativeModel(REFACTORING_MODEL)
        for attempt in range(MAX_RETRIES):
            try:
                cfg = genai.GenerationConfig(response_mime_type="application/json")
                response = model.generate_content(prompt, generation_config=cfg)
                return response.text
            except Exception as e:
                err = str(e)
                if '429' in err and attempt < MAX_RETRIES - 1:
                    wait = 2 ** attempt * 5   # 5s, 10s, 20s
                    logger.warning(f"Rate limited. Retrying in {wait}s... (attempt {attempt+1})")
                    time.sleep(wait)
                else:
                    logger.error(f"Gemini call failed: {e}")
                    return None
        return None

    # ── Smart static fallback (no API needed) ─────────────────────────────

    @staticmethod
    def _smart_dead_code_fallback(func_name: str) -> str:
        """Generate a useful suggestion without calling the AI."""
        name = func_name.lower()
        if any(w in name for w in ['test', 'debug', 'temp', 'tmp', 'old']):
            return f"Safe to delete: `{func_name}` appears to be test/debug code with no active callers."
        if any(w in name for w in ['util', 'helper', 'tool', 'common', 'shared']):
            return f"Review before deleting: `{func_name}` looks like utility code — check if it was intended for future use."
        if any(w in name for w in ['init', 'setup', 'migrate', 'seed']):
            return f"Caution: `{func_name}` may be infrastructure setup code. Verify it is truly unused before removing."
        if any(w in name for w in ['handler', 'callback', 'dispatch', 'on_']):
            return f"Likely dead handler: `{func_name}` is never registered anywhere. Safe to remove if no dynamic dispatch calls it."
        if name.startswith('_'):
            return f"Private symbol `{func_name}` is not called from any file. Safe to delete."
        return f"Dead export: `{func_name}` is defined and exported but never imported. Delete if no external consumers exist."

    # ── Single embedding (kept for back-compat) ────────────────────────────

    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate a 768-d embedding for a single text."""
        results = self.generate_batch_embeddings([text])
        return results[0] if results else None

    # ── BATCH embeddings — ONE API call for all functions in a file ────────

    def generate_batch_embeddings(self, texts: List[str]) -> List[Optional[List[float]]]:
        """
        Generate embeddings for multiple texts in a SINGLE Gemini API call.
        Returns a list aligned with `texts`; entries are None on failure.
        """
        if not self.ai_client_initialized or not texts:
            return [None] * len(texts)
        try:
            result = genai.embed_content(
                model=GEMINI_EMBED_MODEL,
                content=texts,                  # list accepted → batch call
                task_type="retrieval_document",
            )
            embeddings = result.get('embedding', [])
            # API wraps single text differently — normalise
            if embeddings and not isinstance(embeddings[0], list):
                embeddings = [embeddings]
            # Pad to same length as input
            while len(embeddings) < len(texts):
                embeddings.append(None)
            return embeddings
        except Exception as e:
            logger.error(f"Batch embedding error: {e}")
            return [None] * len(texts)

    # ── Parallel duplicate queries ─────────────────────────────────────────

    def find_duplicates(self, embedding: List[float]) -> List[Dict[str, Any]]:
        """Query Supabase for a single embedding (kept for back-compat)."""
        if not self.supabase_client:
            return []
        try:
            response = self.supabase_client.rpc(
                'match_function_embeddings',
                {'query_embedding': embedding,
                 'match_threshold': SIMILARITY_THRESHOLD,
                 'match_count': 5}
            ).execute()
            return response.data
        except Exception as e:
            logger.error(f"Error querying duplicates: {e}")
            return []

    def find_duplicates_batch(
        self,
        items: List[Tuple[str, str, List[float]]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Run duplicate queries for multiple (file_path, func_name, embedding)
        tuples IN PARALLEL using a thread pool so Supabase round-trips overlap.
        Returns {f"{file_path}::{func_name}": [duplicate, ...]}
        """
        if not self.supabase_client or not items:
            return {}

        def _query(item):
            file_path, func_name, emb = item
            key = f"{file_path}::{func_name}"
            dupes = self.find_duplicates(emb)
            # Filter self-matches
            real_dupes = [
                d for d in dupes
                if not (d.get('file_path') == file_path and d.get('function_name') == func_name)
            ]
            return key, real_dupes

        results: Dict[str, List] = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = {pool.submit(_query, item): item for item in items}
            for future in concurrent.futures.as_completed(futures):
                try:
                    key, dupes = future.result()
                    results[key] = dupes
                except Exception as e:
                    logger.error(f"Parallel duplicate query error: {e}")
        return results

    # ── Upsert ─────────────────────────────────────────────────────────────

    def upsert_function_embedding(
        self, file_path: str, function_name: str, content: str, embedding: List[float]
    ):
        """Upsert a function embedding into Supabase."""
        if not self.supabase_client:
            return
        try:
            self.supabase_client.table('function_embeddings').upsert({
                'file_path': file_path,
                'function_name': function_name,
                'content': content,
                'embedding': embedding,
            }, on_conflict='file_path,function_name').execute()
        except Exception as e:
            logger.error(f"Error upserting embedding: {e}")

    # ── BULK Refactoring — ONE Gemini call for all duplicates ──────────────

    def generate_bulk_refactoring_suggestions(
        self,
        pairs: Dict[str, Tuple[str, str]]
    ) -> Dict[str, str]:
        """
        Generate refactoring suggestions for MULTIPLE duplicate pairs in one
        API call.
        pairs: { unique_key -> (code_a_snippet, code_b_snippet) }
        Returns { unique_key -> suggestion_string }
        """
        if not self.ai_client_initialized or not pairs:
            return {}

        prompt = (
            "You are an expert Python architect. "
            "I am giving you multiple pairs of structurally duplicate functions. "
            "For each pair, provide a VERY concise 1-2 sentence architectural suggestion "
            "on how to refactor them into a shared utility. DO NOT write code. "
            "Return ONLY a valid JSON object mapping the exact keys given to your suggestion.\n\n"
        )
        for key, (code_a, code_b) in pairs.items():
            a_snippet = code_a[:250] + ("..." if len(code_a) > 250 else "")
            b_snippet = code_b[:250] + ("..." if len(code_b) > 250 else "")
            prompt += f'Key: "{key}"\nFunction A:\n{a_snippet}\nFunction B:\n{b_snippet}\n\n'

        try:
            raw = self._call_gemini(prompt)
            if raw:
                return json.loads(raw)
            # Fallback: give generic refactoring advice per pair
            return {
                k: "Refactor: Extract the shared logic into a dedicated utility function and call it from both locations."
                for k in pairs
            }
        except Exception as e:
            logger.error(f"Bulk refactoring suggestion error: {e}")
            return {
                k: "Refactor: Extract the shared logic into a dedicated utility function."
                for k in pairs
            }

    # ── BULK Dead Code — ONE Gemini call for all dead symbols ─────────────

    def generate_bulk_dead_code_suggestions(
        self,
        functions_dict: Dict[str, Dict[str, str]]
    ) -> Dict[str, str]:
        """
        Query Gemini for multiple dead functions simultaneously.
        functions_dict: { cache_key -> {"name": func_name, "code": snippet} }
        Returns: { cache_key -> suggestion }
        """
        if not self.ai_client_initialized or not functions_dict:
            return {}

        prompt = (
            "You are an expert Python architect. "
            "I am giving you a list of mathematically verified 'Dead Code' functions. "
            "Analyze each and provide a VERY concise recommendation (1-2 sentences). "
            "Return ONLY a valid JSON object mapping the exact keys to your suggestion.\n\n"
        )
        for ckey, info in functions_dict.items():
            snippet = info["code"][:300] + ("..." if len(info["code"]) > 300 else "")
            prompt += f'Key: "{ckey}"\nFunction: {info["name"]}\nCode:\n{snippet}\n\n'

        try:
            raw = self._call_gemini(prompt)
            if raw:
                return json.loads(raw)
            # Fallback: use smart static suggestions per function name
            return {
                ckey: self._smart_dead_code_fallback(info["name"])
                for ckey, info in functions_dict.items()
            }
        except Exception as e:
            logger.error(f"Bulk dead code suggestion error: {e}")
            return {
                ckey: self._smart_dead_code_fallback(info["name"])
                for ckey, info in functions_dict.items()
            }

    # ── Legacy single-call helpers (used as fallback) ──────────────────────

    def generate_refactoring_suggestion(self, function_a_content: str, function_b_content: str) -> str:
        """Single-pair refactoring suggestion (falls back to bulk API)."""
        result = self.generate_bulk_refactoring_suggestions(
            {"_single": (function_a_content, function_b_content)}
        )
        return result.get("_single", "Refactor: Extract common logic into a shared utility method.")

    def generate_dead_code_suggestion(self, func_name: str, code_body: str) -> str:
        """Single dead-code suggestion (falls back to bulk API)."""
        result = self.generate_bulk_dead_code_suggestions(
            {"_single": {"name": func_name, "code": code_body}}
        )
        return result.get(
            "_single",
            "Refactor: This symbol is never imported. Consider removing this dead code.",
        )
