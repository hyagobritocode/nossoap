# Nosso apê

Site estático para planejar as compras grandes do apartamento. Começa com seis itens:
guarda-roupa, painel de TV, lavadora, ar-condicionado, televisão e mesa de jantar.

Para cada item dá para:

- guardar opções de compra (link, modelo, preço, loja e foto) e escolher uma;
- marcar a situação: pesquisando, escolhido ou comprado (com o valor pago);
- anotar medidas e observações.

O topo soma o que já tem preço e, se vocês definirem um teto de gastos, mostra quanto sobra.
Novos itens entram pelo botão "Adicionar outro item".

## Rodar

Não tem build. Abra `index.html` direto no navegador ou sirva a pasta:

```sh
python3 -m http.server
```

Os dados ficam no `localStorage` do navegador (chave `nosso-ape-v7`), então cada aparelho tem a sua cópia.

## Arquivos

- `index.html`, `styles.css`, `app.js`: a página inteira, sem dependências.
- `assets/rooms/`: fotos reais dos cômodos em WebP (versão grande e `-sm`).
- `assets/fonts/`: Geist (SIL OFL), servida localmente.
- Ícones: [Tabler Icons](https://tabler.io/icons) (MIT), embutidos em `app.js`.
