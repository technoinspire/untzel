# Receitas {#cookbook}

Receitas que tocam como estão, escritas só com os instrumentos deste build ([Instrumentos](instruments.md)). Cole uma no painel Code, deixe tocar e mude uma coisa de cada vez.

## Um groove melódico a 124 BPM {#melodic-groove}

Um bumbo constante, duas camadas de hat e um sub, sob uma melodia de baixo que passa por quatro acordes de lá menor, um por compasso. O filtro da melodia abre e fecha ao longo de 16 compassos com `sine(16)`, e `delay 3/16` com `reverb wide` dão espaço a ela. O `duck` faz o sub e a melodia abaixarem a cada bumbo.

{{example cookbook-melodic-groove}}

Experimente `swing 0.12` para um balanço mais solto, ou `pitch 42` no bumbo para um som mais grave.

## Baixo rolando com duck {#rolling-bass}

O baixo toca três semicolcheias depois de cada bumbo e sai do caminho dele com `duck 0.85`: quanto maior o valor, mais fundo ele abaixa quando o bumbo bate. Um `decay` curto deixa as notas secas.

{{example cookbook-rolling-bass}}

Experimente `cutoff 1200` para um baixo mais brilhante, ou mude as três últimas notas do compasso para outra virada.

## Percussão com swing e chance {#percussion}

O `swing` global balança todas as faixas; o shaker troca pelo seu próprio `swing 0.2`. `x?0.3` no bumbo fantasma e `x?0.5` dentro do grupo do shaker tocam só parte das vezes, e `pan rand(2)` leva o shaker para outro lugar a cada dois compassos. Os sorteios são determinísticos: o mesmo texto toca sempre igual.

{{example cookbook-percussion}}

Experimente subir uma chance para `x?0.8`, ou `[x x?0.5]*4` para um shaker mais lento.

## Subidas com saw {#saw-build}

Numa música, o sinal recomeça no início de cada seção, então `saw(4)` numa seção de 4 compassos sobe exatamente do primeiro ao último compasso dela. Aqui os hats abrem, o rufar cresce e o filtro do baixo sobe até o drop, que recomeça o ciclo.

{{example cookbook-saw-build}}

Experimente `build 8` com `saw(8)` para uma subida mais longa.

## Uma música inteira com seções {#full-song}

O groove da primeira receita como música: introdução, subida, drop, pausa, outra subida e outro drop, e final. As seções escolhem quais faixas tocam; a linha `song` decide quantos compassos cada uma dura. Ponha o transporte em `Song` para ouvir do começo.

{{example cookbook-full-song}}

Experimente outra ordem na linha `song`, ou `| loop` no fim dela.
