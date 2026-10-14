# Fase 2 — Auditoria de segurança do Supabase

**Escopo:** revisão estática e somente leitura do repositório. Nenhuma consulta autenticada ao projeto Supabase, alteração de schema, gravação em tabelas, mudança de políticas ou rotação de segredos foi realizada.

**Projeto Supabase configurado no repositório:** identificador de projeto presente em `supabase/config.toml`. Credenciais e valores de configuração sensíveis não são reproduzidos neste relatório.

## Resultado executivo

A auditoria do código **não permite atestar a segurança do banco de produção**. O repositório não contém migrations SQL versionadas e os tipos gerados em `src/integrations/supabase/types.ts` declaram zero tabelas, views e funções no schema `public`. Portanto, não há evidência versionada suficiente para verificar RLS, grants, funções SQL, triggers ou permissões efetivas do projeto remoto.

## Achados

### F2-01 — RLS, grants e funções SQL não verificáveis pelo repositório
- **Severidade:** Alta (lacuna de evidência; não é prova de política ausente).
- **Evidência:** não foram encontrados arquivos `.sql` de migrations no repositório; os tipos do banco não listam tabelas, views ou funções.
- **Impacto:** políticas RLS ausentes ou permissivas, grants excessivos e funções com privilégios elevados não podem ser excluídos.
- **Ação recomendada:** obter um inventário somente leitura do projeto Supabase (tabelas e schemas expostos, estado de RLS, policies, grants, funções e configuração de privilégios), exportar migrations/schema sem dados de usuários e revisar antes de qualquer mudança.

### F2-02 — Arquivo `.env` está versionado
- **Severidade:** Média, podendo tornar-se alta se algum segredo tiver sido incluído em qualquer versão.
- **Evidência:** `.env` aparece como arquivo rastreado na árvore Git de `main`. A auditoria não reproduz seu conteúdo.
- **Impacto:** credenciais acidentalmente adicionadas ao arquivo podem permanecer acessíveis no histórico mesmo após a remoção do arquivo.
- **Ação recomendada:** verificar localmente, sem publicar valores, se há somente URL e chave publicável do Supabase. Procurar segredos também no histórico Git e nos logs. Se algum segredo real tiver sido versionado, revogá-lo/rotacioná-lo. Remover o arquivo do índice Git em uma alteração revisada e manter apenas um `.env.example` sem valores reais. A regra do `.gitignore` sozinha não desversiona um arquivo já rastreado.

### F2-03 — Edge Function `virustotal-scan` sem controles visíveis de acesso e abuso
- **Severidade:** Alta se a função estiver publicada como endpoint público.
- **Evidência:** `supabase/functions/virustotal-scan/index.ts` não mostra validação de sessão/JWT, autorização, rate limiting ou quota por usuário/IP. Aceita alvos arbitrários e consome a API externa VirusTotal.
- **Impacto:** uso não autorizado pode consumir a quota/chave VirusTotal ou gerar custos/indisponibilidade. Os cabeçalhos CORS importados devem ser confirmados na versão da dependência e na configuração implantada.
- **Ação recomendada:** confirmar a configuração real de verificação JWT da função. Se não for deliberadamente pública, exigir autenticação e autorização. Adicionar rate limiting/quota no servidor, limite de tamanho e validação estrita de URL (incluindo rejeitar credenciais embutidas), limites de tempo e respostas de erro sanitizadas. Não confiar em limites aplicados apenas no cliente.

### F2-04 — Detalhes de erro retornados ao cliente
- **Severidade:** Média.
- **Evidência:** a função pode devolver o texto bruto do erro da API externa em `detail` e a mensagem da exceção em `error`.
- **Impacto:** respostas podem revelar detalhes operacionais desnecessários.
- **Ação recomendada:** registrar detalhes somente em logs protegidos do servidor e devolver mensagens genéricas com um identificador de correlação.

### F2-05 — Inventário de segredos remotos não acessível nesta revisão
- **Severidade:** Pendente de verificação.
- **Evidência:** o acesso usado para esta fase permite inspecionar o repositório, mas não fornece leitura autenticada do cofre de segredos do projeto Supabase.
- **Impacto:** não foi possível confirmar presença, nomes, rotação ou exposição de segredos remotos.
- **Ação recomendada:** no painel Supabase, revisar Edge Function Secrets e integrações; confirmar que a chave VirusTotal é definida como segredo do servidor e que nenhuma chave `service_role`/secret key aparece em `VITE_*`, bundle do navegador, logs ou Git. Não compartilhar valores secretos no relatório.

## Verificações realizadas

- Árvore Git e diretório `supabase/`: somente `config.toml` e a função `virustotal-scan`; nenhuma migration SQL foi encontrada.
- Tipos do banco gerados: nenhuma tabela, view ou função pública declarada.
- Cliente Supabase: usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; chaves publicáveis podem estar no cliente, desde que políticas e privilégios do banco sejam seguros.
- Edge Function: revisão estática da validação de entrada, autenticação visível, consumo da API externa e tratamento de erros.
- Arquivo `.env`: confirmado como rastreado; seus valores não foram exibidos no relatório.

## Limitações e próximos passos

Esta foi uma análise estática do código no GitHub, sem acesso administrativo autenticado ao Supabase e sem testes de intrusão. Não foi possível consultar as políticas RLS efetivas, privilégios do banco, configuração implantada da Edge Function ou segredos armazenados remotamente. Nenhum dado de produção foi consultado ou alterado. Não declare o projeto seguro com base apenas neste relatório.

**Próxima etapa segura:** realizar exportação/inventário somente leitura do schema e das policies do Supabase, sem exportar dados pessoais; revisar a configuração da Edge Function e a lista de nomes de segredos sem revelar seus valores; depois preparar correções em branch e validá-las em ambiente de teste antes de qualquer implantação.
