// Variável global para o gráfico
let graficoInstancia = null;

// 1. CAPTURA DE DADOS (Exigência do Trabalho 1)
// Busca a meta Selic/CDI anualizada diretamente da API pública do Banco Central do Brasil.

const delay = (ms) => new Promise(resolve  => setTimeout(resolve, ms));

async function capturarTaxaBCB() {
    const statusElement = document.getElementById('status-api');

    try {
        const response = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json');
        const data = await response.json();
        const taxa = parseFloat(data[0].valor);

        await delay(1000);
        
        document.getElementById('taxa-cdi').value = taxa;
        statusElement.textContent = `(Capturado via API BCB: ${taxa}%)`;
        statusElement.style.color = 'green';
    } catch (error) {
        console.error("Erro ao capturar dados:", error);
        statusElement.textContent = "(Erro ao buscar API. Insira manualmente)";
        statusElement.style.color = 'red';
    }
}

// Executa a captura assim que a página carrega
window.onload = capturarTaxaBCB;

// Formatação de moeda para o relatório
const formatarMoeda = (valor) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// 2. PROCESSAMENTO E VALOR DO DINHEIRO NO TEMPO
document.getElementById('calc-form').addEventListener('submit', function(e) {
    e.preventDefault(); // Evita recarregar a página

        // Coleta os dados dos inputs
    const taxaCdiAnual = parseFloat(document.getElementById('taxa-cdi').value) / 100;
    const percentualCdi = parseFloat(document.getElementById('percentual-cdi').value) / 100;
    const valorInicial = parseFloat(document.getElementById('valor-inicial').value);
    const aporteMensal = parseFloat(document.getElementById('aporte-mensal').value);
    const saqueMensal = parseFloat(document.getElementById('saque-mensal').value);
    const meses = parseInt(document.getElementById('meses').value);

       // Calcula a taxa anual efetiva do investimento
    const taxaAnualEfetiva = taxaCdiAnual * percentualCdi;
    
    // Converte a taxa anual para mensal usando juros compostos
    const taxaMensal = Math.pow(1 + taxaAnualEfetiva, 1 / 12) - 1;

    let saldoAtual = valorInicial;
    let saldoParado = valorInicial; 
    let totalInvestido = valorInicial;
    let totalRendimento = 0;
    const fluxoLiquidoMensal = aporteMensal - saqueMensal;

    const labelsMeses = [0];
    const dadosReal = [valorInicial];
    const dadosParado = [valorInicial];

    const tbody = document.querySelector('#tabela-relatorio tbody');
    tbody.innerHTML = ''; 

    // Loop de capitalização mensal (Valor do Dinheiro no Tempo)
    for (let mes = 1; mes <= meses; mes++) {
        let saldoInicioMes = saldoAtual;
        
     // O rendimento incide sobre o saldo que iniciou o mês
        let rendimentoMes = saldoInicioMes * taxaMensal;
       
        // Atualiza os totais
        totalRendimento += rendimentoMes;
        totalInvestido += aporteMensal;
        
          // Saldo final do mês considera o juro acumulado e o fluxo de caixa
        saldoAtual = saldoInicioMes + rendimentoMes + fluxoLiquidoMensal;

        // Cálculo Parado
        let rendimentoParado = saldoParado * taxaMensal;
        saldoParado = saldoParado + rendimentoParado; 

        // Evita saldos negativos irreais caso os saques superem o principal
        let faliu = false;
        if (saldoAtual <= 0) {
            saldoAtual = 0;
            faliu = true;
        }

        labelsMeses.push(mes);
        dadosReal.push(saldoAtual);
        dadosParado.push(saldoParado);

         // Cria a linha da tabela para o relatório
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center;">${mes}</td>
            <td>${formatarMoeda(saldoInicioMes)}</td>
            <td style="color: green;">+ ${formatarMoeda(rendimentoMes)}</td>
            <td>${formatarMoeda(fluxoLiquidoMensal)}</td>
            <td style="font-weight: bold;">${formatarMoeda(saldoAtual)}</td>
        `;
        tbody.appendChild(tr);

        // Se o dinheiro acabou, adiciona a linha de aviso e para o loop
        if (faliu) {
            const trAviso = document.createElement('tr');
            trAviso.innerHTML = `
                <td colspan="5" style="text-align: center; color: #c0392b; font-weight: bold; background-color: rgba(231, 76, 60, 0.1); padding: 15px;">
                    ⚠️ Alerta: O patrimônio não suportou os saques e foi totalmente consumido no mês ${mes}.
                </td>
            `;
            tbody.appendChild(trAviso);
            break; 
        }
    }

    // 3. GERAÇÃO DE RELATÓRIOS E RESUMO
    const rentabilidadeTotal = (totalRendimento / totalInvestido) * 100;

    document.getElementById('resumo').innerHTML = `
        <div class="resumo-item">
            <div class="resumo-linha-principal">
                <span class="resumo-label">Patrimônio Final:</span>
                <span class="resumo-valor">${formatarMoeda(saldoAtual)}</span>
            </div>
            <span class="resumo-descricao">É o valor total que você terá ao final do prazo.</span>
        </div>
        <div class="resumo-item">
            <div class="resumo-linha-principal">
                <span class="resumo-label">Lucro Bruto (Juros):</span>
                <span class="resumo-valor positivo">+ ${formatarMoeda(totalRendimento)}</span>
            </div>
            <span class="resumo-descricao">O quanto o dinheiro trabalhou para você (rendimento puro).</span>
        </div>
        <div class="resumo-item">
            <div class="resumo-linha-principal">
                <span class="resumo-label">Total de Aportes:</span>
                <span class="resumo-valor">${formatarMoeda(totalInvestido)}</span>
            </div>
            <span class="resumo-descricao">O total de dinheiro que saiu do seu bolso.</span>
        </div>
        <div class="resumo-item">
            <div class="resumo-linha-principal">
                <span class="resumo-label">Rentabilidade Real:</span>
                <span class="resumo-valor">${rentabilidadeTotal.toFixed(2)}%</span>
            </div>
            <span class="resumo-descricao">O ganho percentual total sobre o valor investido.</span>
        </div>
        <p style="font-size: 0.85em; color: #888; margin-top: 20px;">
            * Simulação calculada com uma taxa mensal efetiva de <strong>${(taxaMensal * 100).toFixed(4)}%</strong>.
        </p>`;

    document.getElementById('area-relatorio').style.display = 'block';

    // 4. DESENHANDO O GRÁFICO (Chart.js)
    const ctx = document.getElementById('graficoEvolucao').getContext('2d');

    if (graficoInstancia) {
        graficoInstancia.destroy();
    }

    graficoInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labelsMeses,
            datasets: [
                {
                    label: 'Progressão Real (Com Aportes/Saques)',
                    data: dadosReal,
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                },
                {
                    label: 'Progressão Parada (Sem movimentações)',
                    data: dadosParado,
                    borderColor: '#f39c12',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatarMoeda(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                },
                x: {
                    title: { display: true, text: 'Meses' }
                }
            }
        }
    });
}); // Fim do evento submit

// MODO ESCURO
const btnDark = document.getElementById('toggle-dark');

btnDark.addEventListener('click', () => {
    // Alterna a classe dark-mode no body
    document.body.classList.toggle('dark-mode');
    
        // Altera o ícone/texto do botão
    if (document.body.classList.contains('dark-mode')) {
        btnDark.textContent = "☀️ Modo Claro";
    } else {
        btnDark.textContent = "🌙 Modo Escuro";
    }
});