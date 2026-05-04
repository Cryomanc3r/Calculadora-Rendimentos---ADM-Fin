// 1. CAPTURA DE DADOS (Exigência do Trabalho 1)
// Busca a meta Selic/CDI anualizada diretamente da API pública do Banco Central do Brasil.
async function capturarTaxaBCB() {
    try {
        // Série 432: Taxa de juros - Meta Selic definida pelo Copom
        const response = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json');
        const data = await response.json();
        const taxa = parseFloat(data[0].valor);
        
        document.getElementById('taxa-cdi').value = taxa;
        document.getElementById('status-api').textContent = `(Capturado via API BCB: ${taxa}%)`;
        document.getElementById('status-api').style.color = 'green';
    } catch (error) {
        console.error("Erro ao capturar dados:", error);
        document.getElementById('status-api').textContent = "(Erro ao buscar API. Insira manualmente)";
        document.getElementById('status-api').style.color = 'red';
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
    let totalInvestido = valorInicial;
    let totalRendimento = 0;
    const fluxoLiquidoMensal = aporteMensal - saqueMensal;

    // 3. GERAÇÃO DE RELATÓRIOS (Exigência do Trabalho 1)
    const tbody = document.querySelector('#tabela-relatorio tbody');
    tbody.innerHTML = ''; // Limpa resultados anteriores

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

        // Evita saldos negativos irreais caso os saques superem o principal
        if (saldoAtual < 0) saldoAtual = 0;

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

        if (saldoAtual === 0) break; // Interrompe se o dinheiro acabar
    }

    // Exibe a seção de relatório e o resumo
    document.getElementById('area-relatorio').style.display = 'block';
    document.getElementById('resumo').innerHTML = `
        <p><strong>Taxa Mensal Efetiva:</strong> ${(taxaMensal * 100).toFixed(4)}% ao mês</p>
        <p><strong>Total Investido (Sem Juros):</strong> ${formatarMoeda(totalInvestido)}</p>
        <p><strong>Juros Acumulados:</strong> ${formatarMoeda(totalRendimento)}</p>
        <p><strong>Valor Final Projetado:</strong> ${formatarMoeda(saldoAtual)}</p>
    `;
});