# Instrumentos {#instruments}

Todos os instrumentos deste build, gerados do manifesto de cada um: o mesmo arquivo que o analisador, o detalhe da faixa e o motor de som leem. Se não está nesta página, o app não tem.

Cada parâmetro é um modificador da faixa: `| cutoff 900`. O valor pode ser um número dentro da faixa ou um sinal ([Guia da linguagem](language.md#signals)). Uma curva exponencial anda por igual pelas oitavas da faixa, como o ouvido percebe frequência e tempo. O `tone` é o macro de um dedo do bloco: de 0 a 1 ele move os parâmetros listados em cada instrumento entre os dois valores mostrados. Um parâmetro escrito no texto vence o `tone`.

Alguns instrumentos tocam gravações. Em `piano`, `strings`, `harp`, `mallet`, `bell`, `kalimba` e `choir` o parâmetro `source` vale `samples` por padrão, e `| source synth` toca a voz sintetizada no lugar; no `vox`, os sons `ooh` e `aah` tocam cantores gravados. Uma gravação só é baixada quando uma faixa a usa, e até ela chegar toca a voz sintetizada, então a música nunca espera ([Créditos](credits.md)). O nome de modelo de cada instrumento é o nome que a biblioteca mostra; a palavra que você escreve no texto é sempre a do título.

O tipo decide o que um padrão pode conter: bateria toca batidas (`x . ~`), instrumentos com nota tocam notas (`c2`), instrumentos de acorde tocam acordes (`Cm7`).

{{status instrument-library}}

{{instruments}}
