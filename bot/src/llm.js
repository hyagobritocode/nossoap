// Cliente único para IAs que falam o formato de chat da OpenAI (/chat/completions):
// Gemini, Groq, Ollama e qualquer outra compatível.

export const PROVIDERS = {
  // Google AI Studio: tem cota gratuita. Os apelidos "-latest" apontam sempre
  // para o Flash mais novo, então o bot não fica preso a um modelo aposentado.
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY",
    model: "gemini-flash-latest",
    reserve: "gemini-flash-lite-latest"
  },
  // Groq: cota gratuita, muito rápido.
  groq: {
    url: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    model: "openai/gpt-oss-120b",
    reserve: "openai/gpt-oss-20b"
  },
  // Ollama: roda no seu computador, sem chave e sem limite (precisa de máquina boa).
  ollama: {
    url: "http://localhost:11434/v1",
    keyEnv: null,
    model: "qwen3:8b",
    reserve: null
  }
};

export class LlmError extends Error {
  constructor(status, message, { daily = false } = {}) {
    super(message);
    this.status = status;
    this.daily = daily;
  }
}

/** Mensagem curta para mostrar no WhatsApp quando a IA falha. */
export function friendlyError(err) {
  if (err instanceof LlmError) {
    if (err.status === 429) {
      return err.daily
        ? "Acabou a cota gratuita de hoje da IA. Amanhã ela volta; se quiser, troque de IA no .env (veja o README)."
        : "A IA gratuita está no limite de pedidos por minuto. Tenta de novo daqui a pouco.";
    }
    if (err.status === 401 || err.status === 403 || /api key/i.test(err.message)) {
      return "A chave da IA foi recusada. Confira a chave no arquivo .env.";
    }
    if (err.status === 404) return "O modelo de IA configurado não existe mais. Troque o IA_MODELO no .env.";
  }
  if (err?.name === "TimeoutError") return "A IA demorou demais para responder. Tenta de novo.";
  if (err?.cause?.code === "ECONNREFUSED") return "Não consegui falar com a IA (ela está ligada? No Ollama, rode `ollama serve`).";
  return `Deu erro ao falar com a IA (${err?.status || err?.code || err?.message || "sem detalhe"}). Tenta de novo em instantes.`;
}

async function toError(res) {
  let body = await res.text();
  let message = body.slice(0, 500);
  try {
    let json = JSON.parse(body);
    if (Array.isArray(json)) json = json[0];   // o Gemini devolve o erro dentro de uma lista
    message = json?.error?.message || message;
  } catch {}
  const daily = /per ?day|daily|PerDay/i.test(body);
  return new LlmError(res.status, message, { daily });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

export function createLlm({ url, apiKey, model, reserveModel, reasoning, timeoutMs = 120_000 }, { fetchImpl = fetch, wait = sleep } = {}) {
  const endpoint = url.replace(/\/+$/, "") + "/chat/completions";
  const headers = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  async function once(modelId, body) {
    const payload = { ...body, model: modelId };
    if (reasoning) payload.reasoning_effort = reasoning;
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  return {
    model,
    /**
     * Uma chamada de chat. Espera e repete quando a cota por minuto estoura ou o
     * serviço oscila; se o modelo principal não existir ou a cota do dia acabar,
     * tenta o modelo reserva.
     */
    async chat(body) {
      const models = [model, reserveModel].filter((m, i, a) => m && a.indexOf(m) === i);
      let last;
      for (const m of models) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await once(m, body);
          } catch (err) {
            last = err;
            if (!(err instanceof LlmError)) throw err;
            if (err.status === 404 || (err.status === 429 && err.daily)) break;
            if (err.status === 429 || err.status >= 500) {
              await wait(Math.min(20_000, 2000 * 2 ** attempt));
              continue;
            }
            throw err;
          }
        }
      }
      throw last;
    }
  };
}
