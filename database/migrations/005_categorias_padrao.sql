-- Meu Bolso Digital - categorias padrao pra contas que ja existiam sem nenhuma categoria.
-- Contas novas ja recebem a mesma lista no cadastro (backend/src/utils/categoriasPadrao.js).
-- So mexe em quem tem ZERO categorias: nao recria o que alguem apagou de proposito.

INSERT INTO categorias (usuario_id, nome, tipo)
SELECT u.id, c.nome, c.tipo
FROM usuarios u
CROSS JOIN (VALUES
    ('Alimentação', 'despesa'),
    ('Moradia', 'despesa'),
    ('Contas e serviços', 'despesa'),
    ('Transporte', 'despesa'),
    ('Saúde', 'despesa'),
    ('Educação', 'despesa'),
    ('Lazer', 'despesa'),
    ('Compras', 'despesa'),
    ('Outras despesas', 'despesa'),
    ('Salário', 'receita'),
    ('Renda extra', 'receita'),
    ('Investimentos', 'receita'),
    ('Outras receitas', 'receita')
) AS c(nome, tipo)
WHERE NOT EXISTS (SELECT 1 FROM categorias x WHERE x.usuario_id = u.id)
ON CONFLICT DO NOTHING;
