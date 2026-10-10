# Comece aqui {#start}

O Untzel é um instrumento musical que roda no navegador. Um toque e um loop começa, escolhido numa biblioteca de templates por estilo musical; depois você muda tudo com os dedos ou editando um texto curto, e a música nunca para enquanto isso.

## O que é o Untzel {#what-it-is}

Cada som que você ouve é uma linha de uma pequena linguagem de texto. Os blocos das faixas, a linha do tempo da música e o editor de código editam esse mesmo texto: o que você monta pelo toque aparece como código, e o que você escreve como código aparece nos blocos.

O som é feito no seu aparelho: um motor de som escrito em Rust roda como WebAssembly dentro da thread de áudio do navegador, e a luz do palco segue os mesmos eventos que o motor toca. Nada é transmitido pela rede e não é preciso conta.

O texto é analisado, nunca executado. Não há JavaScript dentro dele, nem funções, nem importações, então é seguro colar um texto que outra pessoa escreveu, ou que um assistente escreveu para você ([Usar IA](ai.md)).

## Tocar para começar {#tap-to-play}

Abra [app.untzel.com](https://app.untzel.com/) e toque em **{{label tapToPlay}}**. O navegador só libera som depois de um gesto, e esse primeiro toque é o que liga o áudio. A música começa no próximo compasso, em modo loop.

Este é o texto que o app toca primeiro, exatamente como este build o traz:

{{template first-touch}}

## O primeiro loop em 2 minutos {#first-loop}

1. Toque em **Code**, ao lado do **Drop**. No celular o código abre numa folha; no computador, no painel lateral.
2. Selecione todo o texto e troque por este:

{{example first-loop}}

3. Pare de digitar. No próximo compasso o texto novo toca.
4. Mude um número, por exemplo `cutoff 500` para `cutoff 1200`. A mudança de um número simples soa na hora; a mudança de um padrão espera o próximo compasso.
5. Quebre algo de propósito: apague uma letra de `kick`. A linha ganha uma marca de erro com a mensagem, e a versão anterior continua tocando. Código inválido nunca para a música.

## Para onde ir depois {#next}

- [Usar o app](app.md): cada tela, gesto e atalho de teclado.
- [Guia da linguagem](language.md): a linguagem, uma ideia por vez, cada uma com um exemplo para colar.
- [Receitas](cookbook.md): grooves, subidas e uma música inteira com os instrumentos que existem hoje.
- [Usar IA](ai.md): um prompt pronto que ensina um assistente a escrever Untzel para você.
