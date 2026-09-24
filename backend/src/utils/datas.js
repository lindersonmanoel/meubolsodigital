"use strict";

/**
 * O driver do Postgres (pg) devolve colunas DATE como objeto Date do JavaScript, construido
 * com os componentes ano/mes/dia em horario LOCAL (nao UTC) - por isso ler de volta com
 * getFullYear()/getMonth()/getDate() (tambem locais) da' a data certa em qualquer fuso do
 * servidor. Usar toISOString() aqui seria um bug (converte pra UTC e pode voltar o dia
 * errado dependendo do fuso), e usar String()/toString() direto no objeto Date da' o formato
 * verboso do JavaScript ("Thu Mar 05 2026 00:00:00 GMT..."), nao "AAAA-MM-DD".
 */
function paraDataISO(valor) {
  if (!valor) return "";
  if (valor instanceof Date) {
    const ano = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, "0");
    const dia = String(valor.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }
  return String(valor).slice(0, 10);
}

/** "2026-03-05" -> "05/03/2026". Aceita tanto string quanto Date (via paraDataISO). */
function paraDataBR(valor) {
  const iso = paraDataISO(valor);
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** "AAAA-MM-DD" que existe de verdade no calendario (rejeita 2026-02-31, 2026-13-01, 2026-02-29...).
 * Date.parse aceita dias que nao existem (vira o mes seguinte), e o PostgreSQL recusa - dai o erro 500. */
function dataValida(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

module.exports = { paraDataISO, paraDataBR, dataValida };
