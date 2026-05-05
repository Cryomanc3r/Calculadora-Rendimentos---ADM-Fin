# Simulador de Investimentos: Renda Fixa Dinâmica

Trabalho prático desenvolvido para a disciplina de **Administração Financeira** (CAD 167) da Universidade Federal de Minas Gerais (UFMG).

**Alunos:** Isadora Cunha Pimentel e Pedro Dalla-Lana
**Tema:** Valor do Dinheiro no Tempo

## 📌 Sobre o Projeto
 A ferramenta permite projetar o crescimento do patrimônio em diferentes modalidades de Renda Fixa (CDI, Poupança, Tesouro Prefixado e IPCA+), considerando a taxa real de juros atualizada via API do Banco Central e aportes/saques mensais.

## ⚙️ Pré-requisitos
Para rodar este projeto localmente, é necessário ter instalado na máquina:
* **Node.js** (versão 14 ou superior)
* Um navegador web atualizado.

## 🚀 Como Executar a Aplicação

1. **Abra o terminal** na pasta raiz do projeto.

2. **Instale as dependências** do servidor (Express e Node-Fetch) rodando o comando:
   ```bash
   npm install

3. **Inicie o servidor local executando:**
    node server.js

4. O terminal exibirá a mensagem: `Servidor rodando em http://0.0.0.0:5000`

5. **Acesse a aplicação**: Abra o seu navegador e digite o endereço: `http://localhost:5000` ou aperte a tecla 'Ctrl' enquanto clica no endereço mostrado no terminal.

## 🧠 Arquitetura e Lógica Financeira
* **Backend (`server.js`):** Atua como um agregador de dados, buscando as taxas de juros atualizadas (Selic, Poupança, IPCA) diretamente nas APIs do Banco Central do Brasil (SGS).
* **Frontend (`script.js` & `index.html`):** Realiza os cálculos de capitalização composta mensal ($i_m = (1 + i_a)^{1/12} - 1$), iterando mês a mês para encontrar o saldo projetado, deduzindo saques e somando novos aportes.