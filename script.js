// ─── CONFIGURAÇÕES GERAIS E FORMATAÇÃO ──────────────────────────────────────
const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let taxasAtuais = null;
let graficoInstancia = null;

// ─── COMUNICAÇÃO COM O BACKEND (API) ────────────────────────────────────────
// Função executada ao carregar a página. Busca as taxas do mercado financeiro no nosso servidor Node.
async function inicializarTaxas() {
    const statusEl = document.getElementById('status-api');
    const taxaInput = document.getElementById('taxa-anual');
    
    try {
        statusEl.textContent = 'Buscando taxas oficiais...';
        statusEl.classList.add('loading');

        // Consome a rota que construímos no server.js
        const res = await fetch('/api/taxas');
        if (!res.ok) throw new Error();
        taxasAtuais = await res.json();
        
        // Delay artificial (UX) para o usuário perceber que o sistema processou dados externos
        await delay(1200); 
        
        statusEl.textContent = '(Sincronizado)';
        statusEl.style.color = '#27ae60';
        statusEl.classList.remove('loading');
        
        atualizarCamposPorInvestimento();
    } catch (err) {
        statusEl.textContent = '(Erro na sincronização)';
        statusEl.style.color = '#c0392b';
        taxaInput.readOnly = false; // Libera digitação manual caso não haja internet
    }
}

// Atualiza a visualização do input de taxa dependendo da modalidade escolhida no <select>
function atualizarCamposPorInvestimento() {
    if (!taxasAtuais) return;
    const tipo = document.getElementById('tipo-investimento').value;
    const grupoCdi = document.getElementById('grupo-percentual-cdi');
    const infoTaxa = document.getElementById('taxa-detalhe');
    const inputTaxa = document.getElementById('taxa-anual');

    // Oculta o campo "% do CDI" se o investimento não for atrelado ao CDI
    grupoCdi.style.display = tipo === 'cdi' ? 'block' : 'none';

    const dados = taxasAtuais[tipo];
    inputTaxa.value = dados.taxa;
    infoTaxa.textContent = `${dados.nome} - Fonte: ${dados.fonte}`;
}

document.getElementById('tipo-investimento').addEventListener('change', atualizarCamposPorInvestimento);
window.onload = inicializarTaxas;

// ─── CÁLCULO FINANCEIRO (MOTOR DO VALOR DO DINHEIRO NO TEMPO) ──────────────
document.getElementById('calc-form').addEventListener('submit', function (e) {
    e.preventDefault();

    // 1. Coleta das Variáveis do Usuário
    const tipo = document.getElementById('tipo-investimento').value;
    const taxaAnualBruta = parseFloat(document.getElementById('taxa-anual').value) / 100;
    const valorInicial = parseFloat(document.getElementById('valor-inicial').value);
    const aporteMensal = parseFloat(document.getElementById('aporte-mensal').value);
    const saqueMensal = parseFloat(document.getElementById('saque-mensal').value);
    const meses = parseInt(document.getElementById('meses').value);

    // 2. Determinação da Taxa Anual Efetiva
    let taxaAnualEfetiva = taxaAnualBruta;
    if (tipo === 'cdi') {
        const pctCdi = parseFloat(document.getElementById('percentual-cdi').value) / 100;
        taxaAnualEfetiva = taxaAnualBruta * pctCdi;
    }

    // 3. Conversão de Taxa (Equivalência de Taxas de Juros)
    // Transforma a taxa anual em mensal considerando o efeito dos Juros Compostos
    const taxaMensal = Math.pow(1 + taxaAnualEfetiva, 1 / 12) - 1;

    // 4. Inicialização dos Acumuladores
    let saldoAtual = valorInicial;
    let totalInvestido = valorInicial;
    let totalRendimento = 0;
    const fluxoMensal = aporteMensal - saqueMensal; // Fluxo de Caixa Líquido do mês

    // Arrays para alimentar o gráfico do Chart.js
    const labels = [0];
    const dadosSaldo = [valorInicial];
    const dadosInvestido = [valorInicial];

    const tbody = document.querySelector('#tabela-relatorio tbody');
    tbody.innerHTML = '';

    // 5. Laço de Capitalização (Projeção Mês a Mês)
    for (let mes = 1; mes <= meses; mes++) {
        let saldoAnterior = saldoAtual;
        
        // Juros incidem sobre o saldo TOTAL do mês anterior
        let rendimentoMes = saldoAnterior * taxaMensal;
        
        totalRendimento += rendimentoMes;
        totalInvestido += aporteMensal;
        
        // Atualização do Patrimônio (Saldo Inicial + Juros + Fluxo Líquido)
        saldoAtual = saldoAnterior + rendimentoMes + fluxoMensal;

        let faliu = false;
        // Controle de Exaustão de Capital: se saques superam aportes e rendimentos, o dinheiro acaba
        if (saldoAtual <= 0) { 
            saldoAtual = 0; 
            faliu = true; 
        }

        labels.push(mes);
        dadosSaldo.push(parseFloat(saldoAtual.toFixed(2)));
        dadosInvestido.push(parseFloat(totalInvestido.toFixed(2)));

        // Geração das linhas da Tabela do Relatório
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:center;">${mes}</td>
            <td>${formatarMoeda(saldoAnterior)}</td>
            <td style="color:green;">+ ${formatarMoeda(rendimentoMes)}</td>
            <td>${formatarMoeda(fluxoMensal)}</td>
            <td style="font-weight:bold;">${formatarMoeda(saldoAtual)}</td>
        `;
        tbody.appendChild(tr);

        if (faliu) {
            const trAviso = document.createElement('tr');
            trAviso.innerHTML = `<td colspan="5" style="text-align:center; color:#c0392b; font-weight:bold; background:#fff0f0; padding:15px;">
                ⚠️ Alerta: O patrimônio foi totalmente consumido no mês ${mes}. As retiradas são insustentáveis.</td>`;
            tbody.appendChild(trAviso);
            break; // Interrompe a simulação matemática
        }
    }

    // 6. Exibição do Resumo Executivo
    document.getElementById('area-relatorio').style.display = 'block';
    
    // Rentabilidade real do período (Lucro sobre o Capital Imobilizado)
    const rentabilidade = (totalRendimento / totalInvestido) * 100;
    
    document.getElementById('resumo').innerHTML = `
        <div class="resumo-item">
            <div class="resumo-linha-principal"><span>Patrimônio Final Projetado:</span><span>${formatarMoeda(saldoAtual)}</span></div>
            <span class="resumo-descricao">Acúmulo total ao final do prazo de ${meses} meses.</span>
        </div>
        <div class="resumo-item">
            <div class="resumo-linha-principal"><span>Lucro Bruto (Juros Compostos):</span><span style="color:#27ae60">+ ${formatarMoeda(totalRendimento)}</span></div>
            <span class="resumo-descricao">Valor agregado exclusivamente pela força dos juros no período.</span>
        </div>
        <div class="resumo-item">
            <div class="resumo-linha-principal"><span>Total Desembolsado (Aportes):</span><span>${formatarMoeda(totalInvestido)}</span></div>
            <span class="resumo-descricao">Capital próprio transferido para o investimento.</span>
        </div>
        <div class="resumo-item">
            <div class="resumo-linha-principal"><span>Rentabilidade sobre Capital Próprio (ROE simplificado):</span><span>${rentabilidade.toFixed(2)}%</span></div>
            <span class="resumo-descricao">Ganho percentual em relação a todo o dinheiro que saiu do seu bolso.</span>
        </div>
    `;

    renderizarGrafico(labels, dadosSaldo, dadosInvestido);
});

// ─── GERAÇÃO DO GRÁFICO VISUAL ──────────────────────────────────────────────
function renderizarGrafico(labels, saldo, investido) {
    const ctx = document.getElementById('grafico-resultado').getContext('2d');
    if (graficoInstancia) graficoInstancia.destroy();

    // Lógica Dinâmica de Cores: Indica visualmente "Descapitalização" 
    // Se o saldo final for menor que o capital injetado, o gráfico fica laranja/vermelho
    const patrimonioFinal = saldo[saldo.length - 1];
    const investidoFinal = investido[investido.length - 1];
    const corAlerta = patrimonioFinal < investidoFinal;

    const bgCor = corAlerta ? 'rgba(231, 128, 60, 0.2)' : 'rgba(52, 152, 219, 0.2)';
    const bordaCor = corAlerta ? '#e78f3c' : '#3498db';

    graficoInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Evolução do Patrimônio Total',
                data: saldo,
                borderColor: bordaCor,
                backgroundColor: bgCor,
                fill: true,
                tension: 0.3,
                pointRadius: 2
            }, {
                label: 'Curva de Capital Investido (Aportes)',
                data: investido,
                borderColor: '#95a5a6',
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        // Customização do Tooltip para mostrar dados analíticos (Lucro/Prejuízo)
                        label: function(context) {
                            const valor = context.raw;
                            const index = context.dataIndex;
                            let texto = `${context.dataset.label}: ${formatarMoeda(valor)}`;
                            
                            // Calcula e exibe o "Gap" entre o Patrimônio e o Capital Investido
                            if (context.datasetIndex === 0) {
                                const lucro = valor - investido[index];
                                if (lucro > 0) texto += ` (Lucro Agregado: ${formatarMoeda(lucro)})`;
                                else if (lucro < 0) texto += ` (Prejuízo/Descapitalização: ${formatarMoeda(Math.abs(lucro))})`;
                            }
                            return texto;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: false,
                    ticks: { callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } 
                }
            }
        }
    });
}