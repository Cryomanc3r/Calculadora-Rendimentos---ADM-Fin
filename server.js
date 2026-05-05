const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const path = require('path');

const app = express();
const PORT = 5000;

app.use(express.static(path.join(__dirname)));

async function bcb(serie) {
    const res = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`);
    const data = await res.json();
    return parseFloat(data[0].valor);
}

app.get('/api/taxas', async (req, res) => {
    try {
        const [selic, poupancaMensal, prefixado, ipca12] = await Promise.all([
            bcb(432),   // Meta Selic anual - proxy CDI
            bcb(195),   // Poupança mensal
            bcb(1178),  // LTN / Tesouro Prefixado (taxa primária)
            bcb(13522)  // IPCA acumulado 12 meses
        ]);

        const poupancaAnual = parseFloat(((Math.pow(1 + poupancaMensal / 100, 12) - 1) * 100).toFixed(4));

        let prefixadoNome = 'Tesouro Prefixado (LTN - taxa primária)';
        let ipcaRealYield = 6.5;
        let ipcaNome = 'Tesouro IPCA+ (estimativa)';
        let ipcaFonte = 'BCB + estimativa de spread real';

        try {
            const tdRes = await fetch(
                'https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/component/jScript/BondBuy.json',
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'pt-BR,pt;q=0.9',
                        'Referer': 'https://www.tesourodireto.com.br/titulos/precos-e-taxas.htm',
                        'Origin': 'https://www.tesourodireto.com.br'
                    }
                }
            );
            if (tdRes.ok) {
                const tdJson = await tdRes.json();
                const titulos = tdJson.response.TrsrBdTradgList;

                const prefixados = titulos
                    .filter(t => t.TrsrBd.nm.toLowerCase().includes('prefixado') && !t.TrsrBd.nm.toLowerCase().includes('juros'))
                    .sort((a, b) => a.TrsrBd.mtrtyDt.localeCompare(b.TrsrBd.mtrtyDt));

                const ipcas = titulos
                    .filter(t => t.TrsrBd.nm.toLowerCase().includes('ipca') && !t.TrsrBd.nm.toLowerCase().includes('juros'))
                    .sort((a, b) => a.TrsrBd.mtrtyDt.localeCompare(b.TrsrBd.mtrtyDt));

                if (prefixados.length > 0) {
                    const td = prefixados[0].TrsrBd;
                    prefixado = parseFloat(td.anulInvstmtRate);
                    prefixadoNome = `${td.nm} (venc. ${td.mtrtyDt})`;
                }
                if (ipcas.length > 0) {
                    const td = ipcas[0].TrsrBd;
                    ipcaRealYield = parseFloat(td.anulInvstmtRate);
                    ipcaNome = `${td.nm} (venc. ${td.mtrtyDt})`;
                    ipcaFonte = 'Tesouro Direto + BCB (IPCA 12m)';
                }
            }
        } catch (_) {}

        const ipcaNominal = parseFloat(((1 + ipca12 / 100) * (1 + ipcaRealYield / 100) - 1) * 100).toFixed(4);

        res.json({
            cdi: {
                taxa: selic,
                nome: 'CDI / Meta Selic',
                fonte: 'Banco Central do Brasil (Série 432)'
            },
            poupanca: {
                taxa: poupancaAnual,
                nome: 'Poupança (anualizada)',
                fonte: `BCB Série 195 — mensal ${poupancaMensal}% a.m.`
            },
            prefixado: {
                taxa: prefixado,
                nome: prefixadoNome,
                fonte: 'BCB Série 1178 (LTN - taxa primária)'
            },
            ipca: {
                taxa: parseFloat(ipcaNominal),
                taxaReal: ipcaRealYield,
                ipca12,
                nome: ipcaNome,
                fonte: ipcaFonte
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
});
