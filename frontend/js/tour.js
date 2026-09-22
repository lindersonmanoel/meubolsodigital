"use strict";

/**
 * Tour guiado do site: passa pelas paginas principais destacando um elemento de cada vez,
 * com uma explicacao. Como o site nao e' uma SPA (cada pagina recarrega de verdade), o
 * progresso fica salvo no localStorage e cada pagina, ao carregar, confere se ha um tour em
 * andamento que pertence a ela (Tour.verificarAoCarregar(), chamado logo depois de
 * montarShell() em cada pagina).
 */
const Tour = (function () {
  const CHAVE_PASSO = "mbd_tour_passo";
  const CHAVE_VISTO = "mbd_tour_visto";

  const PASSOS = [
    { pagina: "dashboard.html", seletor: ".grade-cartoes", titulo: "Seu resumo financeiro", texto: "Aqui você vê seu saldo atual, receitas, despesas e o resultado do mês, sempre atualizado." },
    { pagina: "dashboard.html", seletor: ".grafico-caixa", titulo: "Gráficos", texto: "Acompanhe receitas x despesas mês a mês e veja em quais categorias o dinheiro está indo." },
    { pagina: "receitas.html", seletor: "#btn-nova", titulo: "Receitas", texto: "Aqui ficam suas entradas de dinheiro (salário, freelas...). Clique aqui pra cadastrar uma nova." },
    { pagina: "despesas.html", seletor: "#btn-nova", titulo: "Despesas", texto: "Registre tudo o que sai da conta. Dá pra filtrar por categoria, período ou buscar por descrição." },
    { pagina: "movimentacoes.html", seletor: "#btn-exportar", titulo: "Movimentações", texto: "Receitas e despesas juntas numa lista só, com filtros - e dá pra exportar tudo em CSV." },
    { pagina: "recorrencias.html", seletor: "#btn-nova", titulo: "Recorrências", texto: "Cadastre contas fixas (aluguel, assinaturas, salário) e elas são lançadas sozinhas todo mês." },
    { pagina: "orcamentos.html", seletor: "#btn-novo", titulo: "Orçamentos", texto: "Defina um limite de gasto mensal por categoria e receba um aviso quando estourar." },
    { pagina: "categorias.html", seletor: "#btn-nova", titulo: "Categorias", texto: "Organize receitas e despesas em categorias, pra entender melhor pra onde vai seu dinheiro." },
    { pagina: "metas.html", seletor: "#btn-nova", titulo: "Metas", texto: "Defina um objetivo (uma viagem, uma reserva) e acompanhe o progresso até alcançar o valor." },
    { pagina: "relatorios.html", seletor: "#btn-exportar-csv", titulo: "Relatórios", texto: "Veja o resumo de qualquer período e exporte em CSV ou PDF." },
    { pagina: "configuracoes.html", seletor: "#cartao-instalar", titulo: "Configurações", texto: "Troque sua senha, atualize seu perfil e instale o app no seu dispositivo por aqui. Fim do tour!" },
  ];

  function paginaAtual() {
    let seg = window.location.pathname.split("/").filter(Boolean).pop() || "";
    if (!seg.includes(".")) seg += ".html";
    return seg;
  }

  function lerPasso() {
    try {
      const v = Number(localStorage.getItem(CHAVE_PASSO));
      return Number.isInteger(v) && v >= 0 && v < PASSOS.length ? v : null;
    } catch (e) {
      return null;
    }
  }
  function salvarPasso(indice) {
    try { localStorage.setItem(CHAVE_PASSO, String(indice)); } catch (e) { /* segue sem salvar */ }
  }
  function limparPasso() {
    try { localStorage.removeItem(CHAVE_PASSO); } catch (e) { /* nada a fazer */ }
  }
  function marcarVisto() {
    try { localStorage.setItem(CHAVE_VISTO, "1"); } catch (e) { /* nada a fazer */ }
  }
  function jaVisto() {
    try { return localStorage.getItem(CHAVE_VISTO) === "1"; } catch (e) { return false; }
  }

  let elementos = null; // { overlayTop, overlayBottom, overlayLeft, overlayRight, moldura, balao }
  let pararDeEscutar = null; // remove os listeners de resize/scroll do passo atual

  function removerElementos() {
    if (pararDeEscutar) {
      pararDeEscutar();
      pararDeEscutar = null;
    }
    if (!elementos) return;
    Object.values(elementos).forEach((el) => el.remove());
    elementos = null;
  }

  function criarElementos() {
    removerElementos();
    const partes = ["overlayTop", "overlayBottom", "overlayLeft", "overlayRight", "moldura"].reduce((acc, nome) => {
      const div = document.createElement("div");
      div.className = `tour-${nome.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
      document.body.appendChild(div);
      acc[nome] = div;
      return acc;
    }, {});
    const balao = document.createElement("div");
    balao.className = "tour-balao";
    document.body.appendChild(balao);
    partes.balao = balao;
    elementos = partes;
    return partes;
  }

  function posicionar(alvo) {
    const partes = elementos;
    const retangulo = alvo.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const folga = 6;

    partes.overlayTop.style.cssText = `top:0;left:0;width:100%;height:${Math.max(0, retangulo.top - folga)}px`;
    partes.overlayBottom.style.cssText = `top:${retangulo.bottom + folga}px;left:0;width:100%;height:${Math.max(0, vh - retangulo.bottom - folga)}px`;
    partes.overlayLeft.style.cssText = `top:${retangulo.top - folga}px;left:0;width:${Math.max(0, retangulo.left - folga)}px;height:${retangulo.height + folga * 2}px`;
    partes.overlayRight.style.cssText = `top:${retangulo.top - folga}px;left:${retangulo.right + folga}px;width:${Math.max(0, vw - retangulo.right - folga)}px;height:${retangulo.height + folga * 2}px`;
    partes.moldura.style.cssText = `top:${retangulo.top - folga}px;left:${retangulo.left - folga}px;width:${retangulo.width + folga * 2}px;height:${retangulo.height + folga * 2}px`;

    return retangulo;
  }

  function posicionarBalao(retanguloAlvo) {
    const balao = elementos.balao;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    balao.style.visibility = "hidden";
    balao.style.display = "block";
    const largura = balao.offsetWidth || 320;
    const altura = balao.offsetHeight || 140;

    let top = retanguloAlvo.bottom + 16;
    if (top + altura > vh - 12) top = Math.max(12, retanguloAlvo.top - altura - 16);
    let left = Math.min(Math.max(12, retanguloAlvo.left), vw - largura - 12);

    balao.style.top = `${top}px`;
    balao.style.left = `${left}px`;
    balao.style.visibility = "visible";
  }

  function renderizarBalaoConteudo(indice) {
    const passo = PASSOS[indice];
    const ultimo = indice === PASSOS.length - 1;
    elementos.balao.innerHTML = `
      <div class="tour-balao-topo">
        <strong>${passo.titulo}</strong>
        <span class="hint">${indice + 1} de ${PASSOS.length}</span>
      </div>
      <p>${passo.texto}</p>
      <div class="tour-balao-acoes">
        <button type="button" class="btn btn-secundario" data-acao="pular" style="width:auto;padding:8px 14px">Pular tour</button>
        <div style="display:flex;gap:8px">
          ${indice > 0 ? '<button type="button" class="btn btn-secundario" data-acao="voltar" style="width:auto;padding:8px 14px">Voltar</button>' : ""}
          <button type="button" class="btn btn-primario" data-acao="avancar" style="width:auto;padding:8px 14px">${ultimo ? "Concluir" : "Próximo"}</button>
        </div>
      </div>
    `;
    elementos.balao.querySelector('[data-acao="pular"]').addEventListener("click", finalizar);
    const btnVoltar = elementos.balao.querySelector('[data-acao="voltar"]');
    if (btnVoltar) btnVoltar.addEventListener("click", () => irPara(indice - 1));
    elementos.balao.querySelector('[data-acao="avancar"]').addEventListener("click", () => {
      if (ultimo) finalizar();
      else irPara(indice + 1);
    });
  }

  function irPara(indice) {
    const passo = PASSOS[indice];
    salvarPasso(indice);
    if (paginaAtual() !== passo.pagina) {
      window.location.href = passo.pagina;
      return;
    }
    mostrarPasso(indice);
  }

  function mostrarPasso(indice, tentativas) {
    tentativas = tentativas || 0;
    const passo = PASSOS[indice];
    const alvo = document.querySelector(passo.seletor);
    if (!alvo) {
      // elemento pode nao existir ainda (ex.: pagina ainda carregando) - tenta mais um pouco,
      // senao pula esse passo pra nao travar o tour numa pagina sem o elemento esperado.
      if (tentativas < 10) {
        setTimeout(() => mostrarPasso(indice, tentativas + 1), 150);
        return;
      }
      if (indice + 1 < PASSOS.length) irPara(indice + 1);
      else finalizar();
      return;
    }

    criarElementos();
    alvo.scrollIntoView({ behavior: "instant", block: "center" });
    requestAnimationFrame(() => {
      const retangulo = posicionar(alvo);
      renderizarBalaoConteudo(indice);
      posicionarBalao(retangulo);
    });

    function reposicionar() {
      const el = document.querySelector(passo.seletor);
      if (!el || !elementos) return;
      const r = posicionar(el);
      posicionarBalao(r);
    }
    window.addEventListener("resize", reposicionar);
    window.addEventListener("scroll", reposicionar, true);
    pararDeEscutar = () => {
      window.removeEventListener("resize", reposicionar);
      window.removeEventListener("scroll", reposicionar, true);
    };
  }

  function finalizar() {
    removerElementos();
    limparPasso();
    marcarVisto();
  }

  /** Chame no topo de cada pagina (depois de montarShell()): retoma o tour se houver um em
   * andamento e o passo atual pertencer a esta pagina. */
  function verificarAoCarregar() {
    const indice = lerPasso();
    if (indice == null) return;
    if (PASSOS[indice].pagina !== paginaAtual()) return;
    mostrarPasso(indice);
  }

  /** Inicia o tour do zero (ou navega ate' a primeira pagina dele). */
  function iniciar() {
    irPara(0);
  }

  return { iniciar, verificarAoCarregar, jaVisto, marcarVisto };
})();
