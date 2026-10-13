# Auditoria de segurança — Vigilante Scan

Data da revisão: 2026-10-13
Branch de correção: `security/audit-hardening`
Base: `main`

## Escopo e limitações

Revisão estática dos arquivos do repositório, com foco no cliente React/Vite, integração Supabase, analisador de senhas e Edge Function `virustotal-scan`. Não foram executados testes dinâmicos contra o ambiente publicado, testes de build, testes Deno, varredura de dependências ou revisão de políticas RLS no projeto Supabase. Portanto, este documento separa achados de código de riscos que exigem validação externa.

## Achados

### VIG-001 — Validação insuficiente do alvo enviado ao VirusTotal
- **Prioridade:** Alta
- **Arquivo:** `supabase/functions/virustotal-scan/index.ts`
- **Evidência:** a função aceitava strings HTTP(S) após validação básica e não rejeitava credenciais na URL, nomes locais ou endereços IP privados/reservados.
- **Impacto:** uso indevido da integração e consumo da cota de análise; envio de alvos internos/locais ao serviço externo. Não é evidência, por si só, de SSRF no servidor da aplicação, pois o servidor submete a URL ao VirusTotal em vez de buscá-la diretamente.
- **Correção nesta branch:** validação de método e Content-Type, limite do corpo, protocolos HTTP/HTTPS, ausência de credenciais e bloqueio de hostnames locais e IPs privados/reservados.

### VIG-002 — Chamadas externas sem timeout explícito
- **Prioridade:** Média/Alta
- **Arquivo:** `supabase/functions/virustotal-scan/index.ts`
- **Evidência:** chamadas `fetch` ao VirusTotal sem `AbortSignal`.
- **Impacto:** consumo prolongado de recursos e respostas demoradas se o fornecedor não responder.
- **Correção nesta branch:** timeout por requisição externa.

### VIG-003 — Mensagens de erro externas expostas ao cliente
- **Prioridade:** Média
- **Arquivo:** `supabase/functions/virustotal-scan/index.ts`
- **Evidência:** resposta continha corpo bruto do erro do VirusTotal e mensagens originais de exceções.
- **Impacto:** divulgação de detalhes desnecessários de integração.
- **Correção nesta branch:** mensagens genéricas para o cliente; detalhes técnicos não são devolvidos na resposta.

### VIG-004 — Arquivo .env versionado
- **Prioridade:** Média (higiene preventiva)
- **Arquivos:** `.env`, `.gitignore`
- **Evidência:** o arquivo `.env` estava versionado. Os valores vistos eram o ID do projeto, URL e chave publicável do Supabase; não foi identificada chave secreta de servidor no conteúdo revisado.
- **Impacto:** risco de futuros segredos serem adicionados e publicados por engano.
- **Correção nesta branch:** remover `.env` do repositório, ignorar arquivos de ambiente e adicionar `.env.example` com placeholders. Configurar variáveis no Lovable/ambiente de deploy antes de testar a aplicação.

### VIG-005 — Limitação de uso/rate limiting não demonstrada
- **Prioridade:** Alta antes de produção pública
- **Arquivo:** Edge Function `virustotal-scan`
- **Evidência:** não foi encontrado controle de frequência na função analisada.
- **Impacto:** abuso do endpoint e consumo de cota/custos.
- **Ação necessária:** implementar rate limiting no servidor, idealmente com usuário autenticado e contagem atômica persistida (ou gateway/WAF). A correção local desta branch não substitui esse controle.

### VIG-006 — Controles de autenticação e RLS precisam de validação no Supabase
- **Prioridade:** Alta até confirmar configuração
- **Evidência:** o repositório contém apenas o ID do projeto em `supabase/config.toml`; as políticas RLS, permissões de tabelas e configuração efetiva do endpoint não podem ser comprovadas apenas pelos arquivos revisados.
- **Ação necessária:** verificar no painel Supabase se a função exige autenticação adequada ao fluxo real, se não há service-role key no cliente e se todas as tabelas expostas têm RLS e políticas mínimas. Não desativar JWT verification sem uma estratégia alternativa de autorização e rate limiting.

## Observações sobre privacidade e limites do produto

- O analisador de senhas mantém as senhas no estado temporário da interface. O trecho de persistência revisado grava apenas um resumo da auditoria (`weak`, `total`, `at`), não a senha em si.
- A checagem Have I Been Pwned usa o modelo k-anonymity: envia somente o prefixo do hash SHA-1. Isso reduz a exposição, mas SHA-1 não deve ser usado para armazenar senhas.
- Os sinais de invasão executados no navegador não equivalem a uma análise antivírus nativa do sistema operacional. A interface deve comunicar testes inconclusivos e limites da plataforma, evitando afirmar proteção total.
- O fingerprint do navegador inclui características de dispositivo e é guardado localmente; documentar isso na política de privacidade e oferecer transparência/controle ao usuário.

## Verificações pendentes antes de publicar

1. Executar `npm run build` e `npm run lint`.
2. Executar testes/validação da Edge Function com Deno e casos de URLs inválidas, locais, IPs privados e timeouts.
3. Confirmar variáveis de ambiente no Lovable após remoção de `.env`.
4. Confirmar autenticação/JWT e CORS do endpoint no ambiente de deploy.
5. Implementar rate limiting no servidor e revisar políticas RLS no Supabase.
6. Executar análise de dependências e revisar o lockfile.
