# Fase 3 — Validação e preparação de correções

**Branch:** `security/phase-3-validation`  
**Base de trabalho:** commit da Fase 2 (relatório de auditoria), sem alteração da branch `main`.

## O que foi preparado

1. Workflow GitHub Actions em `.github/workflows/security-validation.yml` para executar:
   - `npm ci` usando o lockfile;
   - verificação de que `.env` não está versionado;
   - `npm audit --audit-level=high`;
   - `npm run lint`;
   - `npm run build`.
2. `.env.example` com nomes de variáveis de cliente e sem valores de credenciais.
3. Remoção de `.env` da árvore da branch de trabalho. Isso **não apaga versões anteriores do histórico Git**. Se for encontrado qualquer segredo real no histórico, revogá-lo/rotacioná-lo; não publicar o valor.
4. Este relatório documenta o estado dos testes e o plano de correção.

## Evidências coletadas

- O `package.json` declara scripts `lint` e `build`, mas não declara script `test`.
- O lockfile npm existe e declara Vite `^5.4.21` na branch de hardening.
- Não foram encontrados workflows de CI na árvore analisada e a consulta de status/execuções para o commit da Fase 1 retornou listas vazias.
- A tentativa de clonar o repositório para executar os comandos localmente falhou porque o ambiente de execução não conseguiu resolver/acessar `github.com`. Nenhum comando npm foi declarado como aprovado.
- A análise estática da Fase 2 identificou ausência de migrations SQL no repositório e não pôde confirmar políticas RLS, grants, funções remotas ou segredos do painel Supabase.

## Estado dos testes nesta execução

| Verificação | Estado | Evidência/observação |
|---|---|---|
| `npm ci` | Não executado | Requer checkout e acesso ao registry npm |
| `npm audit --audit-level=high` | Não executado | Workflow preparado para executar no GitHub Actions |
| `npm run lint` | Não executado | Workflow preparado para executar no GitHub Actions |
| `npm run build` | Não executado | Workflow preparado para executar no GitHub Actions |
| Testes unitários/integrados | Não configurados | `package.json` não possui script `test` |
| RLS/grants/funções no Supabase | Pendente | Requer acesso autenticado somente leitura ao projeto remoto |
| Segredos remotos | Pendente | Valores não solicitados nem expostos; revisar nomes e locais no painel |
| Dados de produção | Não acessados | Nenhuma consulta ou alteração de dados executada |

## Correções preparadas e próximas correções

### Preparadas nesta branch
- Remover o arquivo de ambiente da versão atual do código e disponibilizar um exemplo sem valores.
- Adicionar pipeline reproduzível de instalação, auditoria de dependências, lint e build.
- Fazer a pipeline falhar caso `.env` volte a ser rastreado ou a auditoria npm encontre vulnerabilidades de severidade alta/crítica.

### Ainda exigem implementação e/ou evidência adicional
1. **Edge Function `virustotal-scan`:** antes de alterar comportamento usado pelo frontend, definir o modelo de autenticação, quota/rate limiting no servidor e formato de erros. Não é seguro presumir que o endpoint possa exigir sessão sem validar o fluxo de login e os consumidores existentes.
2. **Supabase:** exportar apenas schema/policies/metadados (sem linhas de usuários) e revisar RLS, grants, funções SECURITY DEFINER, search_path e permissões.
3. **Segredos:** revisar histórico Git e configuração remota; rotacionar qualquer segredo que tenha sido versionado. Uma remoção no commit atual não limpa o histórico.
4. **Testes:** criar testes automatizados específicos para licenciamento e Edge Function após definir os contratos esperados; atualmente não há script de testes declarado.

## Critério para aprovar/mesclar

Não mesclar esta branch até o workflow ter execução concluída e revisada. Investigar qualquer falha em vez de desabilitar a verificação. A auditoria de produção e as correções da Edge Function permanecem bloqueadas até confirmar autenticação e configuração real do projeto. Nenhuma mudança foi aplicada à branch `main` nem implantada no Supabase.
