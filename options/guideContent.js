const guideContent = [
	{
		id: "getting-started",
		icon: "fas fa-rocket",
		title: "Começando: Sua Primeira Captura",
		content: `
            <p>Bem-vindo à SillyMaquina! Usar a extensão é muito simples. Siga estes passos:</p>
            <ol>
                <li>
                    <strong>Injeção do Script:</strong> Se é a primeira vez que você usa a extensão em um site, <strong>atualize a página (pressione F5)</strong>. Isso injeta os componentes necessários na página. Este passo só é preciso uma vez por site ou após atualizações da extensão.
                </li>
                <li>
                    <strong>Ative a Captura:</strong> Para acionar a IA, escolha seu método preferido:
                    <ul>
                        <li>Clique no ícone flutuante que aparece no canto da tela.</li>
                        <li>Ou pressione seu atalho de teclado (o padrão é <strong><code>Alt+X</code></strong>).</li>
                    </ul>
                </li>
            </ol>
            <p style="margin-top: 15px;"><strong>Entendendo o Ícone Flutuante:</strong></p>
            <ul>
                <li><strong>Normal:</strong> Pronto para ser usado.</li>
                <li><strong>Pulsando:</strong> A IA está processando sua imagem.</li>
                <li><strong>Com Contador (35s):</strong> O sistema está em cooldown para garantir a estabilidade. Aguarde o tempo zerar.</li>
            </ul>
        `,
	},
	{
		id: "settings-overview",
		icon: "fas fa-sliders-h",
		title: "Dominando as Configurações",
		content: `
            <p>Esta página é seu painel de controle. Lembre-se de sempre clicar em <strong>"Salvar Configurações"</strong> após fazer alterações para sincronizá-las com o servidor e a extensão.</p>

            <h4><i class="fas fa-desktop" style="color:var(--accent-info); margin-right:8px;"></i>Captura e Exibição</h4>
            <ul>
                <li><strong>Modo de Exibição:</strong> Escolha como a resposta da IA será mostrada. "Popup" é o padrão. "Título da Página" é mais discreto e ideal para quem usa atalhos.</li>
                <li><strong>Opacidade do Popup:</strong> Controle a transparência do popup de resposta. Esta opção só aparece quando o modo "Popup Pequeno" está selecionado.</li>
                <li><strong>Atraso para Reverter Título:</strong> Se usar o modo "Título da Página", defina aqui por quantos segundos a resposta ficará visível antes do título original retornar.</li>
            </ul>

            <h4 style="margin-top:20px;"><i class="fas fa-magic" style="color:var(--accent-info); margin-right:8px;"></i>Aparência e Atalhos</h4>
            <ul>
                <li><strong>Ocultar Ícone Flutuante:</strong> Se você prefere usar apenas o atalho do teclado, marque esta opção para uma experiência mais limpa e sem distrações.</li>
                <li><strong>Exibir Cooldown no Título:</strong> Quando o ícone está oculto, esta opção (que só aparece se a anterior estiver marcada) exibe a contagem do tempo de espera diretamente no título da aba, para que você sempre saiba quando pode usar a IA novamente.</li>
                <li><strong>Ícone e Estilos:</strong> Deixe a extensão com a sua cara! Use o <a href="icon-picker.html" target="_blank">Seletor de Ícones</a> para encontrar um que combine com você. Mude o tamanho e a opacidade. O preview ao lado mostrará exatamente como ele ficará em tempo real!</li>
                <li><strong>Atalho de Captura:</strong> Defina uma combinação de teclas que seja mais confortável para você. Clique no campo e pressione a combinação desejada (ex: Ctrl+Shift+S).</li>
            </ul>

            <h4 style="margin-top:20px;"><i class="fas fa-brain" style="color:var(--accent-info); margin-right:8px;"></i>Configurações de IA</h4>
            <ul>
                <li><strong>Modelo de IA:</strong> Selecione o "cérebro" para sua análise. Cada um tem um custo e uma capacidade diferente. Sua cota de uso diário é exibida logo abaixo.
                    <ul>
                        <li style="margin-top: 8px;"><strong>Padrão:</strong> Rápido, eficiente e ideal para a maioria das questões do dia a dia.</li>
                        <li><strong>Pesquisa Aprimorada:</strong> Mais lento, porém mais assertivo e analítico para desafios complexos.</li>
                        <li><strong>Reflexão:</strong> O mais poderoso. Demora para responder, pois realiza um raciocínio profundo. Ideal para questões que exigem análise contextual complexa.</li>
                    </ul>
                </li>
                <li><strong>Temperatura da IA:</strong> Ajuste a "criatividade" da IA. Valores mais baixos (ex: 0.2) tornam as respostas mais diretas e previsíveis. Valores mais altos (ex: 0.8) permitem mais variedade. O padrão (0.4) é recomendado para a maioria dos casos.</li>
            </ul>

            <h4 style="margin-top:20px;"><i class="fas fa-save" style="color:var(--accent-info); margin-right:8px;"></i>Histórico Local</h4>
            <ul>
                <li><strong>Tamanho do Histórico:</strong> Defina quantas das suas capturas mais recentes devem ser salvas no seu navegador (entre 10 e 200).</li>
            </ul>
        `,
	},
	{
		id: "history-tab",
		icon: "fas fa-history",
		title: "Explorando a Aba de Histórico",
		content: `
            <p>A aba "Histórico" salva suas capturas recentes localmente no seu computador. Você pode:</p>
            <ul>
                <li><strong>Expandir:</strong> Clique em um item para ver a imagem completa e o texto gerado.</li>
                <li><strong>Buscar:</strong> Use a barra de busca para encontrar itens pelo conteúdo do texto ou por tags.</li>
                <li><strong>Favoritar:</strong> Marque itens importantes para encontrá-los facilmente com o filtro "Apenas Favoritos".</li>
                <li><strong>Adicionar Tags:</strong> Organize suas capturas com etiquetas personalizadas. Digite uma tag no campo e pressione Enter para adicioná-la.</li>
            </ul>
        `,
	},
	{
		id: "security",
		icon: "fas fa-shield-halved",
		title: "Segurança e Privacidade",
		content: `
            <p>Sua confiança é nossa prioridade. Fique tranquilo, pois:</p>
            <ul>
                <li>As imagens capturadas são processadas e <strong>imediatamente descartadas</strong>, nunca são armazenadas em nossos servidores.</li>
                <li>Seu histórico de capturas, favoritos e tags ficam salvos <strong>apenas localmente</strong>, no seu navegador, garantindo sua privacidade.</li>
                <li>Toda a comunicação com nossos servidores é protegida com <strong>criptografia SSL (HTTPS)</strong>.</li>
            </ul>
        `,
	},
];
