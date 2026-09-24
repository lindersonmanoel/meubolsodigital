"use strict";

/**
 * Motor compartilhado pelas telas de movimentacoes.html, receitas.html e despesas.html.
 * opcoes: { base: "movimentacoes"|"receitas"|"despesas", tipoFixo: null|"receita"|"despesa" }
 */
function iniciarPaginaMovimentacoes(opcoes) {
  const { base, tipoFixo } = opcoes;

  const erroGeral = document.getElementById("erro-geral");
  const painel = document.getElementById("painel-formulario");
  const form = document.getElementById("form-movimentacao");
  const corpoTabela = document.getElementById("corpo-tabela");
  const listaVazia = document.getElementById("lista-vazia");
  const carregando = document.getElementById("carregando");
  const selectCategoria = document.getElementById("categoriaId");
  const selectFiltroCategoria = document.getElementById("filtro-categoria");
  const campoTipo = document.getElementById("campo-tipo");
  const filtroTipo = document.getElementById("filtro-tipo");

  let categorias = [];

  // Paginacao: a lista vem de 50 em 50 (o backend devolve "paginacao" so' quando pedimos).
  const POR_PAGINA = 50;
  let pagina = 1;
  const paginador = document.createElement("div");
  paginador.style.cssText = "display:flex;align-items:center;justify-content:center;gap:12px;margin-top:12px;flex-wrap:wrap";
  paginador.hidden = true;
  const tabelaLista = corpoTabela.closest("table");
  if (tabelaLista) tabelaLista.insertAdjacentElement("afterend", paginador);

  function desenharPaginador(info) {
    if (!info || info.totalPaginas <= 1) {
      paginador.hidden = true;
      return;
    }
    paginador.innerHTML = "";
    const anterior = document.createElement("button");
    anterior.type = "button";
    anterior.className = "btn btn-secundario";
    anterior.textContent = "Anterior";
    anterior.disabled = info.pagina <= 1;
    anterior.addEventListener("click", () => { pagina = info.pagina - 1; carregarLista(); });
    const texto = document.createElement("span");
    texto.className = "hint";
    texto.textContent = `Página ${info.pagina} de ${info.totalPaginas} (${info.total} lançamentos)`;
    const proxima = document.createElement("button");
    proxima.type = "button";
    proxima.className = "btn btn-secundario";
    proxima.textContent = "Próxima";
    proxima.disabled = info.pagina >= info.totalPaginas;
    proxima.addEventListener("click", () => { pagina = info.pagina + 1; carregarLista(); });
    paginador.append(anterior, texto, proxima);
    paginador.hidden = false;
  }

  // Quando a pagina e' fixa em receita/despesa, esconde os seletores de tipo (nao fazem sentido).
  if (tipoFixo) {
    if (campoTipo) campoTipo.hidden = true;
    if (filtroTipo) (filtroTipo.closest(".campo") || filtroTipo).hidden = true;
    document.querySelectorAll("th.coluna-tipo").forEach((th) => (th.hidden = true));
  }

  function popularSelectsCategoria() {
    const tipoAtual = tipoFixo || document.getElementById("tipo").value || "despesa";
    const relevantes = categorias.filter((c) => c.tipo === tipoAtual);
    selectCategoria.innerHTML =
      `<option value="">${relevantes.length ? "Sem categoria" : "Sem categoria (crie categorias na aba Categorias)"}</option>` +
      relevantes.map((c) => `<option value="${c.id}">${escaparHtml(c.nome)}</option>`).join("");

    if (selectFiltroCategoria) {
      selectFiltroCategoria.innerHTML =
        '<option value="">Todas as categorias</option>' +
        categorias.map((c) => `<option value="${c.id}">${escaparHtml(c.nome)} (${c.tipo === "receita" ? "receita" : "despesa"})</option>`).join("");
    }
  }

  function escaparHtml(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
  }

  function abrirFormulario(mov) {
    form.reset();
    limparErrosCampos(form);
    document.getElementById("movimentacao-id").value = mov ? mov.id : "";
    const sufixo = tipoFixo === "receita" ? "receita" : tipoFixo === "despesa" ? "despesa" : "movimentação";
    document.getElementById("titulo-formulario").textContent = (mov ? "Editar " : "Nova ") + sufixo;
    if (!tipoFixo) document.getElementById("tipo").value = mov ? mov.tipo : "despesa";
    popularSelectsCategoria();
    if (mov) {
      document.getElementById("descricao").value = mov.descricao;
      document.getElementById("valor").value = mov.valor;
      document.getElementById("data").value = mov.data.slice(0, 10);
      document.getElementById("observacao").value = mov.observacao || "";
      selectCategoria.value = mov.categoria_id || "";
    } else {
      document.getElementById("data").value = new Date().toISOString().slice(0, 10);
    }
    painel.hidden = false;
    document.getElementById("descricao").focus();
  }
  function fecharFormulario() {
    painel.hidden = true;
    form.reset();
  }

  document.getElementById("btn-nova").addEventListener("click", () => abrirFormulario(null));
  document.getElementById("btn-cancelar").addEventListener("click", fecharFormulario);
  if (!tipoFixo) {
    document.getElementById("tipo").addEventListener("change", popularSelectsCategoria);
  }

  function linhaMovimentacao(mov) {
    const tr = document.createElement("tr");
    const classeValor = mov.tipo === "receita" ? "valor-receita" : "valor-despesa";
    const sinal = mov.tipo === "receita" ? "+" : "-";
    tr.innerHTML = `
      <td>${formatarData(mov.data)}</td>
      <td>${escaparHtml(mov.descricao)}</td>
      <td>${mov.categoria_nome ? escaparHtml(mov.categoria_nome) : '<span class="hint">Sem categoria</span>'}</td>
      <td class="coluna-tipo"><span class="badge badge-${mov.tipo}">${mov.tipo === "receita" ? "Receita" : "Despesa"}</span></td>
      <td class="${classeValor}">${sinal} ${formatarMoeda(mov.valor)}</td>
      <td class="tabela-acoes">
        <button type="button" data-acao="editar">Editar</button>
        <button type="button" class="excluir" data-acao="excluir">Excluir</button>
      </td>
    `;
    tr.querySelector('[data-acao="editar"]').addEventListener("click", () => abrirFormulario(mov));
    tr.querySelector('[data-acao="excluir"]').addEventListener("click", () => excluir(mov));
    if (tipoFixo) tr.querySelector(".coluna-tipo").hidden = true;
    return tr;
  }

  async function excluir(mov) {
    if (!confirm(`Excluir "${mov.descricao}"?`)) return;
    try {
      await Api.removerMovimentacao(base, mov.id);
      await carregarLista();
    } catch (err) {
      mostrarErro(erroGeral, err.message);
    }
  }

  function filtrosAtuais() {
    return {
      tipo: !tipoFixo && filtroTipo ? filtroTipo.value : undefined,
      categoriaId: selectFiltroCategoria ? selectFiltroCategoria.value : undefined,
      inicio: document.getElementById("filtro-inicio").value || undefined,
      fim: document.getElementById("filtro-fim").value || undefined,
      busca: document.getElementById("filtro-busca").value.trim() || undefined,
    };
  }

  async function carregarLista() {
    mostrarErro(erroGeral, "");
    carregando.hidden = false;
    try {
      const { movimentacoes, paginacao } = await Api.listarMovimentacoes(base, {
        ...filtrosAtuais(),
        limite: POR_PAGINA,
        pagina,
      });
      // Apagou o ultimo item da ultima pagina: volta pra ultima que ainda tem itens.
      if (paginacao && !movimentacoes.length && paginacao.pagina > 1) {
        pagina = paginacao.totalPaginas;
        return carregarLista();
      }
      desenharPaginador(paginacao);
      corpoTabela.innerHTML = "";
      movimentacoes.forEach((m) => corpoTabela.appendChild(linhaMovimentacao(m)));
      listaVazia.hidden = movimentacoes.length > 0;
    } catch (err) {
      if (err.status === 401) {
        Sessao.encerrar();
        window.location.href = "login.html";
        return;
      }
      mostrarErro(erroGeral, err.message);
    } finally {
      carregando.hidden = true;
    }
  }

  const btnExportar = document.getElementById("btn-exportar");
  if (btnExportar) {
    btnExportar.addEventListener("click", async () => {
      btnExportar.disabled = true;
      try {
        const url = Api.urlExportarMovimentacoes(base, filtrosAtuais());
        await Api.baixarCsv(url, `${base}.csv`);
      } catch (err) {
        mostrarErro(erroGeral, err.message);
      } finally {
        btnExportar.disabled = false;
      }
    });
  }

  const btnExportarExcel = document.getElementById("btn-exportar-excel");
  if (btnExportarExcel) {
    btnExportarExcel.addEventListener("click", async () => {
      btnExportarExcel.disabled = true;
      try {
        const url = Api.urlExportarMovimentacoesExcel(base, filtrosAtuais());
        await Api.baixarCsv(url, `${base}.xlsx`);
      } catch (err) {
        mostrarErro(erroGeral, err.message);
      } finally {
        btnExportarExcel.disabled = false;
      }
    });
  }

  document.getElementById("form-filtros").addEventListener("submit", (e) => {
    e.preventDefault();
    pagina = 1;
    carregarLista();
  });
  document.getElementById("btn-limpar-filtros").addEventListener("click", () => {
    document.getElementById("form-filtros").reset();
    pagina = 1;
    carregarLista();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    mostrarErro(erroGeral, "");
    limparErrosCampos(form);
    const btn = document.getElementById("btn-salvar");
    btn.disabled = true;
    const id = document.getElementById("movimentacao-id").value;
    const payload = {
      tipo: tipoFixo || document.getElementById("tipo").value,
      descricao: document.getElementById("descricao").value.trim(),
      valor: document.getElementById("valor").value,
      data: document.getElementById("data").value,
      observacao: document.getElementById("observacao").value.trim() || undefined,
      categoriaId: selectCategoria.value || undefined,
    };
    try {
      if (id) await Api.atualizarMovimentacao(base, id, payload);
      else await Api.criarMovimentacao(base, payload);
      fecharFormulario();
      await carregarLista();
    } catch (err) {
      if (err.status === 422) mostrarErrosCampos(form, err.body.campos);
      else mostrarErro(erroGeral, err.message);
    } finally {
      btn.disabled = false;
    }
  });

  (async function iniciar() {
    try {
      const resposta = await Api.listarCategorias();
      categorias = resposta.categorias;
      popularSelectsCategoria();
    } catch (err) {
      // segue sem categorias - o formulario ainda funciona sem categoria
    }
    await carregarLista();
  })();
}
