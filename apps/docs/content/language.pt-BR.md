# Guia da linguagem {#language}

O código Untzel é uma linguagem pequena e fechada, feita para música. Ela é analisada, nunca executada: não tem funções, variáveis, laços nem importações, então o mesmo texto toca sempre a mesma música, no app e onde mais for aberto. Palavras-chave, nomes de instrumento, parâmetros e códigos de erro são em inglês; o app mostra cada mensagem de erro no idioma dele.

Todo exemplo desta página toca como está. Copie, cole no painel Code e mude.

## A estrutura de um texto {#structure}

Um texto tem quatro partes, nesta ordem, e todas são opcionais:

1. globais: `title`, `tempo`, `key`, `swing` e `loop`;
2. faixas, uma por linha;
3. seções, com `section`;
4. no máximo um `song`.

Linha vazia é ignorada, e `//` começa um comentário que vai até o fim da linha.

{{example structure}}

Sem `song`, toda faixa que não tem `mute` toca em loop.

## Tempo, tom, swing e loop {#globals}

`tempo` define as batidas por minuto, de {{limit MIN_TEMPO}} a {{limit MAX_TEMPO}}; sem ele o texto toca a {{limit DEFAULT_TEMPO}}. Um valor fora da faixa é erro, nunca um ajuste silencioso.

`key` recebe uma tônica, de `a` a `g` com `b` ou `#` opcional, e uma escala: `minor`, `major`, `dorian`, `phrygian` ou `chromatic`. Sem ele o tom é `c minor`.

`swing` atrasa as colcheias pares, de 0 até {{limit MAX_SWING}}. Cada global aparece uma vez só.

{{example globals}}

### Comprimento do loop {#loop-length}

`loop` define quantos compassos dura uma passada do modo Loop, um número inteiro de {{limit MIN_LOOP_BARS}} a {{limit MAX_LOOP_BARS}}. Em cada passada todos os padrões e sinais recomeçam do compasso 1: um padrão de 2 compassos toca 4 vezes num `loop 8`, e um padrão mais longo que o loop toca só os primeiros compassos. Sem `loop`, cada padrão se repete no próprio tamanho, como antes.

{{example loop-length}}

Um comprimento novo entra no próximo compasso e a música nunca para. O modo Song ignora `loop`: ali mandam as seções e a linha `song`. `loop` continua sendo nome de faixa válido e a palavra do fim de `song … | loop`. O chip **Length** do transporte escreve essa linha por você ([Usar o app](app.md#loop-length)).

### Título da música {#title}
`title "Midnight Coast"` dá nome à música: até 60 caracteres entre aspas duplas, onde `\"` escreve uma aspa e `\\` uma barra invertida. Ele nunca muda o som. O app mostra o título na barra de cima e na aba do navegador, e ele vai para os nomes dos arquivos, para o vídeo exportado e para o link compartilhado. Renomear a música no app escreve essa linha ([Usar o app](app.md#projects)). Título vazio ou com mais de 60 caracteres é aviso, não erro: a música continua tocando, sem título ou com os 60 primeiros caracteres. Uma segunda linha `title` é erro, como um segundo `tempo`. `title` continua sendo nome de faixa válido.

{{example title}}

## Faixas com nome {#tracks}

Uma linha de faixa tem um nome opcional seguido de dois-pontos, um instrumento, um padrão e modificadores depois de `|`. O nome é como seções, blocos e mensagens se referem à faixa. Nomes são minúsculos, começam por letra e têm no máximo {{limit MAX_NAME_LENGTH}} caracteres.

Duas faixas podem usar o mesmo instrumento com padrões e sons diferentes: cada faixa é uma instância independente. Uma faixa sem nome recebe o nome do instrumento, ou o próximo número livre.

{{example named-tracks}}

A ordem das linhas é a ordem das faixas na tela.

## Padrões: a mini-notação {#mini-notation}

Um padrão descreve um compasso; `/` separa os compassos de um padrão mais longo, que se repete quando acaba. Os passos de um compasso dividem o tempo por igual.

| Escreva | Quer dizer |
|---|---|
| `x` `X` `.` | uma batida, uma batida acentuada, uma pausa. Numa sequência como `x...` cada caractere é um passo |
| `~` | prolonga o passo anterior por mais um passo: `x~~~` segura uma batida por quatro passos |
| `c2` `eb2` `f#1` | uma nota com a oitava, para instrumentos que tocam notas |
| `[x x]` | um grupo: subdivide um passo |
| `x?` `x?0.3` | toca com uma chance; sem número a chance é {{limit DEFAULT_PROBABILITY}} |
| `x*4` `[c2 g1]*2` | repete dentro do mesmo passo |
| `/` | o próximo compasso do padrão |

{{example mini-notation}}

### Contar passos {#steps}

Espaços separam elementos, mas numa sequência de batidas cada caractere já é um passo, então `x... x...` e `x...x...` são os mesmos oito passos. `x... x... x... x...` é um compasso de 16 passos, cada um uma semicolcheia; `c2 . eb2 c3 . c2 g1 .` tem 8 passos, cada um uma colcheia. Um compasso tem no máximo {{limit MAX_STEPS_PER_BAR}} passos e grupos se aninham no máximo {{limit MAX_GROUP_DEPTH}} níveis.

## Notas e acordes {#notes}

Instrumentos que tocam notas recebem nomes de nota em minúscula com a oitava: `c1`, `eb2`, `f#1`. Um `.` é pausa e `~` segura a nota.

{{example notes}}

Notas ligadas por `+` soam juntas num passo, como um acorde que você mesmo abre: `c3+eb3+g3`. Um `!` depois de uma batida ou de uma nota a acentua, como o `X` na bateria.

{{example stacks-and-accents}}

Nomes de acorde começam com maiúscula, como `Cm7`, `Abmaj7` ou `Gsus4`, e precisam de um instrumento do tipo chord. Escrever um acorde para um instrumento que toca notas é o erro `PATTERN_KIND_MISMATCH` ([referência](reference.md#error-pattern-kind-mismatch)).

{{status chords}}

## A trava de tom {#scale-lock}

Com `key`, toda nota fora da escala vai para o grau mais próximo dela, então nota errada é impossível. `| free` desliga a trava numa faixa, e `key c chromatic` desliga no texto inteiro.

{{example scale-lock}}

## Modificadores {#modifiers}

Modificadores vêm depois do padrão, cada um depois de um `|`, e são lidos da esquerda para a direita. Se o mesmo modificador aparece duas vezes, vale o último, e o anterior recebe o aviso `DUPLICATE_MODIFIER`; aviso nunca para a música.

Há modificadores gerais que toda faixa aceita (`gain`, `pan`, `tone`, `reverb`, `delay`, `duck`, `transpose`, `swing`, `shift`, `mute`, `free`) e os parâmetros de cada instrumento, como `cutoff` no `bass` ou `open` no `hat`. A tabela completa com cada faixa está na [referência](reference.md#general-modifiers), e cada parâmetro de instrumento está na página [Instrumentos](instruments.md).

{{example modifiers}}

Quando `tone` e um parâmetro que ele move aparecem juntos, vence o parâmetro escrito.

## Sinais {#signals}

Todo parâmetro numérico que permite pode receber uma onda lenta no lugar de um número: uma forma, um período em compassos e uma faixa. A faixa é obrigatória e fica dentro dos limites do parâmetro; o período é de no máximo {{limit MAX_SIGNAL_PERIOD}} compassos.

| Forma | Move |
|---|---|
| `sine(8)` | sobe e desce suave |
| `tri(4)` | sobe e desce em linha reta |
| `saw(4)` | sobe e recomeça |
| `square(2)` | alterna entre os dois extremos |
| `rand(1)` | vai para um valor novo a cada período, o mesmo em toda execução |

{{example signals}}

Numa música, o sinal recomeça no início de cada seção, então `saw(4)` numa seção de 4 compassos sobe exatamente do começo ao fim dela ([Receitas](cookbook.md#saw-build)).

## Seções e a música {#sections}

`section` dá nome a um conjunto de faixas que tocam juntas; uma faixa pode estar em quantas seções quiser. Uma seção pode mudar o `tempo` a partir do seu início e o `gain` de todas as suas faixas. `song` toca as seções em ordem, cada uma por um número de compassos, de {{limit MIN_PART_BARS}} a {{limit MAX_PART_BARS}}; a mesma seção pode voltar.

{{example sections-and-song}}

### Repetir a música {#song-loop}

Uma música para quando acaba. Com `| loop` no fim da linha `song`, ela recomeça.

{{example song-loop}}

### Seções sem música {#sections-without-song}

{{example sections-without-song}}

## Modos Loop e Song {#modes}

O modo não fica escrito no texto: é um seletor do transporte, como tocar e parar. No modo Loop toda faixa sem `mute` toca sem fim, em passadas de `loop <bars>` quando o texto tem, e as seções são ignoradas. No modo Song as partes tocam em ordem; com seções e sem `song`, cada seção toca 8 compassos, em ordem, em ciclo. `mute` silencia a faixa nos dois modos, mesmo dentro de uma seção. O trecho de execução também não é escrito: escolher quais compassos ou partes repetem muda como você toca, nunca o texto ([Usar o app](app.md#play-range)).

## Limites {#limits}

A linguagem não limita faixas, faixas por instrumento, seções nem partes da música; o aparelho limita, e o medidor de CPU mostra quanto está em uso. Os limites fixos protegem o analisador e mantêm o texto legível: um texto tem no máximo {{limit MAX_SOURCE_LENGTH}} caracteres, um padrão no máximo {{limit MAX_BARS_PER_PATTERN}} compassos. Todos os limites estão na [referência](reference.md#limits).

## Determinismo {#determinism}

A chance (`?`) e o `rand` são sorteados a partir de uma semente feita do próprio texto, do nome da faixa e do compasso. O mesmo texto toca as mesmas notas toda vez, em qualquer aparelho. Mude um caractere do texto e o sorteio muda; a linha `title` é a exceção, então renomear uma música nunca muda o que ela toca.
