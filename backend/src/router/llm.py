"""LLM Router

Routes LLM calls to the configured provider based on role.
Handles retries, fallbacks, rate limiting, and token counting.

Supports: OpenAI, Anthropic, Google, Groq, Ollama
"""

import asyncio
import json
import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

from openai import AsyncOpenAI

logger = logging.getLogger("drifter.llm_router")


# ─── Provider Interface ──────────────────────────────────────────────────


class LLMProvider(ABC):
    """Abstract base for all LLM providers."""

    @abstractmethod
    async def chat(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> str:
        """Send a chat completion request."""
        pass

    @abstractmethod
    async def embed(self, model: str, text: str) -> list[float]:
        """Generate an embedding for text."""
        pass


# ─── OpenAI Provider ─────────────────────────────────────────────────────


class OpenAIProvider(LLMProvider):
    """OpenAI provider using the official async SDK."""

    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
        )

    async def chat(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> str:
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""

    async def embed(self, model: str, text: str) -> list[float]:
        response = await self.client.embeddings.create(
            model=model,
            input=text,
        )
        return response.data[0].embedding


# ─── Anthropic Provider ──────────────────────────────────────────────────


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider."""

    def __init__(self, api_key: str):
        import anthropic

        self.client = anthropic.AsyncAnthropic(api_key=api_key)

    async def chat(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> str:
        # Convert OpenAI message format to Anthropic format
        system_msg = ""
        anthropic_messages = []
        for msg in messages:
            if msg.get("role") == "system":
                system_msg = msg.get("content", "")
            else:
                anthropic_messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })

        response = await self.client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_msg,
            messages=anthropic_messages,
        )
        return response.content[0].text

    async def embed(self, model: str, text: str) -> list[float]:
        # Anthropic doesn't have embeddings — raise
        raise NotImplementedError(
            "Anthropic does not support embeddings. Use OpenAI or Ollama for embeddings."
        )


# ─── Ollama Provider ─────────────────────────────────────────────────────


class OllamaProvider(LLMProvider):
    """Ollama local provider."""

    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url.rstrip("/")
        self._client = AsyncOpenAI(
            base_url=f"{self.base_url}/v1",
            api_key="ollama",  # Ollama doesn't require a real key
        )

    async def chat(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> str:
        response = await self._client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""

    async def embed(self, model: str, text: str) -> list[float]:
        # Ollama uses a separate embedding endpoint
        import httpx

        async with httpx.AsyncClient() as http:
            resp = await http.post(
                f"{self.base_url}/api/embeddings",
                json={"model": model, "prompt": text},
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["embedding"]


# ─── Groq Provider ───────────────────────────────────────────────────────


class GroqProvider(LLMProvider):
    """Groq fast inference provider."""

    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1",
        )

    async def chat(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> str:
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""

    async def embed(self, model: str, text: str) -> list[float]:
        raise NotImplementedError("Groq does not support embeddings.")


# ─── Role Definitions ────────────────────────────────────────────────────

ROLES = {
    "quick_capture": {"max_tokens": 200, "temperature": 0.3},
    "research": {"max_tokens": 4000, "temperature": 0.7},
    "report_generation": {"max_tokens": 8000, "temperature": 0.5},
    "memory_maintenance": {"max_tokens": 2000, "temperature": 0.4},
    "vision": {"max_tokens": 1000, "temperature": 0.3},
    "embedding": {},  # No tokens/temp for embeddings
}


# ─── Router ──────────────────────────────────────────────────────────────


@dataclass
class RoleConfig:
    provider_name: str
    model: str


@dataclass
class RouterConfig:
    providers: dict[str, LLMProvider] = field(default_factory=dict)
    roles: dict[str, RoleConfig] = field(default_factory=dict)
    fallbacks: dict[str, RoleConfig] = field(default_factory=dict)
    embedding_provider: str = ""
    embedding_model: str = ""


class LLMRouter:
    """Routes LLM calls to configured providers based on role."""

    def __init__(self, config: Optional[RouterConfig] = None):
        self.config = config or RouterConfig()
        self._retry_count = 3
        self._retry_delay = 1.0

    async def call(
        self,
        role: str,
        messages: list[dict],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> str:
        """Make an LLM call routed by role with automatic retry and fallback."""
        role_cfg = self.config.roles.get(role)
        if not role_cfg:
            raise ValueError(f"No provider configured for role: {role}")

        provider = self.config.providers.get(role_cfg.provider_name)
        if not provider:
            raise ValueError(f"Provider not found: {role_cfg.provider_name}")

        role_defaults = ROLES.get(role, {})
        effective_max_tokens = max_tokens or role_defaults.get("max_tokens", 1000)
        effective_temp = temperature if temperature is not None else role_defaults.get("temperature", 0.7)

        # Try primary provider
        for attempt in range(self._retry_count):
            try:
                result = await provider.chat(
                    model=role_cfg.model,
                    messages=messages,
                    max_tokens=effective_max_tokens,
                    temperature=effective_temp,
                )
                logger.info(
                    f"LLM call succeeded (role={role}, provider={role_cfg.provider_name}, "
                    f"model={role_cfg.model}, attempt={attempt + 1})"
                )
                return result
            except Exception as e:
                logger.warning(
                    f"LLM call failed (attempt {attempt + 1}/{self._retry_count}): {e}"
                )
                if attempt < self._retry_count - 1:
                    await asyncio.sleep(self._retry_delay * (attempt + 1))

        # Try fallback
        fallback_cfg = self.config.fallbacks.get(role)
        if fallback_cfg:
            fallback_provider = self.config.providers.get(fallback_cfg.provider_name)
            if fallback_provider:
                try:
                    logger.info(f"Trying fallback: {fallback_cfg.provider_name}")
                    result = await fallback_provider.chat(
                        model=fallback_cfg.model,
                        messages=messages,
                        max_tokens=effective_max_tokens,
                        temperature=effective_temp,
                    )
                    return result
                except Exception as e:
                    logger.error(f"Fallback also failed: {e}")

        raise RuntimeError(
            f"LLM call failed for role '{role}' after {self._retry_count} retries and fallback"
        )

    async def embed(self, text: str) -> list[float]:
        """Generate an embedding for text using the configured embedding provider."""
        if not self.config.embedding_provider:
            raise ValueError("No embedding provider configured")

        provider = self.config.providers.get(self.config.embedding_provider)
        if not provider:
            raise ValueError(
                f"Embedding provider not found: {self.config.embedding_provider}"
            )

        return await provider.embed(self.config.embedding_model, text)

    def add_provider(self, name: str, provider: LLMProvider):
        """Register a provider."""
        self.config.providers[name] = provider

    def set_role(self, role: str, provider_name: str, model: str):
        """Assign a provider+model to a role."""
        self.config.roles[role] = RoleConfig(
            provider_name=provider_name, model=model
        )

    def set_fallback(self, role: str, provider_name: str, model: str):
        """Set a fallback provider for a role."""
        self.config.fallbacks[role] = RoleConfig(
            provider_name=provider_name, model=model
        )

    def set_embedding(self, provider_name: str, model: str):
        """Configure the embedding provider."""
        self.config.embedding_provider = provider_name
        self.config.embedding_model = model


# ─── Factory ─────────────────────────────────────────────────────────────


def create_router_from_env() -> LLMRouter:
    """Create a router configured from environment variables.

    Environment variables:
        DRIFTER_LLM_PROVIDER: openai | anthropic | ollama | groq
        DRIFTER_LLM_MODEL: model name (e.g. gpt-4o-mini)
        DRIFTER_OPENAI_API_KEY: OpenAI API key
        DRIFTER_ANTHROPIC_API_KEY: Anthropic API key
        DRIFTER_GROQ_API_KEY: Groq API key
        DRIFTER_OLLAMA_BASE_URL: Ollama base URL (default: http://localhost:11434)
        DRIFTER_EMBEDDING_PROVIDER: openai | ollama
        DRIFTER_EMBEDDING_MODEL: embedding model name
    """
    router = LLMRouter()

    llm_provider = os.environ.get("DRIFTER_LLM_PROVIDER", "openai")
    llm_model = os.environ.get("DRIFTER_LLM_MODEL", "gpt-4o-mini")

    # Register providers based on available API keys
    if os.environ.get("DRIFTER_OPENAI_API_KEY"):
        router.add_provider(
            "openai",
            OpenAIProvider(api_key=os.environ["DRIFTER_OPENAI_API_KEY"]),
        )

    if os.environ.get("DRIFTER_ANTHROPIC_API_KEY"):
        router.add_provider(
            "anthropic",
            AnthropicProvider(api_key=os.environ["DRIFTER_ANTHROPIC_API_KEY"]),
        )

    if os.environ.get("DRIFTER_GROQ_API_KEY"):
        router.add_provider(
            "groq",
            GroqProvider(api_key=os.environ["DRIFTER_GROQ_API_KEY"]),
        )

    # Ollama is always available (local)
    ollama_url = os.environ.get("DRIFTER_OLLAMA_BASE_URL", "http://localhost:11434")
    router.add_provider("ollama", OllamaProvider(base_url=ollama_url))

    # Configure roles
    for role in ROLES:
        router.set_role(role, llm_provider, llm_model)

    # Configure embedding
    embed_provider = os.environ.get("DRIFTER_EMBEDDING_PROVIDER", "openai")
    embed_model = os.environ.get("DRIFTER_EMBEDDING_MODEL", "text-embedding-3-small")
    router.set_embedding(embed_provider, embed_model)

    # Set fallback to Ollama if primary is not Ollama
    if llm_provider != "ollama":
        for role in ROLES:
            router.set_fallback(role, "ollama", llm_model)

    return router
