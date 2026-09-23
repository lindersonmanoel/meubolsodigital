"use strict";

/** Erro de resposta da API, com o corpo JSON (campos de validacao) quando existir. */
class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body || {};
  }
}

const Api = (function () {
  function tokenAtual() {
    try {
      return localStorage.getItem("mbd_token") || "";
    } catch (e) {
      return "";
    }
  }

  function montarQuery(params) {
    const entradas = Object.entries(params || {}).filter(([, v]) => v != null && v !== "");
    if (!entradas.length) return "";
    return "?" + entradas.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  }

  const TIMEOUT_MS = 15000;

  async function request(path, { method = "GET", body, autenticado = false } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (autenticado) {
      const token = tokenAtual();
      if (!token) throw new ApiError("Sessão não iniciada.", 401, {});
      headers.Authorization = `Bearer ${token}`;
    }

    // Sem isso, uma rede instavel deixa o fetch pendurado indefinidamente (spinner
    // eterno) em vez de avisar a pessoa que algo deu errado.
    const controller = new AbortController();
    const semResposta = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res;
    try {
      res = await fetch(`${window.API_BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      const mensagem =
        e.name === "AbortError"
          ? "O servidor demorou demais para responder. Tente de novo."
          : "Não consegui falar com o servidor. Confira sua internet e tente de novo.";
      throw new ApiError(mensagem, 0, {});
    } finally {
      clearTimeout(semResposta);
    }

    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      // resposta sem corpo (ex.: alguns 204) - segue com objeto vazio
    }

    if (!res.ok) {
      // Token expirado/invalido numa rota autenticada: encerra a sessao local e manda
      // pro login, em vez de deixar a pagina mostrando um erro cru sem saida.
      if (res.status === 401 && autenticado && typeof Sessao !== "undefined") {
        Sessao.encerrar();
        if (!location.pathname.endsWith("login.html")) {
          window.location.href = "login.html";
        }
      }
      throw new ApiError(data.erro || `Erro ${res.status}.`, res.status, data);
    }
    return data;
  }

  return {
    // Autenticação e perfil
    registrar: (payload) => request("/auth/register", { method: "POST", body: payload }),
    login: (payload) => request("/auth/login", { method: "POST", body: payload }),
    logout: () => request("/auth/logout", { method: "POST" }),
    me: () => request("/auth/me", { autenticado: true }),
    atualizarPerfil: (payload) => request("/users/me", { method: "PUT", body: payload, autenticado: true }),
    trocarSenha: (payload) => request("/users/senha", { method: "PUT", body: payload, autenticado: true }),

    // Categorias
    listarCategorias: () => request("/categorias", { autenticado: true }),
    criarCategoria: (payload) => request("/categorias", { method: "POST", body: payload, autenticado: true }),
    atualizarCategoria: (id, payload) => request(`/categorias/${id}`, { method: "PUT", body: payload, autenticado: true }),
    removerCategoria: (id) => request(`/categorias/${id}`, { method: "DELETE", autenticado: true }),

    // Movimentações (genérico, receitas e despesas usam a mesma forma com base diferente)
    listarMovimentacoes: (base, filtros) => request(`/${base}${montarQuery(filtros)}`, { autenticado: true }),
    criarMovimentacao: (base, payload) => request(`/${base}`, { method: "POST", body: payload, autenticado: true }),
    atualizarMovimentacao: (base, id, payload) => request(`/${base}/${id}`, { method: "PUT", body: payload, autenticado: true }),
    removerMovimentacao: (base, id) => request(`/${base}/${id}`, { method: "DELETE", autenticado: true }),

    // Metas
    listarMetas: () => request("/metas", { autenticado: true }),
    criarMeta: (payload) => request("/metas", { method: "POST", body: payload, autenticado: true }),
    atualizarMeta: (id, payload) => request(`/metas/${id}`, { method: "PUT", body: payload, autenticado: true }),
    removerMeta: (id) => request(`/metas/${id}`, { method: "DELETE", autenticado: true }),

    // Dashboard e relatórios
    resumoDashboard: () => request("/dashboard/resumo", { autenticado: true }),
    graficosDashboard: (meses) => request(`/dashboard/graficos${montarQuery({ meses })}`, { autenticado: true }),
    relatorio: (filtros) => request(`/relatorios${montarQuery(filtros)}`, { autenticado: true }),

    // Recorrências (receitas/despesas fixas)
    listarRecorrencias: () => request("/recorrencias", { autenticado: true }),
    criarRecorrencia: (payload) => request("/recorrencias", { method: "POST", body: payload, autenticado: true }),
    atualizarRecorrencia: (id, payload) => request(`/recorrencias/${id}`, { method: "PUT", body: payload, autenticado: true }),
    removerRecorrencia: (id) => request(`/recorrencias/${id}`, { method: "DELETE", autenticado: true }),

    // Orçamentos por categoria
    listarOrcamentos: () => request("/orcamentos", { autenticado: true }),
    criarOrcamento: (payload) => request("/orcamentos", { method: "POST", body: payload, autenticado: true }),
    atualizarOrcamento: (id, payload) => request(`/orcamentos/${id}`, { method: "PUT", body: payload, autenticado: true }),
    removerOrcamento: (id) => request(`/orcamentos/${id}`, { method: "DELETE", autenticado: true }),

    // Backup e restauração (tudo cadastrado, num arquivo .json)
    urlBackup: () => `${window.API_BASE_URL}/backup`,
    restaurarBackup: (dados) => request("/backup/restaurar", { method: "POST", body: dados, autenticado: true }),

    // Exportação (baixa o arquivo direto, autenticando via token na URL nao e' preciso pq
    // usamos <a download> com blob - ver urlExportar)
    urlExportarMovimentacoes: (base, filtros) => `${window.API_BASE_URL}/${base}/exportar${montarQuery(filtros)}`,
    urlExportarMovimentacoesExcel: (base, filtros) => `${window.API_BASE_URL}/${base}/exportar-excel${montarQuery(filtros)}`,
    urlExportarRelatorio: (filtros) => `${window.API_BASE_URL}/relatorios/exportar${montarQuery(filtros)}`,
    urlExportarRelatorioExcel: (filtros) => `${window.API_BASE_URL}/relatorios/exportar-excel${montarQuery(filtros)}`,
    async baixarCsv(url, nomeArquivo) {
      const token = tokenAtual();
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new ApiError("Não consegui gerar o arquivo.", res.status, {});
      const blob = await res.blob();
      const linkUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = linkUrl;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(linkUrl);
    },
  };
})();
