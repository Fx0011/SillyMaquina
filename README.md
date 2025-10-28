# SillyMaquina

## Transforme Desafios em Respostas Instantâneas.

Capture qualquer conteúdo na sua tela e deixe que nossa IA analise e resolva para você. Otimize seus estudos com um clique.

Versão 3 lançada wooohoooo.
Guias estarão disponíveis em breve.

---

## 📝 Patch Notes

### Versão 3.0.1 - Atualização Completa do Sistema

#### 🎯 Novas Funcionalidades

**1. Sistema de Atalhos Avançado**

-   ✨ **Atalho para Trocar Modelo** (`Alt+M` por padrão)

    -   Alterne rapidamente entre modelos disponíveis no seu plano
    -   Notificação visual mostra qual modelo foi selecionado
    -   Disponível para todos os planos (Basic, Pro, Admin)
    -   Previne trocas muito rápidas com cooldown de 500ms

-   ✨ **Atalho para Trocar Modo de Captura** (Planos Pro/Admin)
    -   Alterne entre captura "Padrão" (viewport visível) e "Total" (página completa)
    -   Validação especial: apenas tecla Alt + letra/número (ex: `Alt+C`)
    -   Não aceita Ctrl ou Shift na combinação
    -   Notificação visual estilizada com gradiente azul e animação de entrada
    -   Configurações sincronizam automaticamente com o backend

**2. Sistema de Manutenção Integrado**

-   🔧 **Detecção de Manutenção Ativa**

    -   Tela dedicada de manutenção bloqueia completamente a extensão durante manutenção
    -   Exibe título, mensagem, horários de início/fim
    -   Contador em tempo real do tempo restante (atualiza a cada minuto)
    -   Lista de serviços afetados
    -   Botão para verificar status novamente

-   📢 **Banner de Manutenção Agendada**

    -   Aviso proeminente no topo quando manutenção está programada nas próximas 24h
    -   Estilo laranja/amarelo com gradiente para chamar atenção
    -   Mostra contagem regressiva até o início (ex: "5h 30min" ou "2 dias")
    -   Botão "Detalhes" abre modal com informações completas

-   📋 **Modal de Detalhes de Manutenção**

    -   Informações completas sobre manutenção agendada
    -   Horários formatados em PT-BR
    -   Tempo restante até início
    -   Lista de serviços que serão afetados
    -   Botão de fechar e click fora para fechar

-   🚫 **Bloqueio Durante Manutenção**
    -   Mensagens de erro claras para usuários
    -   Nenhum token é consumido durante manutenção

**3. Validação e Tratamento de Respostas**

-   ✅ **Validação de Formato de Resposta**
    -   Sistema verifica se resposta do modelo segue padrão "Resposta: X"
    -   Respostas inválidas são automaticamente convertidas para "Inválida/Insolúvel"
    -   Previne confusão quando IA não consegue processar corretamente
    -   Regex robusto: `/^Resposta:\s*.+/i`

**4. Gerenciamento de Sessão Aprimorado**

-   🔐 **Auto-Logout em Erros 401**
    -   Sistema detecta automaticamente quando token expira ou é inválido
    -   Limpa storage local automaticamente
    -   Recarrega extensão para tela de login
    -   Previne erros em cascata por sessões inválidas

#### 🐛 Correções de Bugs

**1. Bug do Título da Página**

-   ✅ **Correção de Título Travado**
    -   Título da página não ficava mais preso mostrando resposta ou cooldown
    -   Sistema de restauração com múltiplas salvaguardas
    -   Verificação forçada: `document.title !== originalTitle`
    -   Lock de título (`titleLock`) previne sobrescrita durante exibição
    -   Timeout de segurança para restauração automática
    -   Estados de título rastreados: "normal", "answer", "analyzing", "cooldown"

**2. Persistência de Configurações**

-   ✅ **Sincronização de Settings**
    -   Troca de modelo/modo de captura agora atualiza
    -   Settings recarregam automaticamente após salvar
    -   Tab de configurações recarrega para refletir mudanças
    -   Tanto objeto `settings` quanto `user.configurationSettings` mantidos em sincronia

**3. Notificações Visuais**

-   ✅ **CSS de Notificações**
    -   Adicionado estilo `.sillymaquina-capture-mode` para notificação de troca de modo
    -   Gradiente azul vibrante (`#667eea` → `#764ba2`)
    -   Animação `slideUp` suave
    -   Ícone de troca e texto formatado
    -   Duração configurável baseada no modo de exibição

#### 🎨 Melhorias de Interface

**1. Estilização de Manutenção**

-   Design profissional e clean para telas de manutenção
-   Gradientes coloridos e ícones Font Awesome
-   Cards informativos com espaçamento adequado
-   Animações sutis (pulse, slideDown)
-   Responsivo e bem estruturado
-   Cores temáticas: laranja/amarelo para manutenção

**2. Validação de Atalhos**

-   Validação visual em tempo real
-   Mensagens de erro específicas para cada tipo de restrição
-   Indicadores de plano (🔒) para features premium
-   Feedback imediato ao configurar atalhos

#### 🔧 Melhorias Técnicas

**1. Backend - Manutenção**

-   Endpoint público: `GET /api/v1/public/maintenance-status`
-   Query otimizada com `.find()`, `.sort()`, `.limit(1)`
-   Suporte para datas em formato ISO string
-   Logs de debug detalhados
-   Retorna: `isUnderMaintenance`, `active`, `upcoming`
-   Campo `timeUntilStart` em milissegundos para cálculos no frontend
-   Lista `affectedServices` incluída na resposta

**2. Content Script**

-   Check de manutenção antes de `captureAndProcess()`
-   Mensagens de erro contextualizadas
-   Integração com `safeSendMessage()` existente
-   Bloqueio gracioso sem consumir recursos

**3. Background Script**

-   Nova action: `checkMaintenance`
-   Handler `handleCheckMaintenance()` busca status da API
-   Tratamento de erros gracioso (retorna `false` se API falhar)
-   Não bloqueia funcionamento em caso de erro de rede

**4. Popup**

-   Função `checkMaintenanceAndAuth()` verifica manutenção antes de autenticação
-   Helper functions: `formatDateTime()`, `formatTimeUntil()`
-   Event listeners para banner, modal, refresh
-   Estado de manutenção armazenado globalmente
-   Updates de tempo restante a cada minuto

#### 📋 Configuração e Planos

**1. Recursos por Plano**

```json
{
	"basic": {
		"keybindModelSwitch": true,
		"keybindCaptureModeSwitch": false
	},
	"pro": {
		"keybindModelSwitch": true,
		"keybindCaptureModeSwitch": true
	},
	"admin": {
		"keybindModelSwitch": true,
		"keybindCaptureModeSwitch": true
	}
}
```

**2. Padrões de Configuração**

-   `keybindModelSwitch`: `"Alt+M"` (Basic+)
-   `keybindCaptureModeSwitch`: `null` (Pro+)
-   Validação no schema: string ou null

#### 🔒 Segurança e Validação

**1. Validação de Planos**

-   Verificação server-side e client-side
-   Features bloqueadas mostram indicador 🔒
-   Mensagens claras sobre requisitos de plano
-   Validação de schemas Joi no backend

**2. Tratamento de Erros**

-   Try-catch abrangente em todas as operações assíncronas
-   Logs estruturados com contexto
-   Mensagens de erro user-friendly
-   Fallbacks graciosos

#### 📊 Experiência do Usuário

**1. Formatação de Tempo**

-   Datas em PT-BR: `DD/MM/YYYY HH:MM`
-   Tempo restante inteligente:
    -   Mais de 24h: "X dias"
    -   Entre 1-24h: "Xh Ymin"
    -   Menos de 1h: "X minutos"
-   Atualização em tempo real

**2. Feedback Visual**

-   Notificações temporárias para ações
-   Estados de loading claros
-   Animações suaves e não intrusivas
-   Cores semânticas (sucesso, erro, aviso)

#### 🚀 Performance

**1. Caching**

-   Métricas cacheadas por 5 minutos
-   Validação de cache antes de requests
-   Reduz carga no servidor
-   Melhora tempo de resposta

**2. Otimizações**

-   Queries MongoDB otimizadas
-   Indexes apropriados (criados em dbInit.js)
-   Limitação de resultados (`.limit(1)`)
-   Ordenação eficiente (`.sort()`)

---

## 🎯 Recursos Principais

### ⚡ Captura Inteligente

-   **Modo Padrão**: Captura apenas a área visível da tela
-   **Modo Total** (Pro/Admin): Captura página completa com scroll automático
-   Troca rápida via atalho configurável

### 🤖 Modelos de IA

-   Múltiplos modelos disponíveis
-   Custos de tokens diferenciados por modelo
-   Troca rápida via atalho `Alt+M`
-   Informações detalhadas no dashboard

### 📊 Dashboard Completo

-   Estatísticas de uso em tempo real
-   Gráficos de uso por modelo
-   Informações de rate limit
-   Histórico de requisições
-   Métricas de tokens

### ⚙️ Configurações Avançadas

-   Personalização de atalhos
-   Modos de exibição de resposta
-   Configuração de botão flutuante
-   Limites de histórico
-   Validação por plano

### 🎨 Modos de Exibição

-   **Título da Página**: Resposta mostrada no título do navegador
-   **Popup**: Janela flutuante com resposta
-   Configurações de duração e opacidade
-   Exibição de "Analisando..." opcional

---

## 🛠️ Instalação

1. Faça download da extensão
2. Abra `chrome://extensions` no Chrome
3. Ative o "Modo do desenvolvedor"
4. Clique em "Carregar sem compactação"
5. Selecione a pasta da extensão
6. Faça login com suas credenciais

---

## 🐛 Reportar Bugs

Encontrou um problema? Entre em contato:

-   Email: support@sillymaquina.com
-   Site: https://sillymaquina.netlify.app/support

---

## 📜 Licença

© 2025 SillyMaquina. Todos os direitos reservados.
