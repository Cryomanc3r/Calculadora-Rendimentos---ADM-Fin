const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let taxas = null;

const statusEl = () => document.getElementById('status-api');
const taxaEl = () => document.getElementById('taxa-anual');
const detalheEl = () => document.getElementById('taxa-detalhe');

// ─── INICIALIZAÇÃO ───────────────────────────────────────────────────────────

async function inicializar() {
    statusEl().textContent = 'Buscando taxas...';
    statusEl().className = 'loading';

    try {
        const res = await fetch('/api/taxas');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        taxas = await res.json();
        if (taxas.error) throw new Error(taxas.error);

        statusEl().textContent = 'Taxas captadas com sucesso';
        statusEl().style.color = 'green';
        statusEl().className = '';
        atualizarExibicao();
    } catch (err) {
        console.error('Erro ao buscar taxas:', err);
        statusEl().textContent = 'Erro ao buscar taxas. Edite manualmente.';
        statusEl().style.color = 'red';
        taxaEl().readOnly = false;
    }
}

// ─── ATUALIZAÇÃO DA EXIBIÇÃO ─────────────────────────────────────────────────

function atualizarExibicao() {
    if (!taxas) return;

    const tipo = document.getElementById('tipo-investimento').value;
    const grupoPct = document.getElementById('grupo-percentual-cdi');
    grupoPct.style.display = tipo === 'cdi' ? 'block' : 'none';

    const d = taxas[tipo];
    if (!d) return;

    taxaEl().value = d.taxa;

    let detalhe = `${d.nome}: ${d.taxa}% a.a.`;
    if (tipo === 'ipca') {
        detalhe = `${d.nome}: IPCA 12m ${d.ipca12}% + ${d.taxaReal}% real = ${d.taxa}% nominal a.a.`;
    }
    detalhe += ` — Fonte: ${d.fonte}`;
    detalheEl().textContent = detalhe;
}

// ─── EVENTOS ─────────────────────────────────────────────────────────────────

document.getElementById('tipo-investimento').addEventListener('change', atualizarExibicao);
window.onload = inicializar;

// ─── CÁLCULO E GERAÇÃO DO RELATÓRIO ─────────────────────────────────────────

document.getElementById('calc-form').addEventListener('submit', function (e) {
    e.preventDefault();

    const tipo = document.getElementById('tipo-investimento').value;
    const taxaAnualBruta = parseFloat(taxaEl().value) / 100;

    let taxaAnualEfetiva;
    if (tipo === 'cdi') {
        const percentualCdi = parseFloat(document.getElementById('percentual-cdi').value) / 100;
        taxaAnualEfetiva = taxaAnualBruta * percentualCdi;
    } else {
        taxaAnualEfetiva = taxaAnualBruta;
    }

    const valorInicial = parseFloat(document.getElementById('valor-inicial').value);
    const aporteMensal = parseFloat(document.getElementById('aporte-mensal').value);
    const saqueMensal = parseFloat(document.getElementById('saque-mensal').value);
    const meses = parseInt(document.getElementById('meses').value);

    const taxaMensal = Math.pow(1 + taxaAnualEfetiva, 1 / 12) - 1;

    let saldoAtual = valorInicial;
    let totalInvestido = valorInicial;
    let totalRendimento = 0;
    const fluxoLiquidoMensal = aporteMensal - saqueMensal;

    const dadosMeses = { labels: [], investido: [], saldo: [] };

    const tbody = document.querySelector('#tabela-relatorio tbody');
    tbody.innerHTML = '';

    for (let mes = 1; mes <= meses; mes++) {
        const saldoInicioMes = saldoAtual;
        const rendimentoMes = saldoInicioMes * taxaMensal;

        totalRendimento += rendimentoMes;
        totalInvestido += aporteMensal;
        saldoAtual = saldoInicioMes + rendimentoMes + fluxoLiquidoMensal;
        if (saldoAtual < 0) saldoAtual = 0;

        dadosMeses.labels.push(`Mês ${mes}`);
        dadosMeses.investido.push(parseFloat(totalInvestido.toFixed(2)));
        dadosMeses.saldo.push(parseFloat(saldoAtual.toFixed(2)));

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:center;">${mes}</td>
            <td>${formatarMoeda(saldoInicioMes)}</td>
            <td style="color:green;">+ ${formatarMoeda(rendimentoMes)}</td>
            <td>${formatarMoeda(fluxoLiquidoMensal)}</td>
            <td style="font-weight:bold;">${formatarMoeda(saldoAtual)}</td>
        `;
        tbody.appendChild(tr);
        if (saldoAtual === 0) break;
    }

    const tipoLabel = document.getElementById('tipo-investimento').selectedOptions[0].text;

    document.getElementById('area-relatorio').style.display = 'block';
    document.getElementById('resumo').innerHTML = `
        <p><strong>Tipo de Investimento:</strong> ${tipoLabel}</p>
        <p><strong>Taxa Anual Efetiva:</strong> ${(taxaAnualEfetiva * 100).toFixed(4)}% a.a.</p>
        <p><strong>Taxa Mensal Efetiva:</strong> ${(taxaMensal * 100).toFixed(4)}% a.m.</p>
        <p><strong>Total Investido (Sem Juros):</strong> ${formatarMoeda(totalInvestido)}</p>
        <p><strong>Juros Acumulados:</strong> ${formatarMoeda(totalRendimento)}</p>
        <p><strong>Valor Final Projetado:</strong> ${formatarMoeda(saldoAtual)}</p>
    `;

    renderizarGrafico(dadosMeses);
});

// ─── GRÁFICO ──────────────────────────────────────────────────────────────────

let graficoInstance = null;

function renderizarGrafico(dados) {
    const ctx = document.getElementById('grafico-resultado').getContext('2d');

    if (graficoInstance) {
        graficoInstance.destroy();
    }

    const moeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    graficoInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dados.labels,
            datasets: [
                {
                    label: 'Total Investido',
                    data: dados.investido,
                    backgroundColor: '#1a3a5c',
                    borderColor: '#122a44',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Saldo Final',
                    data: dados.saldo,
                    backgroundColor: '#5ba4cf',
                    borderColor: '#3a87c0',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { font: { size: 13 }, padding: 16 }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ${moeda(ctx.raw)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (v) => moeda(v).replace(',00', '')
                    },
                    grid: { color: '#e8e8e8' }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        maxRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 24
                    }
                }
            }
        }
    });
}
