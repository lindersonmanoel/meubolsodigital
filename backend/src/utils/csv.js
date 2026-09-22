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
  const corpo = linhas.map((linha) => colunas.map((c) => escaparCampo(linha[c.chave])).join(";")).join("\n");
  return "﻿" + cabecalho + "\n" + corpo + "\n";
}

module.exports = { paraCsv };
