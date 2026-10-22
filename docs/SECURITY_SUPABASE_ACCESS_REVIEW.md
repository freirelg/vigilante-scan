# Revisão de segurança — Supabase (repositório)

**Data:** 2026-10-22  
**Escopo:** revisão estática do código versionado; sem alterações no banco ou em configurações de produção.

## Resultado executivo

**Status: NÃO É POSSÍVEL CERTIFICAR a proteção do projeto Supabase em produção apenas pelo repositório.** Foram encontrados riscos no código da branch `main` e lacunas de evidência sobre o banco e a configuração remota.

## Evidências no repositório

### 1. Edge Function `virustotal-scan` — risco alto a confirmar na implantação

Arquivo: `supabase/functions/virustotal-scan/index.ts`

Na branch `main`, a função:
- não faz validação explícita de usuário/sessão nem de autorização no próprio código;
- aceita requisições JSON sem impor método HTTP, tamanho máximo do corpo ou limite de frequência;
- repassa detalhes do erro do VirusTotal ao cliente;
- não define timeout explícito para as chamadas externas;
- pode ser abusada para consumir a cota da chave `VIRUSTOTAL_API_KEY`, caso a implantação permita chamadas anônimas.

A branch de hardening atual adiciona validação de método, corpo, URL e timeout, e reduz detalhes expostos. **Isso não equivale a autenticação nem a rate limiting.**

A proteção real também depende da configuração da Edge Function no Supabase (por exemplo, validação JWT ativada e configuração de gateway). O arquivo `supabase/config.toml` versionado contém apenas `project_id`; não registra uma configuração explícita de `verify_jwt`. Não foi possível confirmar a configuração atualmente implantada.

### 2. Banco de dados / RLS — não verificável com os arquivos disponíveis

- Não foram encontrados arquivos de migração SQL nem políticas RLS versionadas no repositório.
- O arquivo `src/integrations/supabase/types.ts` declara zero tabelas, views e funções no schema público; isso é apenas tipagem do cliente, não prova que o banco remoto esteja vazio.
- Não há evidência versionada suficiente para confirmar quais tabelas existem no Supabase, se RLS está habilitado em cada tabela, ou se as políticas restringem linhas por usuário.
- Não foi executada consulta autenticada ao catálogo do banco nem teste de acesso anônimo/autenticado. Portanto, não se deve afirmar que o banco está protegido ou vulnerável sem essa verificação.

### 3. Variáveis de ambiente

A branch `main` contém um arquivo `.env` versionado com URL/ID do projeto e chave publicável Supabase. Chaves publicáveis são destinadas ao cliente e não substituem RLS; ainda assim, o arquivo não deve ser versionado. A branch de hardening remove esse arquivo do branch e adiciona `.env.example`. A remoção do arquivo em um commit não o apaga do histórico Git.

## Ações recomendadas para fechar a auditoria

1. No Supabase Dashboard, revisar **Edge Functions** e confirmar que `virustotal-scan` exige JWT, salvo decisão consciente de permitir acesso público.
2. Se o recurso for para usuários autenticados, validar a sessão no servidor e aplicar autorização; não confiar apenas em controles de interface.
3. Aplicar rate limiting por usuário/IP e cotas para impedir abuso da chave VirusTotal. Definir limites de concorrência e timeout.
4. No SQL Editor do Supabase, inventariar tabelas, views, funções, grants e estado RLS. Para cada tabela exposta pela API, confirmar RLS habilitado e políticas mínimas de SELECT/INSERT/UPDATE/DELETE.
5. Testar com três contextos: sem sessão, usuário A e usuário B; confirmar que cada um só acessa os próprios dados e que operações negadas falham.
6. Confirmar que `VIRUSTOTAL_API_KEY` existe apenas como secret de Edge Function e nunca no frontend.
7. Se uma chave privilegiada ou senha real tiver sido exposta no histórico, rotacioná-la; apagar o arquivo do branch não elimina cópias históricas.

## Limites desta revisão

Esta revisão foi estática e limitada ao conteúdo GitHub acessível. Não alterou dados, tabelas, políticas ou configurações do projeto Supabase. Não confirma a configuração remota, os secrets cadastrados, o schema real, nem a implantação ativa da função.
