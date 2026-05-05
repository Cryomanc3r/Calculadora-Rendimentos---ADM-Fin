// Importação dos módulos necessários para criar o servidor e fazer requisições web
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const path = require('path');

const app = express();
const PORT = 5000;

// Serve os arquivos estáticos (HTML, CSS, JS) da pasta atual
app.use(express.static(path.join(__dirname)));

// Função auxiliar para buscar séries temporais no Sistema Gerenciador de Séries (SGS) do Banco Central
async function bcb(serie) {
    const res = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`);
    const data = await res.json();
    return parseFloat(data[0].valor);
}

// Rota da API interna que alimenta o Front-end com as taxas atualizadas do mercado
app.get('/api/taxas', async (req, res) => {
    try {
        // Busca simultânea de indicadores essenciais no Banco Central
        const [selic, poupancaMensal, prefixado, ipca12] = await Promise.all([
            bcb(432),   // Série 432: Meta Selic anualizada (usada como proxy do CDI)
            bcb(195),   // Série 195: Rendimento da Poupança (% a.m.)
            bcb(1178),  // Série 1178: Taxa primária de Tesouro Prefixado (LTN)
            bcb(13522)  // Série 13522: IPCA acumulado nos últimos 12 meses
        ]);

        // Cálculo Financeiro: Anualização da taxa mensal da poupança (Juros Compostos)
        const poupancaAnual = parseFloat(((Math.pow(1 + poupancaMensal / 100, 12) - 1) * 100).toFixed(4));

        // Valores padrão de fallback caso a raspagem do Tesouro Direto falhe
        let prefixadoNome = 'Tesouro Prefixado (LTN - taxa primária)';
        let ipcaRealYield = 6.5; // Estimativa de prêmio de risco (taxa real)
        let ipcaNome = 'Tesouro IPCA+ (estimativa)';
        let ipcaFonte = 'BCB + estimativa de spread real';

        // Tentativa de Web Scraping na API pública da B3/Tesouro Direto para pegar taxas reais
        try {
            const tdRes = await fetch(
                'https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/component/jScript/BondBuy.json',
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Accept': 'application/json'
                    }
                }
            );
            
            if (tdRes.ok) {
                const tdJson = await tdRes.json();
                const titulos = tdJson.response.TrsrBdTradgList;

                // Filtra os títulos pelo nome para encontrar os adequados
                const prefixados = titulos.filter(t => t.TrsrBd.nm.toLowerCase().includes('prefixado') && !t.TrsrBd.nm.toLowerCase().includes('juros'));
                const ipcas = titulos.filter(t => t.TrsrBd.nm.toLowerCase().includes('ipca') && !t.TrsrBd.nm.toLowerCase().includes('juros'));

                // Se encontrou, atualiza os valores e fontes reais
                if (prefixados.length > 0) {
                    prefixado = parseFloat(prefixados[0].TrsrBd.anulInvstmtRate);
                    prefixadoNome = `${prefixados[0].TrsrBd.nm}`;
                }
                if (ipcas.length > 0) {
                    ipcaRealYield = parseFloat(ipcas[0].TrsrBd.anulInvstmtRate);
                    ipcaNome = `${ipcas[0].TrsrBd.nm}`;
                    ipcaFonte = 'Tesouro Direto + BCB (IPCA 12m)';
                }
            }
        } catch (_) {
            // Ignora o erro e segue com os dados do fallback (BCB)
        }

        // Equação de Fisher: Cálculo da taxa nominal do IPCA+ [ (1 + inflação) * (1 + juro real) - 1 ]
        const ipcaNominal = parseFloat(((1 + ipca12 / 100) * (1 + ipcaRealYield / 100) - 1) * 100).toFixed(4);

        // Retorna o objeto JSON consolidado para o Frontend
        res.json({
            cdi: { taxa: selic, nome: 'CDI / Meta Selic', fonte: 'Banco Central do Brasil (Série 432)' },
            poupanca: { taxa: poupancaAnual, nome: 'Poupança (anualizada)', fonte: `BCB Série 195 — mensal ${poupancaMensal}% a.m.` },
            prefixado: { taxa: prefixado, nome: prefixadoNome, fonte: 'BCB Série 1178 (LTN - taxa primária)' },
            ipca: { taxa: parseFloat(ipcaNominal), taxaReal: ipcaRealYield, ipca12, nome: ipcaNome, fonte: ipcaFonte }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
});