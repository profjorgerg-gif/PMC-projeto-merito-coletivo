# Projeto Mérito Coletivo 2026 — CEDUP Hermann Hering

Plataforma do ranking coletivo das turmas (Turma Destaque do Ano), disciplina Gestão de Pessoas.

- **Ranking público**: pódio e classificação do 1º ao último lugar por trimestre e anual parcial, quadro geral e download em CSV.
- **Área do professor** (login com conta Google): importação do relatório de notas em PDF, conferência das notas lidas, cálculo da média coletiva, lançamento manual e cadastro de turmas.
- Grava apenas a **média de cada turma**. Nomes de estudantes lidos do PDF não são salvos.

Tecnologia: Vite + React, Firebase (Authentication + Firestore), publicação automática pelo GitHub Pages.

---

## Passo a passo de instalação

### Etapa 1 — Criar o projeto no Console do Firebase
1. Acesse https://console.firebase.google.com e clique em **Criar um projeto**.
2. Nome do projeto: `PMC-Projeto-Merito-Coletivo` (ID `pmc-projeto-merito-coletivo`). Pode desativar o Google Analytics. Clique em **Criar projeto**.
3. Plano: **Spark (gratuito)**. Não é preciso cartão.

### Etapa 2 — Ativar o login com conta Google (Authentication)
1. Menu lateral **Authentication > Vamos começar**.
2. Aba **Método de login** > **Google** > ativar > escolher o e-mail de suporte > **Salvar**.
3. Não é preciso cadastrar usuários: o professor entra com a própria conta Google. Quem pode alterar o ranking é definido pelo e-mail nas regras do Firestore (Etapa 3).

### Etapa 3 — Criar o banco (Firestore)
1. Menu **Criação > Firestore Database > Criar banco de dados**.
2. Local: `southamerica-east1 (São Paulo)`. Modo: **produção**.
3. Aba **Regras**: apague tudo, cole o conteúdo do arquivo `firestore.rules` deste repositório, **troque `SEU-EMAIL@gmail.com` pelo e-mail da conta Google do professor** e clique em **Publicar**.

### Etapa 4 — Registrar o app da Web e copiar as 6 chaves
1. Engrenagem ⚙ > **Configurações do projeto** > em "Seus apps", clique no ícone **`</>`** (Web).
2. Apelido: `merito-coletivo-web`. **Não** marque Firebase Hosting. Clique em **Registrar app**.
3. Copie os 6 valores (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

### Etapa 5 — Criar o repositório e ativar o GitHub Pages (pelo site)
1. github.com > **New repository**. Nome: `PMC-projeto-merito-coletivo`. Marque **Public**. Não adicione README. **Create repository**.
2. **Settings > Pages** > em **Source**, escolha **GitHub Actions**.

### Etapa 6 — Subir os arquivos (pelo site, sem arrastar pastas)
1. Descompacte o .zip no computador.
2. Na página do repositório, clique em **uploading an existing file** e selecione os 7 arquivos da pasta principal: `package.json`, `package-lock.json`, `vite.config.js`, `index.html`, `.gitignore`, `firestore.rules`, `README.md` > **Commit changes**.
3. **Add file > Create new file**. No nome, digite `src/main.jsx` (a barra cria a pasta). Cole o conteúdo do arquivo `src/main.jsx` > **Commit changes**.
4. Abra a pasta `src` no site > **Add file > Upload files** > selecione os 7 arquivos restantes da pasta `src` do computador: `App.jsx`, `pdfNotas.js`, `ranking.js`, `firebase.js`, `firebaseConfig.js`, `styles.css`, `cabecalho.jpg` > **Commit changes**.
5. Volte à página inicial do repositório > **Add file > Create new file**. No nome, digite `.github/workflows/deploy.yml`. Cole o conteúdo do arquivo `deploy.yml` > **Commit changes**.

### Etapa 7 — Colar as chaves e publicar
1. No site do GitHub, abra `src/firebaseConfig.js` > ícone do lápis.
2. Substitua cada `COLE-AQUI` pelo valor correspondente da Etapa 4 > **Commit changes**.
3. Aba **Actions**: aguarde a execução ficar verde (1 a 2 minutos).
4. Site publicado: `https://profjorgerg-gif.github.io/PMC-projeto-merito-coletivo/`

### Etapa 8 — Liberar o domínio no login e carregar os dados
1. Firebase > Authentication > **Configurações > Domínios autorizados** > **Adicionar domínio**: `profjorgerg-gif.github.io`.
2. No site, clique em **Área do professor** > **Entrar com Google** e escolha a conta do professor.
3. Aba **Turmas** > **Carregar dados da planilha** (11 turmas, médias do 1º e 2º trimestre).

---

## Como os cálculos funcionam
- **Média do trimestre da turma** = média aritmética das notas da coluna escolhida (padrão: "Média") de todos os estudantes marcados no PDF, com 2 casas decimais.
- **Média anual parcial** = média dos trimestres já lançados da turma.
- **Classificação**: da maior para a menor média; médias iguais (2 casas) dividem a posição (ex.: 1º, 2º, 2º, 4º).

## Formato de PDF aceito
PDF gerado por sistema (com texto selecionável), com uma linha por estudante: nome seguido das notas de 0 a 10 (vírgula ou ponto). A turma é identificada por "Turma: T204" ou pelo código T204 na página, e o trimestre por "3º Trimestre". Também aceita PDF de resumo com uma linha por turma (código e média). PDF digitalizado (foto) não é lido; use o lançamento manual.

## Estrutura dos dados (Firestore)
- `turmas/{T201}`: `codigo`, `notas.t1`, `notas.t2`, `notas.t3`, `fontes` (origem de cada lançamento)
- `config/geral`: `atualizadoEm`, `ano`
