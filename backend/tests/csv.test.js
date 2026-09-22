"use strict";

const { paraCsv } = require("../src/utils/csv");

describe("utils/csv", () => {
  test("neutraliza injeção de fórmula (=, +, -, @) prefixando com apóstrofo", () => {
    const csv = paraCsv(
      [
        { nome: "=HYPERLINK(\"http://mal.example\")" },
        { nome: "+1+1" },
        { nome: "-1+1" },
        { nome: "@SUM(1+1)" },
        { nome: "Compras normais" },
      ],
      [{ chave: "nome", rotulo: "Nome" }]
    );
    const linhas = csv.split("\n").slice(1);
    expect(linhas[0].startsWith('"\'=')).toBe(true);
    expect(linhas[1].startsWith("'+1+1")).toBe(true);
    expect(linhas[2].startsWith("'-1+1")).toBe(true);
    expect(linhas[3].startsWith("'@SUM")).toBe(true);
    expect(linhas[4]).toBe("Compras normais");
  });

  test("escapa vírgula, ponto e vírgula, aspas e quebra de linha", () => {
    const csv = paraCsv([{ nome: 'Ele disse "oi"; tchau' }], [{ chave: "nome", rotulo: "Nome" }]);
    expect(csv).toContain('"Ele disse ""oi""; tchau"');
  });

  test("começa com BOM UTF-8 (Excel abre acentos certo)", () => {
    const csv = paraCsv([], [{ chave: "x", rotulo: "X" }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});
