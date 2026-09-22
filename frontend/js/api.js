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

  async function request(path, { method = "GET", body, autenticado = false } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (autenticado) {
      const token = tokenAtual();
      if (!token) throw new ApiError("Sessão não iniciada.", 401, {});
      headers.Authorization = `Bearer ${token}`;
    }

    let res;
    try {
      res = await fetch(`${window.API_BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new ApiError("Não consegui falar com o servidor. Confira sua internet e tente de novo.", 0, {});
    }

    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      // resposta sem corpo (ex.: alguns 204) - segue com objeto vazio
    }

    if (!res.ok) {
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
  };
})();
