# Usar IA {#ai}

Um assistente como ChatGPT, Claude ou Gemini consegue escrever código Untzel para você, se conhecer a linguagem antes. O prompt abaixo ensina tudo o que ele precisa: a sintaxe, os instrumentos deste build com cada parâmetro e faixa, os limites e os erros. Depois você pede a música com suas palavras e cola a resposta no app.

## Como funciona {#how}

1. Copie o prompt abaixo e cole no começo de uma conversa com o assistente.
2. Peça o que quer ouvir: um estilo, um tempo, um clima, uma estrutura.
3. O assistente responde com um bloco de código Untzel. Copie só o código.
4. Cole no painel Code. Ele toca no próximo compasso.

O prompt é gerado das mesmas fontes destas páginas, então sempre lista os instrumentos e os limites deste build. Ele está em inglês porque o código é em inglês; o assistente responde no idioma em que você escrever. O mesmo texto está em [llms-full.txt](https://untzel.com/docs/llms-full.txt), para ferramentas que leem direto.

## O prompt {#prompt}

{{ai-prompt}}

## Pedidos de exemplo {#examples}

Três pedidos e uma resposta que segue o prompt. Cada resposta toca como está.

### Um groove melódico {#example-groove}

"Escreva um loop a 124 BPM em lá menor, profundo e hipnótico, com uma melodia no baixo."

{{example ai-groove}}

### Uma subida antes do drop {#example-build}

"Acrescente uma subida de 4 compassos antes do drop, com rufar nos hats e o filtro abrindo."

{{example ai-build}}

### Uma música inteira {#example-song}

"Transforme em uma música inteira de uns três minutos, com introdução, dois drops e uma pausa."

{{example ai-song}}

## Colar no painel Code {#paste}

Abra **Code**, ao lado do **Drop**, selecione todo o texto e cole a resposta por cima. Copie só o que está dentro do bloco de código: as linhas antes e depois são o assistente conversando. Quando você para de digitar, o texto é analisado, e se for válido toca no próximo compasso. No modo Song a música começa da primeira parte.

## Ler os erros {#errors}

Se a resposta tiver um erro, o app sublinha o trecho e mostra um código e uma mensagem no idioma do app, como `UNKNOWN_MODIFIER` com `"bass" não tem o parâmetro "cutof". Você quis dizer "cutoff"?`. A versão anterior continua tocando. Copie a mensagem de volta para o assistente e peça para corrigir exatamente aquilo; o prompt ensina todos os códigos. A [referência](reference.md#errors) lista cada erro com a correção.

## Bons pedidos {#tips}

- Diga o tempo e o tom, ou peça para o assistente escolher.
- Diga as partes que quer: um loop, ou uma música com introdução, subida, drop, pausa.
- Peça uma mudança por vez quando gostar da música: "mais swing nos hats", "um baixo mais escuro".
- Peça instrumentos que o app tem. Se pedir um que não existe, o prompt manda o assistente avisar e usar o mais próximo.
