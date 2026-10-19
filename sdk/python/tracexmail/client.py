"""
TraceXMail Python Client Library
"""
import requests
from typing import Dict, Any, Optional

class TraceXMailClient:
    def __init__(self, api_key: str, base_url: str = "https://api.tracexmail.com", timeout: int = 15):
        if not api_key:
            raise ValueError("API Key must be provided")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": self.api_key,
            "User-Agent": "TraceXMail-Python-SDK/1.0",
            "Content-Type": "application/json"
        })

    def analyze_email(self, raw_email: str, file_name: str = "email.eml", idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Submits raw RFC822 email text for forensic analysis.
        """
        headers = {}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        resp = self.session.post(
            f"{self.base_url}/api/v1/analyze",
            json={"raw_email": raw_email, "file_name": file_name},
            headers=headers,
            timeout=self.timeout
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("analysis", data)

    def get_case(self, case_id: str) -> Dict[str, Any]:
        """
        Retrieves a case dossier by ID.
        """
        resp = self.session.get(f"{self.base_url}/api/v1/cases/{case_id}", timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def quarantine_email(self, case_id: str) -> Dict[str, Any]:
        """
        Holds email in quarantine.
        """
        resp = self.session.post(f"{self.base_url}/api/v1/cases/{case_id}/quarantine", timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()
