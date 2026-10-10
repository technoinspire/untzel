# Referência da linguagem {#reference}

A linguagem completa numa página: ordem, declarações, valores, cada modificador, cada limite, a gramática e cada erro com mensagem e correção. Os números das tabelas vêm do analisador deste build. O [guia](language.md) explica o mesmo com exemplos.

## Ordem de um texto {#order}

Globais, depois faixas, depois seções, depois a música. Cada global (`title`, `tempo`, `key`, `swing`, `loop`) no máximo uma vez, e no máximo um `song`. Texto fora desta ordem é o erro `OUT_OF_ORDER`.

| Declaração | Forma |
|---|---|
| título | `title "<text>"`, até 60 caracteres; `\"` escreve uma aspa e `\\` uma barra invertida |
| tempo | `tempo <bpm>` |
| tom | `key <tonic> <scale>`, tônica de `a` a `g` com `b` ou `#` opcional; escala `minor`, `major`, `dorian`, `phrygian` ou `chromatic` |
| swing | `swing <amount>` |
| loop | `loop <bars>`, um número inteiro |
| faixa | `[<name>:] <instrument> <pattern> ( \| <modifier> [value] )*` |
| seção | `section <name> <track> <track>... ( \| tempo <bpm> ) ( \| gain <value> )` |
| música | `song <section> <bars>, <section> <bars>... [ \| loop ]` |

O tempo vai de {{limit MIN_TEMPO}} a {{limit MAX_TEMPO}}, com {{limit DEFAULT_TEMPO}} como padrão; o swing, de 0 a {{limit MAX_SWING}}; o loop, de {{limit MIN_LOOP_BARS}} a {{limit MAX_LOOP_BARS}} compassos, ausente por padrão; o tom padrão é `c minor`.

## Nomes {#names}

Nomes de faixa e de seção seguem `[a-z][a-z0-9_-]*`, com no máximo {{limit MAX_NAME_LENGTH}} caracteres, únicos entre as faixas e únicos entre as seções. Uma faixa sem nome recebe o nome do instrumento, ou `<instrumento><n>` com o próximo número livre a partir de 2: primeiro se reservam os nomes escritos, depois as faixas sem nome são numeradas na ordem do texto. Só nomes escritos repetidos dão o erro `DUPLICATE_TRACK_NAME`.

## Elementos do padrão {#patterns}

| Elemento | Exemplo | Significado |
|---|---|---|
| batidas | `x...`, `X.x~` | cada caractere um passo: batida, acento, pausa, sustentar |
| nota | `c2`, `eb2`, `f#1` | minúscula, `b` ou `#` opcional, dígito da oitava |
| acorde | `Cm7`, `Abmaj7` | fundamental maiúscula, `b` ou `#` opcional, qualidade `m`, `7`, `m7`, `maj7`, `sus2`, `sus4` ou `dim` (sem qualidade é maior) |
| pausa | `.` | um passo em silêncio |
| sustentar | `~` | o elemento anterior por mais um passo |
| grupo | `[x x]` | subdivide um passo; aninha no máximo {{limit MAX_GROUP_DEPTH}} níveis |
| chance | `x?`, `c2?0.3` | toca com aquela chance, {{limit DEFAULT_PROBABILITY}} sem número |
| repetição | `x*4` | inteiro de {{limit MIN_REPEAT}} a {{limit MAX_REPEAT}}, dentro do mesmo passo |
| compasso | `/` | o próximo compasso do padrão |

Bateria toca batidas, instrumentos com nota tocam notas, instrumentos de acorde tocam acordes; o resto é `PATTERN_KIND_MISMATCH`.

## Modificadores gerais {#general-modifiers}

Toda faixa aceita estes, qualquer que seja o instrumento. Os parâmetros de cada instrumento estão na página [Instrumentos](instruments.md).

{{general-modifiers}}

`reverb` e `delay` enviam para barramentos compartilhados: os espaços de reverb citados na tabela e três linhas de delay. Os espaços são predefinições de uma reverb algorítmica, não gravações de lugares.

## Modificadores de seção {#section-modifiers}

{{section-modifiers}}

## Valores e sinais {#values}

Um valor é um número, um nome (`sea`), uma divisão (`3/16`) ou um sinal com faixa: `sine(8) 300..2400`. As formas de sinal são `sine`, `tri`, `saw`, `square` e `rand`. A faixa é obrigatória e precisa caber no parâmetro; o período é maior que 0 e de no máximo {{limit MAX_SIGNAL_PERIOD}} compassos. O sinal recomeça no início de cada seção de uma música.

## Quando as mudanças tocam {#timing}

A mudança de um número constante toca na hora. Toda outra mudança, estrutural, espera o próximo compasso ainda não agendado. No modo Song, uma parte na fila e a troca de modo esperam a próxima frase de 4 compassos.

## Limites {#limits}

{{limits}}

## Gramática {#grammar}

A gramática normativa é a gramática Lezer da qual o analisador do app é gerado. As palavras-chave estendem nomes, então `sine:` e `loop:` continuam sendo nomes de faixa válidos, e uma faixa sem padrão é aceita pela gramática e depois falha com `EMPTY_PATTERN`.

{{grammar}}

## Erros {#errors}

A análise nunca lança exceção: devolve o programa ou uma lista de diagnósticos, cada um com posição, código estável e mensagem, que o app mostra no idioma dele (o texto inglês é a fonte). Erros de sintaxe dão um diagnóstico por linha. Os códigos são um contrato estável; as mensagens podem mudar. As mensagens abaixo são as que o app mostra hoje em português; na página em inglês, as inglesas.

{{diagnostics}}
