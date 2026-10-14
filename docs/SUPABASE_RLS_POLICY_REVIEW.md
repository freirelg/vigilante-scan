# Revisão de políticas RLS do Supabase

**Status:** auditoria preparada; políticas remotas ainda não verificadas.  
**Escopo:** consultas somente de leitura para inventariar tabelas, estado de RLS, políticas por operação e privilégios.  
**Segurança:** não execute alterações de política antes de confirmar nomes de tabelas, coluna de propriedade e comportamento esperado. Nenhuma consulta deste documento modifica dados ou configuração.

## Limitação atual

O repositório não contém migrations SQL que descrevam o schema remoto, e os tipos gerados do cliente não listam tabelas públicas. O acesso disponível nesta auditoria é ao GitHub, não ao SQL Editor autenticado do projeto Supabase. Portanto, não é possível afirmar que as políticas de produção foram revisadas ou que usuários anônimos estejam bloqueados.

## 1. Inventário de tabelas e estado de RLS

Execute no Supabase SQL Editor:

```sql
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls,
  CASE WHEN c.relkind = 'p' THEN 'partitioned_table' ELSE 'table' END AS table_kind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
ORDER BY n.nspname, c.relname;
```

Compare o resultado com os schemas configurados como expostos pela API. Uma tabela fora de um schema exposto ainda pode ser acessível por funções, views ou outros caminhos privilegiados.

## 2. Detalhes de todas as políticas

```sql
SELECT
  schemaname AS schema_name,
  tablename AS table_name,
  policyname AS policy_name,
  permissive,
  roles,
  cmd AS operation,
  qual AS using_expression,
  with_check AS check_expression
FROM pg_policies
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename, cmd, policyname;
```

Revisar as expressões `USING` e `WITH CHECK`, os papéis destinatários e se a política é permissiva (`PERMISSIVE`) ou restritiva (`RESTRICTIVE`). Políticas permissivas para a mesma operação normalmente combinam-se com OR; políticas restritivas adicionam uma condição AND. A ausência de uma política permissiva pode bloquear a operação, mas privilégios SQL e funções privilegiadas também precisam ser avaliados.

## 3. Matriz de políticas por operação

```sql
WITH inventory AS (
  SELECT n.nspname AS schema_name,
         c.relname AS table_name,
         c.relrowsecurity AS rls_enabled,
         c.relforcerowsecurity AS force_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p')
    AND n.nspname = 'public'
),
operations AS (
  SELECT unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) AS operation
)
SELECT
  i.schema_name,
  i.table_name,
  i.rls_enabled,
  i.force_rls,
  o.operation,
  COUNT(p.policyname) AS matching_policy_count,
  COALESCE(
    string_agg(
      p.policyname || ' [roles=' || array_to_string(p.roles, ',') ||
      ', mode=' || p.permissive || ']',
      '; '
    ),
    'Nenhuma política explícita para esta operação'
  ) AS policy_names
FROM inventory i
CROSS JOIN operations o
LEFT JOIN pg_policies p
  ON p.schemaname = i.schema_name
 AND p.tablename = i.table_name
 AND (p.cmd = o.operation OR p.cmd = 'ALL')
GROUP BY i.schema_name, i.table_name, i.rls_enabled, i.force_rls, o.operation
ORDER BY i.table_name, o.operation;
```

Esta matriz é uma triagem, não uma conclusão automática: inspecione as expressões completas da seção 2, os privilégios, views e funções.

## 4. Privilégios SQL concedidos

```sql
SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, grantee, privilege_type;
```

Investigue especialmente concessões a `anon`, `authenticated`, `PUBLIC` e papéis personalizados, considerando os schemas efetivamente expostos pela API.

## 5. Critérios de aprovação por operação

- **SELECT:** dados privados filtrados pela identidade do usuário; `anon` não pode ler registros privados.
- **INSERT:** `WITH CHECK` garante que o registro criado pertence ao usuário autenticado; não confiar em `user_id` fornecido pelo cliente sem validá-lo.
- **UPDATE:** `USING` restringe os registros que podem ser selecionados para alteração e `WITH CHECK` impede que a alteração transfira o registro para outro proprietário.
- **DELETE:** `USING` restringe a exclusão aos registros que o usuário pode administrar.
- **Dados públicos intencionais:** documentar a finalidade e limitar colunas/operações; leitura pública não implica escrita pública.
- **Sem coluna de proprietário:** determinar o modelo de autorização antes de criar políticas; nem toda tabela é necessariamente propriedade individual de um usuário.
- **Funções e views:** revisar SECURITY DEFINER, search_path, grants de execução e se contornam a intenção das políticas.

Para tabelas privadas com coluna de proprietário, um padrão comum é comparar essa coluna com `auth.uid()`. Não copie uma política genérica sem confirmar o nome e o tipo da coluna, o modelo de acesso e a necessidade de papéis administrativos.

## 6. Testes necessários antes de declarar protegido

1. Testar como usuário anônimo: leitura e escrita de cada tabela exposta devem falhar, salvo exceção pública documentada.
2. Testar com usuário A e usuário B: A não deve ler, atualizar nem excluir registros de B.
3. Tentar inserir um registro com o identificador de proprietário de B; a operação deve ser recusada.
4. Tentar alterar o proprietário de um registro de A para B; a operação deve ser recusada quando a propriedade for imutável.
5. Testar cada operação separadamente e validar erros esperados sem usar dados reais sensíveis.
6. Revisar grants, views, RPCs e funções privilegiadas; RLS isoladamente não cobre todos os caminhos de acesso.

Faça testes em ambiente de desenvolvimento/staging com contas de teste. Não compartilhe tokens, chaves secretas, dados pessoais ou exportações de linhas reais no relatório.

## Estado atual e próximo passo

- Inventário remoto de tabelas: **pendente de execução no projeto Supabase**.
- Políticas SELECT/INSERT/UPDATE/DELETE: **pendentes de inspeção das expressões reais**.
- Isolamento entre usuários e acesso anônimo: **não comprovados**.
- Alterações de políticas de produção: **nenhuma realizada**.

Após executar as consultas, registre os resultados de metadados e as expressões de política (sem dados de usuários ou segredos). Só então prepare correções específicas, revisáveis e testáveis numa branch separada.
