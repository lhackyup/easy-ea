import httpx
from typing import Dict, Any, List, Optional
from config import settings


class EasyEAClient:
    """
    Client asincrono per l'interazione con le API REST di EasyEA.
    Gestisce l'autenticazione tramite X-API-Key e la serializzazione degli errori per LLM.
    """

    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        self.base_url = (base_url or settings.base_url).rstrip("/")
        self.api_key = api_key or settings.api_key
        self.timeout = settings.timeout

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-MCP-Agent": "true"
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    async def _request(self, method: str, path: str, params: Optional[Dict[str, Any]] = None, json: Optional[Dict[str, Any]] = None) -> Any:
        url = f"{self.base_url}/{path.lstrip('/')}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                resp = await client.request(
                    method=method,
                    url=url,
                    params=params,
                    json=json,
                    headers=self._get_headers()
                )
                if resp.status_code == 401:
                    return {
                        "error": "Authentication failed (401 Unauthorized)",
                        "detail": "La richiesta a EasyEA è stata respinta. Verifica che EASYEA_API_KEY sia impostata e valida."
                    }
                if resp.status_code == 403:
                    return {
                        "error": "Permission denied (403 Forbidden)",
                        "detail": "L'API Key utilizzata non dispone dei permessi necessari per questa operazione."
                    }
                if resp.status_code == 404:
                    return {
                        "error": "Resource not found (404 Not Found)",
                        "detail": resp.json().get("detail", "La risorsa richiesta non esiste in EasyEA.")
                    }
                resp.raise_for_status()
                return resp.json()
            except httpx.ConnectError:
                return {
                    "error": "Connection error",
                    "detail": f"Impossibile connettersi al server EasyEA su '{self.base_url}'. Assicurati che l'applicativo sia avviato."
                }
            except httpx.HTTPStatusError as exc:
                return {
                    "error": f"HTTP {exc.response.status_code} Error",
                    "detail": exc.response.text
                }
            except Exception as exc:
                return {
                    "error": "Unexpected client error",
                    "detail": str(exc)
                }

    # ================= Workspace / Models =================
    async def get_models(self) -> Any:
        return await self._request("GET", "/models")

    # ================= Elements =================
    async def search_elements(
        self,
        query: Optional[str] = None,
        model_id: Optional[str] = None,
        layer: Optional[str] = None,
        element_type: Optional[str] = None,
        limit: int = 25
    ) -> Any:
        params: Dict[str, Any] = {"limit": limit}
        if query:
            params["query"] = query
        if model_id:
            params["model_id"] = model_id
        if layer:
            params["layer"] = layer
        if element_type:
            params["type"] = element_type
        return await self._request("GET", "/elements/search", params=params)

    async def get_element(self, element_id: str) -> Any:
        return await self._request("GET", f"/elements/{element_id}")

    # ================= Relationships =================
    async def list_relationships(
        self,
        model_id: Optional[str] = None,
        element_id: Optional[str] = None,
        rel_type: Optional[str] = None
    ) -> Any:
        params: Dict[str, Any] = {}
        if model_id:
            params["model_id"] = model_id
        if element_id:
            params["element_id"] = element_id
        if rel_type:
            params["type"] = rel_type
        return await self._request("GET", "/relationships", params=params)

    # ================= APM =================
    async def get_apm_portfolio(self, model_id: str) -> Any:
        return await self._request("GET", f"/apm/portfolio/{model_id}")

    # ================= Resilience =================
    async def get_resilience_analysis(self, model_id: str) -> Any:
        return await self._request("GET", f"/resilience/analysis/{model_id}")

    # ================= ADRs =================
    async def list_adrs(
        self,
        model_id: str,
        status: Optional[str] = None,
        domain: Optional[str] = None,
        element_id: Optional[str] = None,
        search: Optional[str] = None
    ) -> Any:
        params: Dict[str, Any] = {"model_id": model_id}
        if status:
            params["status"] = status
        if domain:
            params["domain"] = domain
        if element_id:
            params["element_id"] = element_id
        if search:
            params["search"] = search
        return await self._request("GET", "/adrs", params=params)

    async def get_adr(self, adr_id: str) -> Any:
        return await self._request("GET", f"/adrs/{adr_id}")

    async def create_adr(self, model_id: str, payload: Dict[str, Any]) -> Any:
        return await self._request("POST", "/adrs", params={"model_id": model_id}, json=payload)

    # ================= Metamodel =================
    async def get_metamodel_matrix(self) -> Any:
        return await self._request("GET", "/metamodel/relationships-matrix")

    async def get_metamodel_types(self, model_id: Optional[str] = None) -> Any:
        params = {"model_id": model_id} if model_id else None
        return await self._request("GET", "/metamodel/types", params=params)


client = EasyEAClient()
