"use strict";

/** Escapa um valor pro formato CSV (RFC 4180): aspas duplicadas, campo entre aspas se tiver
 * vírgula, aspas ou quebra de linha. Também neutraliza "injeção de fórmula": se o texto vem
 * de um campo digitado pela pessoa (descrição, observação...) e começa com =, +, -, @, tab
 * ou CR, o Excel/Sheets pode interpretar como fórmula ao abrir o arquivo - um prefixo de
 * apóstrofo evita isso sem mudar o que aparece pra quem le. */
function escaparCampo(valor) {
  let texto = valor == null ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  if (/[",\n;]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

/** Monta um CSV a partir de uma lista de objetos e a definição das colunas
 * ([{chave, rotulo}]). Sempre com BOM UTF-8 na frente, pro Excel abrir os acentos certo. */
function paraCsv(linhas, colunas) {
  const cabecalho = colunas.map((c) => escaparCampo(c.rotulo)).join(";");
  // c.formato (opcional): transforma o valor antes de escrever (ex.: numero com virgula decimal).
  // c.numerico: o resultado do formato e' um numero puro ("1234,50") e sai SEM aspas (o separador e' ";", entao a
  // virgula nao precisa de escape) - o Excel em portugues le direto como numero. Texto digitado continua escapado.
  const celula = (linha, c) => {
    const valor = c.formato ? c.formato(linha[c.chave]) : linha[c.chave];
    return c.numerico ? String(valor) : escaparCampo(valor);
  };
  const corpo = linhas.map((linha) => colunas.map((c) => celula(linha, c)).join(";")).join("\n");
  return "﻿" + cabecalho + "\n" + corpo + "\n";
}

/** 1234.5 -> "1234,50": o Excel em portugues (separador ";") le "12.50" como texto ou data, e "12,50" como numero. */
function decimalBR(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n.toFixed(2).replace(".", ",") : "";
}

module.exports = { paraCsv, decimalBR };
