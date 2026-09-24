"use strict";

// Fuso unico do app pra decidir "que dia/mes e' hoje". Sem isso, o servidor (UTC em Docker/Railway)
// vira o mes 3 horas antes de Brasilia: entre 21h e 23h59 do ultimo dia do mes o app ja achava que
// era o mes seguinte (cartoes zerados, orcamentos reiniciando, recorrencias do dia 1 lancadas cedo).
// O Brasil nao tem horario de verao desde 2019 (America/Sao_Paulo = UTC-3 o ano todo).
const FUSO = "America/Sao_Paulo";

const formatador = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
});

/** { ano, mes (1-12), dia } do instante informado, no fuso do app. */
function partesNoFuso(instante = new Date()) {
  const [ano, mes, dia] = formatador.format(instante).split("-").map(Number);
  return { ano, mes, dia };
}

/** "AAAA-MM" do mes atual no fuso do app. */
function anoMesAtual(instante = new Date()) {
  const { ano, mes } = partesNoFuso(instante);
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

/** "AAAA-MM-01": primeiro dia do mes atual no fuso do app. */
function inicioDoMesAtual(instante = new Date()) {
  return `${anoMesAtual(instante)}-01`;
}

module.exports = { FUSO, partesNoFuso, anoMesAtual, inicioDoMesAtual };
