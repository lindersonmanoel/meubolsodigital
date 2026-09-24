"use strict";

/**
 * Criacao rapida de categoria dentro dos formularios (despesas, receitas, movimentacoes, recorrencias e orcamentos).
 * Antes, quem ainda nao tinha categoria via so' "crie categorias na aba Categorias" e precisava sair do formulario.
 *
 * Uso: a tela coloca CategoriaRapida.opcao() como ultima <option> do <select> e chama ligar() uma vez.
 * Ao escolher "+ Criar nova categoria...", aparece um campo de nome logo abaixo; "Criar" grava pela API e chama
 * aoCriar(categoria) pra a tela atualizar a lista e selecionar a nova.
 */
const CategoriaRapida = (function () {
  const VALOR_NOVA = "__nova__";

  /** HTML da opcao especial (a tela concatena no fim das opcoes do select). */
  function opcao() {
    return `<option value="${VALOR_NOVA}">+ Criar nova categoria...</option>`;
  }

  /**
   * @param {{select: HTMLSelectElement, obterTipo: () => string, aoCriar: (categoria: object) => (void|Promise<void>)}} config
   */
  function ligar({ select, obterTipo, aoCriar }) {
    const campo = select.closest(".campo") || select.parentElement;
    const caixa = document.createElement("div");
    caixa.className = "categoria-rapida";
    caixa.hidden = true;
    caixa.innerHTML = `
      <div class="categoria-rapida-linha">
        <input type="text" maxlength="80" placeholder="Nome da nova categoria" aria-label="Nome da nova categoria" autocomplete="off">
        <button type="button" class="btn btn-primario" data-acao="criar">Criar</button>
        <button type="button" class="btn btn-secundario" data-acao="cancelar">Cancelar</button>
      </div>
      <p class="erro-campo" role="alert" hidden></p>`;
    campo.appendChild(caixa);

    const entrada = caixa.querySelector("input");
    const botaoCriar = caixa.querySelector('[data-acao="criar"]');
    const erro = caixa.querySelector(".erro-campo");
    let valorAnterior = "";

    function mostrarErro(mensagem) {
      erro.textContent = mensagem || "";
      erro.hidden = !mensagem;
    }
    function ocultar() {
      caixa.hidden = true;
      entrada.value = "";
      mostrarErro("");
    }
    function cancelar() {
      // volta pra o que estava selecionado (a opcao especial nao e' uma categoria de verdade)
      const existe = [...select.options].some((o) => o.value === valorAnterior);
      select.value = existe ? valorAnterior : "";
      ocultar();
    }

    async function criar() {
      const nome = entrada.value.trim();
      if (nome.length < 2) {
        mostrarErro("Informe um nome com pelo menos 2 caracteres.");
        entrada.focus();
        return;
      }
      botaoCriar.disabled = true;
      mostrarErro("");
      try {
        const { categoria } = await Api.criarCategoria({ nome, tipo: obterTipo() });
        ocultar();
        await aoCriar(categoria);
        select.value = String(categoria.id); // a tela ja' repopulou a lista com a nova
      } catch (err) {
        if (err && err.status === 401) return; // a sessao expirou: o cliente HTTP ja' levou pro login
        const campos = err && err.body && err.body.campos;
        mostrarErro((campos && campos.nome) || (err && err.message) || "Não foi possível criar a categoria.");
      } finally {
        botaoCriar.disabled = false;
      }
    }

    select.addEventListener("focus", () => { if (select.value !== VALOR_NOVA) valorAnterior = select.value; });
    select.addEventListener("change", () => {
      if (select.value === VALOR_NOVA) {
        caixa.hidden = false;
        entrada.focus();
      } else {
        valorAnterior = select.value;
        ocultar();
      }
    });
    botaoCriar.addEventListener("click", criar);
    caixa.querySelector('[data-acao="cancelar"]').addEventListener("click", cancelar);
    entrada.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); criar(); } // Enter aqui nao pode enviar o formulario principal
      if (e.key === "Escape") { e.preventDefault(); cancelar(); }
    });
    if (select.form) select.form.addEventListener("reset", ocultar);

    return { ocultar };
  }

  return { opcao, ligar, VALOR_NOVA };
})();
