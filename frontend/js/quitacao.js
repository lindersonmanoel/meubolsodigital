"use strict";

/**
 * Calculadora de quitacao de dividas (tela de Orcamentos). E' uma SIMULACAO: nada e' enviado ao servidor nem salvo
 * na conta; a lista de dividas fica so' neste aparelho (localStorage) pra pessoa nao digitar tudo de novo.
 *
 * Duas partes no mesmo arquivo:
 *  1) Quitacao.simular / comparar / economiaComExtra: calculo puro (sem DOM), coberto por testes;
 *  2) Quitacao.iniciarCalculadora: monta a tela dentro de um elemento e devolve { atualizarSobra }.
 */
const Quitacao = (function () {
  const MAX_MESES = 600; // 50 anos: alem disso, tratamos como "nunca quita"
  const JANELA_SEM_PROGRESSO = 12; // meses seguidos sem o saldo total cair = juros >= pagamento
  const METODOS = {
    "bola-de-neve": "Bola de neve (menor saldo primeiro)",
    avalanche: "Avalanche (maior juros primeiro)",
  };

  const arred = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
  const numero = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  /**
   * @param {{dividas: Array<{nome?: string, saldo: number, jurosMensal?: number, minima?: number}>, valorMensal: number, metodo?: string}} entrada
   *   jurosMensal em % ao mes (ex.: 4.5 = 4,5% ao mes); minima = parcela minima mensal da divida.
   * @returns {{possivel: boolean, meses: number, totalPago: number, totalJuros: number, dividaTotal: number,
   *            ordem: Array<{nome: string, mes: number}>, avisos: string[]}}
   *
   * Cada mes: (1) entram os juros de cada divida; (2) paga-se a parcela minima de cada uma (na ordem de prioridade,
   * enquanto houver dinheiro); (3) o que sobrar do valor mensal vai pra divida prioritaria, e assim por diante.
   * Quando uma divida quita, o valor dela "rola" pra proxima (por isso a bola de neve/avalanche).
   */
  function simular({ dividas, valorMensal, metodo = "bola-de-neve" }) {
    const ativas = (dividas || [])
      .map((d, i) => ({
        nome: String(d.nome || "").trim() || `Dívida ${i + 1}`,
        saldo: arred(numero(d.saldo)),
        juros: numero(d.jurosMensal) / 100,
        minima: arred(numero(d.minima)),
        quitadaEm: null,
      }))
      .filter((d) => d.saldo > 0);

    const dividaTotal = arred(ativas.reduce((s, d) => s + d.saldo, 0));
    const valor = arred(numero(valorMensal));
    const avisos = [];
    const resultado = { possivel: true, meses: 0, totalPago: 0, totalJuros: 0, dividaTotal, ordem: [], avisos };
    if (!ativas.length) return resultado;

    const somaMinimas = arred(ativas.reduce((s, d) => s + d.minima, 0));
    if (valor <= 0) {
      avisos.push("Informe quanto você consegue pagar por mês para calcular o prazo.");
      resultado.possivel = false;
      return resultado;
    }
    if (valor < somaMinimas) {
      avisos.push(`O valor por mês (${dinheiro(valor)}) é menor que a soma das parcelas mínimas (${dinheiro(somaMinimas)}).`);
    }

    // prioridade: bola de neve = menor saldo; avalanche = maior juros (desempate: menor saldo)
    const porPrioridade = (lista) => [...lista].sort((a, b) => (metodo === "avalanche"
      ? (b.juros - a.juros) || (a.saldo - b.saldo)
      : (a.saldo - b.saldo) || (b.juros - a.juros)));

    let mes = 0;
    let semProgresso = 0;
    let totalJuros = 0;
    let totalPago = 0;
    let saldoAnterior = dividaTotal;

    while (ativas.some((d) => d.quitadaEm === null) && mes < MAX_MESES) {
      mes += 1;
      const abertas = ativas.filter((d) => d.quitadaEm === null);

      for (const d of abertas) { // 1) juros do mes
        const j = arred(d.saldo * d.juros);
        d.saldo = arred(d.saldo + j);
        totalJuros = arred(totalJuros + j);
      }

      let disponivel = valor;
      const pagar = (d, quanto) => {
        const p = arred(Math.min(quanto, d.saldo, disponivel));
        if (p <= 0) return;
        d.saldo = arred(d.saldo - p);
        disponivel = arred(disponivel - p);
        totalPago = arred(totalPago + p);
      };
      const ordenadas = porPrioridade(abertas);
      for (const d of ordenadas) pagar(d, d.minima); // 2) minimas
      for (const d of ordenadas) { // 3) o resto, na ordem de prioridade
        if (disponivel <= 0) break;
        pagar(d, d.saldo);
      }

      for (const d of abertas) if (d.saldo <= 0.004) { d.saldo = 0; d.quitadaEm = mes; }

      const saldoAgora = arred(ativas.reduce((s, d) => s + d.saldo, 0));
      semProgresso = saldoAgora >= saldoAnterior ? semProgresso + 1 : 0;
      saldoAnterior = saldoAgora;
      if (semProgresso >= JANELA_SEM_PROGRESSO) break; // os juros comem tudo o que se paga
    }

    const quitou = ativas.every((d) => d.quitadaEm !== null);
    resultado.possivel = quitou;
    resultado.meses = quitou ? mes : 0;
    resultado.totalPago = totalPago;
    resultado.totalJuros = totalJuros;
    resultado.ordem = ativas.filter((d) => d.quitadaEm !== null).sort((a, b) => a.quitadaEm - b.quitadaEm).map((d) => ({ nome: d.nome, mes: d.quitadaEm }));
    if (!quitou) {
      avisos.push("Com esse valor por mês as dívidas não acabam: os juros somam mais do que você paga. Aumente o valor mensal ou reduza os limites do orçamento.");
    }
    return resultado;
  }

  const dinheiro = (v) => (typeof formatarMoeda === "function" ? formatarMoeda(v) : `R$ ${Number(v).toFixed(2).replace(".", ",")}`);

  /** Resultado dos dois metodos lado a lado. */
  function comparar(entrada) {
    return {
      "bola-de-neve": simular({ ...entrada, metodo: "bola-de-neve" }),
      avalanche: simular({ ...entrada, metodo: "avalanche" }),
    };
  }

  /** E se eu pagasse `extra` reais a mais por mes? (meses economizados e juros economizados, no metodo escolhido) */
  function economiaComExtra(entrada, extra) {
    const base = simular(entrada);
    const com = simular({ ...entrada, valorMensal: numero(entrada.valorMensal) + extra });
    if (!base.possivel && !com.possivel) return null;
    if (!com.possivel) return null;
    return {
      extra,
      meses: com.meses,
      mesesEconomizados: base.possivel ? base.meses - com.meses : null,
      jurosEconomizados: base.possivel ? arred(base.totalJuros - com.totalJuros) : null,
    };
  }

  const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  /** "mar/2027" daqui a `meses` meses (contando a partir do mes de `hoje`). */
  function mesAno(meses, hoje = new Date()) {
    const indice = hoje.getFullYear() * 12 + hoje.getMonth() + meses;
    return `${NOMES_MES[indice % 12]}/${Math.floor(indice / 12)}`;
  }
  const rotuloMeses = (n) => `${n} ${n === 1 ? "mês" : "meses"}`;
  function rotuloPrazo(meses) {
    if (meses < 12) return rotuloMeses(meses);
    const anos = Math.floor(meses / 12);
    const resto = meses % 12;
    return `${rotuloMeses(meses)} (${anos} ${anos === 1 ? "ano" : "anos"}${resto ? ` e ${rotuloMeses(resto)}` : ""})`;
  }

  // ------------------------------------------------------------------ tela
  const CHAVE = "mbd_calc_quitacao";

  function lerSalvo() {
    try {
      const bruto = JSON.parse(localStorage.getItem(CHAVE) || "null");
      if (bruto && Array.isArray(bruto.dividas)) return bruto;
    } catch (e) { /* storage bloqueado ou dado antigo: comeca do zero */ }
    return { dividas: [], metodo: "bola-de-neve", valorManual: null };
  }
  function gravar(estado) {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* sem storage: so' nao lembra */ }
  }

  function criarEl(tag, atributos = {}, texto) {
    const el = document.createElement(tag);
    Object.entries(atributos).forEach(([k, v]) => { if (v !== undefined && v !== null) el.setAttribute(k, v); });
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  /**
   * Monta a calculadora dentro de `raiz`. Devolve { atualizarSobra({receitas, limites}) }: a tela de Orcamentos chama
   * isso sempre que os limites mudam; enquanto a pessoa nao digitar um valor proprio, o valor mensal acompanha a sobra.
   */
  function iniciarCalculadora(raiz) {
    const estado = lerSalvo();
    let sobra = null; // receitas - limites (null = ainda nao calculada)

    raiz.textContent = "";
    raiz.append(
      criarEl("h2", {}, "Calculadora: em quanto tempo eu quito minhas dívidas?"),
      criarEl("p", { class: "hint" }, "É só uma simulação: nada é enviado nem salvo na sua conta. Sua lista de dívidas fica apenas neste aparelho."),
    );

    // valor mensal + metodo
    const linha = criarEl("div", { class: "linha-campos" });
    const campoValor = criarEl("div", { class: "campo" });
    campoValor.append(
      criarEl("label", { for: "quitacao-valor" }, "Quanto posso pagar por mês (R$)"),
      criarEl("input", { type: "number", id: "quitacao-valor", inputmode: "decimal", step: "0.01", min: "0" }),
      criarEl("p", { class: "hint", id: "quitacao-dica-valor" }),
      criarEl("button", { type: "button", class: "btn btn-secundario", id: "quitacao-usar-sobra", hidden: "" }, "Usar a sobra calculada"),
    );
    const campoMetodo = criarEl("div", { class: "campo" });
    const selectMetodo = criarEl("select", { id: "quitacao-metodo" });
    Object.entries(METODOS).forEach(([valor, rotulo]) => selectMetodo.append(criarEl("option", { value: valor }, rotulo)));
    campoMetodo.append(criarEl("label", { for: "quitacao-metodo" }, "Ordem de pagamento"), selectMetodo,
      criarEl("p", { class: "hint" }, "Bola de neve quita as menores primeiro (motiva). Avalanche ataca os maiores juros (paga menos juros)."));
    linha.append(campoValor, campoMetodo);

    // dividas
    const listaDividas = criarEl("div", { id: "quitacao-dividas" });
    const botaoAdd = criarEl("button", { type: "button", class: "btn btn-secundario", id: "quitacao-add" }, "+ Adicionar dívida");
    const resultado = criarEl("div", { id: "quitacao-resultado", class: "quitacao-resultado", role: "status", "aria-live": "polite" });
    raiz.append(linha, criarEl("h3", {}, "Minhas dívidas"), listaDividas, botaoAdd, resultado);

    const inputValor = campoValor.querySelector("#quitacao-valor");
    const dicaValor = campoValor.querySelector("#quitacao-dica-valor");
    const botaoSobra = campoValor.querySelector("#quitacao-usar-sobra");
    selectMetodo.value = estado.metodo in METODOS ? estado.metodo : "bola-de-neve";

    function valorAtual() {
      const v = Number(inputValor.value);
      return Number.isFinite(v) && v > 0 ? v : 0;
    }

    function linhaDivida(divida, indice) {
      const el = criarEl("div", { class: "quitacao-linha", "data-indice": String(indice) });
      const campo = (rotulo, atributos, chave) => {
        const c = criarEl("div", { class: "quitacao-campo" });
        const input = criarEl("input", { ...atributos, "aria-label": `${rotulo} da dívida ${indice + 1}` });
        input.value = divida[chave] === undefined || divida[chave] === null || divida[chave] === "" ? "" : String(divida[chave]);
        input.addEventListener("input", () => { estado.dividas[indice][chave] = input.value; gravar(estado); recalcular(); });
        c.append(criarEl("span", { class: "quitacao-rotulo" }, rotulo), input);
        return c;
      };
      const remover = criarEl("button", { type: "button", class: "quitacao-remover", "aria-label": `Remover a dívida ${indice + 1}` }, "Remover");
      remover.addEventListener("click", () => { estado.dividas.splice(indice, 1); gravar(estado); desenharDividas(); recalcular(); });
      el.append(
        campo("Nome", { type: "text", maxlength: "60", placeholder: "Ex.: cartão, financiamento" }, "nome"),
        campo("Saldo devedor (R$)", { type: "number", inputmode: "decimal", step: "0.01", min: "0" }, "saldo"),
        campo("Juros ao mês (%)", { type: "number", inputmode: "decimal", step: "0.01", min: "0" }, "jurosMensal"),
        campo("Parcela mínima (R$)", { type: "number", inputmode: "decimal", step: "0.01", min: "0" }, "minima"),
        remover,
      );
      return el;
    }
    function desenharDividas() {
      listaDividas.textContent = "";
      estado.dividas.forEach((d, i) => listaDividas.append(linhaDivida(d, i)));
    }

    function desenharSobra() {
      const manual = estado.valorManual !== null && estado.valorManual !== undefined;
      if (sobra === null) {
        dicaValor.textContent = "Não consegui calcular sua sobra automaticamente; digite o valor.";
      } else if (sobra <= 0) {
        dicaValor.textContent = `Seus limites (${manual ? "" : "já "}somados) passam das receitas deste mês: não sobra nada. Reduza limites ou digite um valor.`;
      } else {
        dicaValor.textContent = manual
          ? `Sobra calculada: ${dinheiro(sobra)} (receitas do mês menos os limites). Você está usando um valor seu.`
          : `Sobra calculada: ${dinheiro(sobra)} (receitas do mês menos os limites). Muda sozinha quando você altera um limite.`;
      }
      botaoSobra.hidden = !(manual && sobra !== null && sobra > 0);
    }

    function recalcular() {
      resultado.textContent = "";
      const dividas = estado.dividas;
      const entrada = { dividas, valorMensal: valorAtual(), metodo: selectMetodo.value };
      const temDivida = dividas.some((d) => numero(d.saldo) > 0);
      if (!temDivida) {
        resultado.append(criarEl("p", { class: "hint" }, "Adicione suas dívidas (saldo, juros e parcela mínima) para ver em quanto tempo você fica livre."));
        return;
      }
      const escolhido = simular(entrada);
      const caixa = criarEl("div", { class: escolhido.possivel ? "quitacao-destaque" : "quitacao-destaque quitacao-alerta" });
      if (escolhido.possivel) {
        caixa.append(criarEl("p", { class: "quitacao-titulo" }, "Você fica livre das dívidas em"),
          criarEl("p", { class: "quitacao-numero" }, rotuloPrazo(escolhido.meses)),
          criarEl("p", { class: "hint" }, `Previsão: ${mesAno(escolhido.meses)} (pagando ${dinheiro(valorAtual())} por mês).`));
      } else {
        caixa.append(criarEl("p", { class: "quitacao-titulo" }, "Com esse valor não dá para quitar"));
      }
      resultado.append(caixa);

      escolhido.avisos.forEach((texto) => resultado.append(criarEl("p", { class: "alerta alerta-erro quitacao-aviso" }, texto)));
      if (!escolhido.possivel) return;

      const detalhes = criarEl("ul", { class: "quitacao-detalhes" });
      [`Total das dívidas hoje: ${dinheiro(escolhido.dividaTotal)}`, `Juros que você vai pagar: ${dinheiro(escolhido.totalJuros)}`,
        `Total pago até quitar tudo: ${dinheiro(escolhido.totalPago)}`].forEach((t) => detalhes.append(criarEl("li", {}, t)));
      resultado.append(detalhes);

      if (escolhido.ordem.length > 1) {
        resultado.append(criarEl("h3", {}, "Ordem em que cada dívida quita"));
        const ol = criarEl("ol", { class: "quitacao-ordem" });
        escolhido.ordem.forEach((o) => ol.append(criarEl("li", {}, `${o.nome}: quitada em ${rotuloMeses(o.mes)} (${mesAno(o.mes)})`)));
        resultado.append(ol);
      }

      const dois = comparar(entrada);
      if (dois["bola-de-neve"].possivel && dois.avalanche.possivel) {
        const n = dois["bola-de-neve"]; const a = dois.avalanche;
        const dif = arred(n.totalJuros - a.totalJuros);
        const linhaComp = `Bola de neve: ${rotuloMeses(n.meses)} e ${dinheiro(n.totalJuros)} de juros. Avalanche: ${rotuloMeses(a.meses)} e ${dinheiro(a.totalJuros)} de juros.`
          + (dif > 0.005 ? ` A avalanche economiza ${dinheiro(dif)} em juros.` : " Nesse caso os dois dão o mesmo resultado.");
        resultado.append(criarEl("h3", {}, "Comparando as duas ordens"), criarEl("p", { class: "hint" }, linhaComp));
      }

      const e100 = economiaComExtra(entrada, 100);
      if (e100 && e100.mesesEconomizados > 0) {
        resultado.append(criarEl("p", { class: "quitacao-dica" },
          `Dica: pagando ${dinheiro(100)} a mais por mês você fica livre em ${rotuloMeses(e100.meses)} (${rotuloMeses(e100.mesesEconomizados)} antes) e economiza ${dinheiro(e100.jurosEconomizados)} em juros.`));
      }
    }

    // eventos
    inputValor.addEventListener("input", () => {
      estado.valorManual = inputValor.value === "" ? null : Number(inputValor.value);
      gravar(estado);
      desenharSobra();
      recalcular();
    });
    botaoSobra.addEventListener("click", () => {
      estado.valorManual = null;
      gravar(estado);
      if (sobra !== null) inputValor.value = String(Math.max(0, sobra));
      desenharSobra();
      recalcular();
    });
    selectMetodo.addEventListener("change", () => { estado.metodo = selectMetodo.value; gravar(estado); recalcular(); });
    botaoAdd.addEventListener("click", () => {
      estado.dividas.push({ nome: "", saldo: "", jurosMensal: "", minima: "" });
      gravar(estado);
      desenharDividas();
      const ultima = listaDividas.querySelector(".quitacao-linha:last-child input");
      if (ultima) ultima.focus();
      recalcular();
    });

    // estado inicial
    if (estado.valorManual !== null && estado.valorManual !== undefined) inputValor.value = String(estado.valorManual);
    desenharDividas();
    desenharSobra();
    recalcular();

    return {
      /** receitas e limites do mes (numeros); chamada toda vez que os orcamentos mudam */
      atualizarSobra({ receitas, limites }) {
        sobra = receitas === null || receitas === undefined ? null : arred(Number(receitas) - Number(limites || 0));
        if (estado.valorManual === null || estado.valorManual === undefined) inputValor.value = sobra !== null ? String(Math.max(0, sobra)) : "";
        desenharSobra();
        recalcular();
      },
    };
  }

  return { simular, comparar, economiaComExtra, mesAno, rotuloPrazo, iniciarCalculadora, METODOS };
})();
