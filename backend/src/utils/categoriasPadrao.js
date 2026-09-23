"use strict";

// Categorias criadas automaticamente pra toda conta nova, pra a pessoa poder classificar
// receitas e despesas desde o primeiro uso (depois ela edita/exclui/cria as que quiser).
// A migracao database/migrations/005_categorias_padrao.sql repete esta lista pra contas antigas.
const CATEGORIAS_PADRAO = [
  { nome: "Alimentação", tipo: "despesa" },
  { nome: "Moradia", tipo: "despesa" },
  { nome: "Contas e serviços", tipo: "despesa" },
  { nome: "Transporte", tipo: "despesa" },
  { nome: "Saúde", tipo: "despesa" },
  { nome: "Educação", tipo: "despesa" },
  { nome: "Lazer", tipo: "despesa" },
  { nome: "Compras", tipo: "despesa" },
  { nome: "Outras despesas", tipo: "despesa" },
  { nome: "Salário", tipo: "receita" },
  { nome: "Renda extra", tipo: "receita" },
  { nome: "Investimentos", tipo: "receita" },
  { nome: "Outras receitas", tipo: "receita" },
];

module.exports = { CATEGORIAS_PADRAO };
