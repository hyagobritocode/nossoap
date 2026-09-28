# Bot de achadinhos no WhatsApp

Um assistente que lê os seus grupos de achadinhos, guarda cada oferta (texto, link, preço, loja, grupo e data) e conversa com você no próprio WhatsApp.

Em vez de digitar "tv 50" na busca e abrir resultado por resultado, você escreve o que quer e ele responde com o que serve:

> **Você:** tv 50 lg
>
> **🤖** Achei 3 TVs LG de 50" nos últimos 10 dias (tirei 2 suportes de parede que também apareceram):
>
> 1. *LG 50UT8050, 4K*: *R$ 2.199* na Amazon. Postada ontem às 21:40 no _Achadinhos da Ana_ e repostada em mais 2 grupos.
>    https://amzn.to/…
> 2. *LG 50UR8750*: R$ 2.349 no Mercado Livre, há 4 dias no _Promo Brasil_, com cupom TV50 de R$ 100.
>    …
>
> A mais barata é de ontem. Esse tipo de oferta costuma durar pouco; quer que eu abra o link pra ver se ainda está valendo?

Depois dá pra continuar a conversa: "abre o primeiro link", "e da Samsung?", "só até 2 mil", "me avisa se aparecer abaixo de 2.000".

## Como funciona

```
Grupos do WhatsApp ──► bot (aparelho conectado, igual ao WhatsApp Web)
                          │  guarda só as mensagens com link
                          ▼
                    banco local (dados/ofertas.db)
                          ▲  busca com sinônimos, filtros de preço, data e loja
                          │
Você ◄──────────────► Claude (entende o pedido, busca, filtra e responde)
     "Mensagem para você mesmo"
```

- O bot entra na sua conta como **aparelho conectado**, como o WhatsApp Web. Não precisa de outro número.
- Você conversa com ele no **"Mensagem para você mesmo"** (o seu próprio contato, "Você", na lista de conversas). Toda resposta dele começa com 🤖.
- As ofertas ficam num arquivo no seu computador. Para o Claude vai só o seu pedido e os trechos das ofertas que a busca encontrou.
- **Alertas:** peça "me avisa quando aparecer X" e ele te chama assim que uma oferta nova bater com o pedido.

## O que você precisa

1. **Um computador que fique ligado** enquanto você quiser que o bot leia os grupos (Windows, Mac ou Linux). Serve também um servidor barato ou um Raspberry Pi. Com o computador desligado, as ofertas desse período não entram. Dá pra recuperar depois pela importação (veja abaixo).
2. **Node.js 22.13 ou mais novo.** Baixe a versão LTS em https://nodejs.org.
3. **Uma chave da API da Anthropic**, criada em https://console.anthropic.com (API Keys). Ela é paga por uso. Veja [Custos](#custos).

## Instalação

No terminal (no Windows, use o "Prompt de Comando" ou o PowerShell):

```sh
cd bot
npm install
cp .env.example .env        # no Windows: copy .env.example .env
```

Abra o `.env` num editor de texto, cole a sua chave em `ANTHROPIC_API_KEY=` e ajuste `GRUPOS` com pedaços dos nomes dos seus grupos de ofertas (ex.: `achad,promo,oferta`). Depois:

```sh
npm start
```

Vai aparecer um QR code. No celular, abra **WhatsApp > Aparelhos conectados > Conectar um aparelho** e leia o QR. Se preferir um código de 8 letras, coloque seu número em `PAREAR_NUMERO` no `.env`.

Conectou? Mande "oi" ou "/ajuda" no **"Mensagem para você mesmo"**.

Na primeira conexão o WhatsApp manda parte do histórico recente, e o bot já guarda as ofertas que vierem nele. Daí em diante, toda oferta nova que chegar nos grupos entra na hora.

## Usando

Escreva do seu jeito:

- `tv 50 lg`
- `air fryer até 400 reais, só das últimas 48h`
- `qual a geladeira frost free mais barata que apareceu essa semana?`
- `tem cupom da shopee hoje?`
- `me avisa quando aparecer lava e seca abaixo de 2500`
- `quais alertas eu tenho?` / `apaga o alerta 2`

Comandos rápidos:

- `/nova`: começa uma conversa do zero (o bot já faz isso sozinho depois de 3 h parado).
- `/status`: quantas ofertas estão guardadas e de quais grupos.
- `/ajuda`: exemplos de uso.

O "Mensagem para você mesmo" é onde muita gente guarda anotações. Para o bot não responder a elas, defina `PREFIXO=?` no `.env`. Aí ele só responde às mensagens que começam com `?` (ex.: `? tv 50 lg`).

## Trazendo o histórico antigo dos grupos

A conexão não baixa o histórico inteiro. Para buscar em ofertas mais antigas, exporte a conversa de cada grupo:

1. No celular, abra o grupo > nome do grupo (ou ⋮) > **Exportar conversa** > **Sem mídia**.
2. Mande o arquivo para o computador (por e-mail, Drive, etc.). Se vier `.zip`, descompacte.
3. Rode:

```sh
npm run importar -- "Conversa do WhatsApp com Achadinhos da Ana.txt" "Conversa do WhatsApp com Promo Brasil.txt"
```

O nome do grupo sai do nome do arquivo. Se o arquivo tiver outro nome, use `--grupo "Nome do grupo"`. Pode importar o mesmo arquivo de novo: o que já estava guardado não duplica.

## Configuração

Tudo fica no `.env` (veja os comentários no `.env.example`):

| Variável | Para quê |
|---|---|
| `ANTHROPIC_API_KEY` | Chave da API (obrigatória). |
| `GRUPOS` | Ler só os grupos cujo nome contém um desses pedaços. Vazio = todos. |
| `GRUPOS_IGNORAR` | Nunca ler esses grupos. |
| `PREFIXO` | Só responder no "você mesmo" ao que começa com isso. |
| `DONOS` | Números que podem falar com o bot em conversa privada (quando ele roda num segundo número). |
| `PAREAR_NUMERO` | Conectar por código em vez de QR. |
| `CLAUDE_MODELO` / `CLAUDE_ESFORCO` | Modelo e esforço de raciocínio. |
| `CONVERSA_EXPIRA_HORAS` | Depois de quanto tempo parado a conversa recomeça. |

Os dados ficam na pasta `dados/`: `ofertas.db` é o banco e `sessao/` é o login do WhatsApp. Apagar `sessao/` desconecta o bot, e na próxima vez ele pede o QR de novo.

## Custos

O WhatsApp e o banco não custam nada. O que se paga é a API do Claude, por pergunta. Uma pergunta com duas ou três buscas no modelo padrão (`claude-opus-5`) deve ficar na faixa de alguns centavos de dólar. Isso é uma estimativa: o valor real aparece no console da Anthropic. Para gastar menos, use `CLAUDE_MODELO=claude-sonnet-5` ou `CLAUDE_ESFORCO=low`. Os alertas não usam a API.

## Deixando rodando sempre

- **No computador:** deixe o terminal aberto com `npm start`.
- **Num servidor Linux:** com o [pm2](https://pm2.keymetrics.io): `npm i -g pm2`, depois `pm2 start npm --name achadinhos -- start` e `pm2 save`. Leia o QR na primeira vez com `pm2 logs achadinhos`.

Se a conexão cair, o bot reconecta sozinho. Se você remover o aparelho pelo celular, ele apaga a sessão e pede um QR novo na próxima vez.

## Avisos importantes

- **Não é oficial.** O WhatsApp não tem API para ler grupos de uma conta pessoal. O bot usa a [Baileys](https://github.com/WhiskeySockets/Baileys), uma biblioteca que fala o mesmo protocolo do WhatsApp Web. Isso vai contra os termos de uso do WhatsApp, que pode desconectar ou, em casos raros, banir contas que usam clientes não oficiais. O risco cresce com envio em massa. Este bot só lê e só escreve para você mesmo, o que é o uso de menor risco, mas o risco existe. Para zerar o risco na sua conta principal, rode o bot num segundo número que participe dos mesmos grupos e preencha `DONOS` com o seu número.
- **Privacidade:** só são guardadas mensagens com link dos grupos permitidos em `GRUPOS`. Conversas privadas nunca são guardadas. O banco fica no seu computador.
- **Limitações:** post que é só imagem, sem texto nem link, não entra. O preço é lido do texto e às vezes erra; nesses casos o Claude lê o texto inteiro e corrige. Algumas lojas bloqueiam robôs, então "abrir o link" nem sempre consegue conferir o preço atual.

## Para desenvolvedores

```sh
npm test
```

- `src/whatsapp.js`: conexão, leitura dos grupos, conversa e alertas.
- `src/agent.js`: conversa com o Claude e as ferramentas (buscar, ver oferta, abrir link, alertas).
- `src/db.js`: banco SQLite com busca de texto (FTS5, sem acento), junção de repostagens e alertas.
- `src/parse.js`: links, preço, loja e título de cada mensagem.
- `src/link.js`: abre links (segue encurtadores, bloqueia endereços internos) e lê título e preço.
- `src/import-export.js`: importação de conversas exportadas (Android e iPhone).
