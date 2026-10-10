# Usar o app {#app}

O Untzel é uma página só: faixas, música, código e detalhe da faixa abrem como abas e folhas sobre o palco, então navegar nunca interrompe o som. Os rótulos abaixo são os que o app mostra no idioma desta página.

## A tela {#screen}

- **Barra superior**, sobre o palco: o logotipo do Untzel, com link para untzel.com, um divisor e o título da música ([Projetos e o título da música](#projects)). No computador, **{{label saved}}** ao lado do título diz que o projeto está guardado neste aparelho. À direita, **{{label export}}** e **{{label menu}}** ([O menu](#menu)). O Export fica inativo até o primeiro toque: ele age sobre a música que toca.
- **Palco**: a luz. Ela reage às notas enquanto tocam e é decorativa para leitores de tela.
- **Transporte**: tocar e parar, tempo, tom, modo e posição. Depois, o botão que esconde os controles, **Code** e **Drop**. No computador o transporte é uma linha só, com o seletor `Loop` / `Song`. Abaixo dele, nos dois modos, o trecho de execução e a régua dele ([Trecho de execução](#play-range)); no modo Loop o chip **Length** fica ao lado ([Comprimento do loop](#loop-length)). O medidor de CPU fica no transporte a partir de 1024 px de largura; numa tela mais estreita ele vai para o rodapé da biblioteca de instrumentos.
- **Faixas**: uma grade de blocos no celular, uma tabela no computador.
- **Música**: as partes da música em lista, na ordem em que tocam. Uma aba no celular; no computador, ao lado das faixas no modo Song.
- **Code**: o próprio texto.
- **Rodapé**: a linha "Powered by Untzel · Techno Inspire", em toda a largura e sempre na tela. Nada que o app abre cobre o rodapé.

## Tela de espera e templates {#waiting}

Antes do primeiro toque o palco mostra uma névoa lenta e o botão **{{label tapToPlay}}**. Abaixo dele, **{{label startFromTemplate}}** mostra a biblioteca de templates: a lista **{{label musicStyle}}**, com todos os estilos musicais em ordem alfabética e o número de projetos de cada um, e abaixo os projetos do estilo aberto em cartões com nome, tempo e tom, lidos do próprio texto. No teclado, digite as primeiras letras de um estilo para pular até ele. Toque num cartão e depois em **{{label tapToPlay}}**, e aquele projeto toca; tudo num template pode mudar: adicione faixas, edite cada passo e cada som, monte uma música inteira. Sem escolha, o primeiro toque toca o template marcado como o primeiro.

Quando este aparelho já tem um projeto, a tela de espera também oferece **Continuar** seguido do título do projeto editado por último, que o abre ([Projetos e o título da música](#projects)).

O cartão **{{label blank}}** vem antes da lista de estilos. Escolhido, o botão vira **{{label startFromScratch}}**: liga o som e abre um projeto vazio, sem tocar. Sem nenhuma faixa, a área das faixas diz **{{label startWithSound}}** e oferece **{{label addTrack}}** e quatro atalhos (kick, baixo, hats, acordes): cada um entra com um padrão pronto, no tom do projeto, e dá play na música.

A biblioteca deste build, gerada da pasta de templates. Os nomes dos projetos são nomes, não texto traduzível, então ficam iguais em todos os idiomas:

{{templates}}

{{status more-templates}}

{{status saved-session}}

## O menu {#menu}

**{{label menu}}**, à direita da barra superior, abre um menu só para o app inteiro: uma folha no celular, um painel sob o botão no computador. As setas percorrem todos os itens na ordem de leitura, `Home` e `End` vão às pontas, uma letra salta para o próximo item que começa com ela, e `Esc` fecha o menu e devolve o foco ao botão. Os grupos, nesta ordem:

- **{{label menuProject}}**: **{{label newProject}}** (em branco ou de um template), **{{label openProject}}**, **{{label renameSong}}**, **{{label duplicate}}**, **{{label saveFile}}**, **{{label openFileMenu}}** e **{{label deleteProject}}**, que pode ser desfeito por 10 segundos. Sem projeto aberto, só ficam os itens que não precisam de um.
- **{{label menuShareExport}}**: **{{label shareLinkMenu}}** e **{{label exportMedia}}** ([Share e Export](#share-export)). O grupo só aparece com um projeto aberto. Como o **{{label export}}**, os dois ficam inativos até o primeiro toque, e a dica diz por quê.
- **{{label menuSettings}}**: **{{label language}}**, com Português e English, troca todos os rótulos de uma vez, sem recarregar; a escolha fica salva neste aparelho. **{{label previewSounds}}** toca as notas enquanto você as edita. **{{label reducedMotion}}** segue o sistema até você mudar aqui, e então diz que foi definido neste aparelho. Os interruptores e o idioma mantêm o menu aberto.
- **{{label menuHelp}}**: **{{label documentation}}**, que abre estas páginas numa aba nova, **{{label keyboardShortcuts}}** e **{{label aboutLicence}}**.

Esta documentação e o app ficam em endereços diferentes, então o idioma escolhido aqui não passa para o app: escolha-o no menu do app.

## Projetos e o título da música {#projects}

Todo projeto tem um título. O título é a linha `title` do texto ([Guia da linguagem](language.md#title)): a barra superior o mostra, a aba do navegador diz `<título> · Untzel`, e ele dá nome aos arquivos que você salva e exporta. Toque no título da barra superior, ou escolha **{{label renameSong}}** no menu, para renomear a música: `Enter` ou sair do campo renomeia, `Esc` desiste. Um projeto novo se chama **{{label untitled}}**, um template mantém o nome do template, um link recebido abre como **{{label remixPrefix}}** seguido do título, e uma duplicata ganha **{{label copySuffix}}**.

Os projetos ficam salvos neste navegador, neste aparelho, e nunca saem dele. Um projeto é guardado um segundo depois da sua primeira edição, e de novo um segundo depois de cada edição seguinte; um template que você só tocou não cria nada. `Mod+S` salva na hora, sem diálogo. **{{label openProject}}** lista os projetos deste aparelho, o editado por último primeiro, cada um com quando foi editado, o tempo e quantas faixas tem; os botões dele renomeiam, duplicam, salvam como arquivo ou apagam, e uma busca aparece acima de oito projetos. Abrir, criar, duplicar ou apagar um projeto para a música de forma limpa e volta à tela de espera; nada do que você editava se perde no caminho.

Limpar os dados do navegador apaga os projetos: **{{label saveFile}}** guarda uma cópia. Onde o navegador se recusa a guardar (janela anônima, disco cheio), o app avisa e o projeto aberto continua tocando; ele só não é salvo.

{{status projects}}

{{status song-title}}

## Faixas {#tracks}

Cada faixa é um bloco com o nome, o instrumento, uma miniatura de 16 passos e um botão de ajuste.

| Gesto no bloco | O que acontece | Quando |
|---|---|---|
| toque | liga ou desliga a faixa | no próximo compasso; um anel enche até lá |
| arrastar para cima ou para baixo | move o `tone` da faixa | na hora |
| segurar | solo enquanto segura | na hora |
| botão de ajuste | abre o detalhe da faixa | |

No computador a tabela mostra nome, padrão, `M` (mute), `S` (solo) e `tone` de cada faixa.

Todo nome que o app mostra se edita onde aparece: a faixa no cabeçalho do detalhe, ou com duplo clique e o lápis na tabela; a parte no lápis da linha dela e no cabeçalho do editor. Letras minúsculas, números, `-` ou `_`, começando com letra, até 24 caracteres; as palavras da linguagem não servem de nome. `Enter` ou sair do campo renomeia, `Esc` ou **{{label cancel}}** desiste, e um nome errado é explicado embaixo do campo e nunca escrito. Renomear uma faixa renomeia também em cada `section`; renomear uma parte renomeia no `song`. Uma edição, um passo de desfazer, e a música continua tocando.

## Adicionar faixa {#add-track}

O último bloco é sempre **{{label addTrack}}**. Ele abre a biblioteca de instrumentos: uma busca por nome, nome de modelo, som, descrição e tags, os chips **{{label all}}** e nove categorias (Bateria, Baixo, Teclas, Plucks, Pads, Metais, Leads, Vozes, FX), e os instrumentos agrupados, cada um com o nome de modelo, quantas faixas já o usam, a descrição e o número de sons. Um grupo mostra três instrumentos até você pedir todos.

O botão de tocar de uma linha faz a prévia do instrumento no tom da sua música, com a música tocando; os sons dele aparecem como chips, e tocar num troca a prévia. O botão de adicionar põe o instrumento com o som que você está ouvindo. A faixa nova recebe o próximo nome livre (`hat2`, `bass3`), o padrão inicial do instrumento e começa no próximo compasso; a folha fecha e abre o detalhe da faixa nova. O mesmo instrumento pode ser escolhido quantas vezes quiser: cada faixa é uma instância própria. Quando nada combina, a folha sugere até três nomes parecidos.

`piano`, `strings`, `harp`, `mallet`, `bell`, `kalimba` e `choir` tocam gravações, e os sons `ooh` e `aah` do `vox` também ([Instrumentos](instruments.md), [Créditos](credits.md)). Uma gravação só é baixada quando uma faixa a usa; até ela chegar, o instrumento toca a voz sintetizada, então a música nunca espera.

{{status recorded-voices}}

{{status recorded-instruments}}

{{status instrument-library}}

## Detalhe da faixa {#track-detail}

O detalhe mostra tudo de uma faixa: solo e mute, a duração do padrão, os passos por compasso, os compassos do padrão, a grade de passos, o som, os efeitos e a mixagem. **{{label duplicate}}** e **{{label delete}}** ficam no rodapé.

- O chip **Padrão** escolhe quantos compassos o padrão tem; compassos novos repetem o último. **{{label stepsPerBar}}**, `8 · 16 · 32`, reescreve todos os compassos da faixa; os passos que já existem mantêm o lugar no tempo.
- As miniaturas mostram os passos de cada compasso; o que você edita tem contorno laranja e o que toca, uma marca branca. As setas, ou deslizar na grade, trocam o compasso em edição, e **{{label copyBar}}**, **{{label pasteHere}}** e **{{label clearBar}}** agem sobre ele.
- Na bateria, tocar num passo liga ou desliga. Num instrumento com notas, tocar num passo o escolhe e abre o seletor de nota: qualquer nota do alcance do instrumento, sustentar ou pausa, acordes num instrumento de acordes, e **{{label scaleLock}}**, que mantém o passo na escala da sua música. Com **{{label previewSounds}}** ligado, aqui ou no menu, as notas tocam enquanto você as edita.
- **{{label sound}}**: o seletor de som lista os sons do instrumento com as descrições, e abaixo dele vem um controle para cada parâmetro do instrumento ([Instrumentos](instruments.md)).
- **{{label effects}}**: os efeitos de inserção na ordem da cadeia, cada um com seus controles e um ×; **{{label addEffect}}** põe mais um no fim da cadeia.
- **{{label patterns}}**, sob solo e mute: os padrões prontos do instrumento em chips, com o atual marcado. Um toque faz a prévia do padrão na própria faixa, a partir do próximo compasso e por 16 compassos, sem mudar o texto; um segundo toque, ou **Usar**, escreve. Os padrões já entram no tom da sua música.
- **{{label changeSound}}**, ao lado de **{{label sound}}**, troca o instrumento e mantém o padrão: a biblioteca abre só com os instrumentos que conseguem tocá-lo e diz o que fica e o que sai.
- O **Tone** é um botão só sobre vários parâmetros. Quando o texto escreve um deles (`open`, `cutoff`), esse parâmetro manda: o controle diz quem o define, e **{{label useTone}}** tira o parâmetro escrito, com Desfazer.
- **{{label mix}}**: o `gain` é um fader em dB, de Off passando por −60 dB até +6 dB, com 0 dB a três quartos do curso; um toque duplo volta a 0 dB. O texto continua com o `gain` como número simples (`gain 1` é 0 dB). Depois vêm `pan`, `reverb` e `duck`.

Toda mudança aqui vira uma pequena edição do texto, que pode ser desfeita.

## Transporte e Drop {#transport}

**Drop**, no modo loop, liga numa edição só todas as faixas com `mute`, no próximo compasso. No modo música ele fica no lugar, sem efeito.

O tempo e o tom no transporte são botões. O tempo abre `−`, um campo e `+`, de {{limit MIN_TEMPO}} a {{limit MAX_TEMPO}} BPM, e **{{label tapTempo}}** (quatro toques, ou `T` no teclado). O tom abre as doze tônicas e as escalas `minor`, `major`, `dorian`, `phrygian` e `chromatic`; as notas fora da escala nova vão para a nota mais próxima dentro dela. O tom se escreve em minúsculas, como no texto (`a minor`), em todos os idiomas. Os dois entram no próximo compasso. No modo Song, quando a parte que toca tem `| tempo` próprio, o botão mostra o tempo que soa e o editor, **{{label songTempo}}**, continua editando a linha `tempo`.

**{{label undo}}** e **{{label redo}}** ficam no transporte no celular e no cabeçalho do painel Code no computador, e dizem o que desfizeram. No teclado, `Ctrl+Z` e `Ctrl+Shift+Z` (`Command` no Mac).

O medidor de CPU mostra quanto do aparelho a música usa. A linguagem não limita o número de faixas; o aparelho limita, e o medidor é como você vê isso. A partir de 1024 px de largura ele fica no transporte; numa tela mais estreita fica no rodapé da biblioteca de instrumentos, e acima de 80% a biblioteca avisa que o aparelho está perto do limite.

## Comprimento do loop {#loop-length}

No modo Loop o transporte tem o chip **Length** (no app em português o chip mostra só a duração, por exemplo **8 compassos**). Ele abre a escolha de duração, 1, 2, 4, 8 ou 16 compassos; um toque escolhe e fecha, e `[` e `]` andam pelas mesmas durações no teclado. O chip escreve `loop <bars>` no texto ([Guia da linguagem](language.md#loop-length)) e o comprimento novo entra no próximo compasso, sem parar a música. Qualquer outra duração, até {{limit MAX_LOOP_BARS}}, se escreve no painel Code, e o chip passa a mostrá-la como escrita. O chip some no modo Song, em que a música decide a duração.

{{status loop-length}}

## Trecho de execução {#play-range}

Sob o transporte, uma régua mostra o loop, um segmento por compasso, ou a música, um bloco por parte, com o compasso que toca aceso. Nela você escolhe o trecho de execução: o pedaço que repete enquanto você trabalha, de um compasso até todos.

- Arraste uma das duas alças, ou toque um primeiro compasso e depois um último. A linha acima da régua diz o que está escolhido, `Trecho: compassos 3–6`; o × dela (`Limpar trecho`) volta ao loop ou à música inteira.
- No teclado, uma alça com foco anda um compasso com as setas e quatro com `Shift` ou com `PageUp` e `PageDown`; `Home` e `End` vão às pontas.
- A posição acompanha o trecho: `Loop · compassos 3–6 de 8 · compasso 4`.
- O trecho entra no próximo compasso e a música nunca para. Fora do trecho novo, a música salta para o início dele nessa virada; dentro, segue sem salto.

No modo Loop o trecho sempre repete. No modo Song a linha tem o interruptor **Cycle**: ligado, o trecho repete; desligado, a música começa ali e segue pelo resto da música.

O trecho é como você toca, não o que a música é, como tocar, parar e o modo. Ele nunca é escrito no texto, então desfazer não o desfaz, e por enquanto também não vai no link nem no arquivo: dura enquanto o app está aberto. Cada modo guarda o seu.

{{status play-range}}

## Loop e Song {#modes}

No modo **Loop** toda faixa sem `mute` toca sem fim. No modo **Song** as seções tocam na ordem da linha `song` ([Guia da linguagem](language.md#sections)). Trocar de modo tocando vale a partir da próxima frase de 4 compassos, e entrar em Song começa da primeira parte.

No modo Song as partes da música são uma lista, na ordem em que tocam: cada uma com o nome, a duração e quantas faixas tem; a que toca enche conforme avança. Cada linha tem o próprio botão de tocar, `Tocar só <parte>`: ele põe o trecho naquela parte com o **Cycle** ligado, e a parte toca sozinha, em volta, a partir do próximo compasso; um segundo toque com a música tocando limpa o trecho. O botão de colchete de uma linha faz o trecho começar naquela parte, e **Até aqui** o estende até outra.

Abra uma parte para escolher as faixas dela, a duração, **{{label playFromHere}}**, **{{label duplicate}}** e **{{label move}}**. **{{label playFromHere}}** move o início do trecho para aquela parte, ou, sem trecho, toca a música dali, no próximo compasso. **{{label addPartFromPlaying}}** escreve uma seção nova com as faixas que soam e a põe no fim da música. É assim que se monta e se toca ao vivo uma música pronta.

## O painel Code {#code}

**Code**, ao lado do **Drop**, abre o texto. Toque de novo para fechar. Enquanto a música toca, as palavras que estão soando acendem em laranja.

- Quando você para de digitar, o texto é analisado. Se for válido, toca a partir do próximo compasso; uma linha sob o editor mostra quanto falta.
- Se for inválido, o trecho errado é sublinhado, a mensagem aparece no idioma do app, com o código estável em inglês, e a versão anterior continua tocando. Nada para.
- Quando um gesto muda o texto, a linha alterada fica destacada por um instante.

O editor lê o texto como a linguagem Untzel: palavras-chave, instrumentos, notas, números e comentários têm cada um a sua cor, e cada linha de faixa leva na margem a cor da faixa, a mesma da luz no palco e do ponto nas faixas. No celular uma linha longa só quebra antes de um `|`, então um modificador nunca fica sozinho. No computador a borda esquerda do painel é um divisor: arraste, ou dê foco e use as setas, para alargar o painel; um clique duplo volta à largura padrão.

- **Completar.** `Ctrl+Space` lista o que cabe onde está o cursor: instrumentos e instruções no começo da linha, notas e acordes do seu tom num padrão, parâmetros depois de `|`, sinais com o intervalo inteiro do parâmetro, tônicas e escalas depois de `key`, faixas depois de `section`, seções depois de `song`. As setas escolhem, `Enter` ou `Tab` aceitam, `Esc` fecha.
- **Ajuda sob o cursor.** Parado sobre uma palavra, ou com `Alt+I` no teclado, o editor diz o que ela é: um parâmetro com intervalo, padrão e unidade, um instrumento com grupo e parâmetros, um sinal com forma e período.
- **Correções rápidas.** Um erro com correção conhecida mostra um botão sob a mensagem, por exemplo `Trocar por kick` para `kik`, ao lado de **Ignorar**. `Mod+.` aplica a correção sob o cursor, ou a primeira do texto. Uma correção só mexe no trecho que ela nomeia, e a música continua tocando.
- `Esc` avisa como sair: logo depois dele, `Tab` sai do editor, e `Esc` de novo fecha o painel.

{{status composer-terminal}}

Sob o código, o botão **Comandos** abre uma linha de comando, fechada por padrão. Cada comando faz a mesma edição mínima que os controles fazem, pelo mesmo texto: ele é lido, nunca executado, e a música nunca para. Uma mudança que apaga algo, ou mexe em mais de uma linha, mostra antes uma prévia das linhas que mudam, com **Aplicar** e **Cancelar**; nada muda até você aplicar. Com a música tocando, a mudança entra no próximo compasso e a linha avisa, depois diz desde qual compasso ela toca.

- `Enter` roda a linha. `Tab` completa com a sugestão escolhida, `Alt+↓` e `Alt+↑` escolhem outra, `↑` e `↓` percorrem o histórico. `Esc` fecha as sugestões ou cancela uma prévia, e `Mod+Enter` aplica.
- Um comando com erro de digitação responde com o mais próximo: `mute kik` oferece `mute kick` numa ficha, e um toque escreve na linha.
- `help` lista os comandos, `help <comando>` explica um, e `explain` diz em palavras simples o que uma linha ou uma faixa faz. Resultados e ajuda saem no idioma do app; os comandos são palavras da linguagem e ficam como estão escritos.
- O divisor entre o código e os comandos se move com um arraste ou, com foco, com as setas.

{{commands}}

## Esconder os controles {#hide-controls}

O botão redondo do transporte esconde tudo o que fica abaixo dele, e o palco ocupa a tela; `H` faz o mesmo no teclado. O transporte fica com tocar, posição, **Code** e **Drop**; a barra superior e o rodapé com a atribuição ficam como estão. A escolha fica salva no aparelho e a música não para durante a troca.

## Atalhos de teclado {#shortcuts}

{{shortcuts}}

## Quando uma mudança toca {#next-bar}

A mudança de um número simples, como `gain 0.6` para `gain 0.4`, soa na hora. Todo o resto espera o próximo compasso: padrões, faixas, `mute`, sinais, tempo, tom, seções e a música. Por isso a música nunca dá saltos.

Um padrão pode ter até {{limit MAX_BARS_PER_PATTERN}} compassos, o loop de {{limit MIN_LOOP_BARS}} a {{limit MAX_LOOP_BARS}} compassos, e uma parte da música de {{limit MIN_PART_BARS}} a {{limit MAX_PART_BARS}} compassos.

## Folhas {#sheets}

Toda folha e o painel lateral fecham pelo botão × e por `Esc`, e o foco volta ao controle que os abriu. No celular, uma folha com puxador também fecha quando arrastada para baixo.

## Share e Export {#share-export}

**{{label shareLinkMenu}}**, no menu, abre a folha de compartilhar, que envia sua música como link; quando a música é longa demais para um link, ela oferece um arquivo `.untzel` no lugar. **{{label saveFile}}** e **{{label openFileMenu}}**, no menu, salvam e abrem um arquivo `.untzel` a qualquer momento, e um arquivo solto sobre o palco também abre.

**{{label export}}**, na barra superior, abre a folha de exportação. Abrir não renderiza nada: você escolhe primeiro e depois aperta **{{label render}}**.

- **{{label format}}**: **Story** 9:16, **Vídeo** 16:9 ou **Áudio** WAV, cada um com a duração que o arquivo vai ter, cartão de encerramento incluído.
- **{{label range}}**: com um trecho de execução, **{{label selectedRange}}** vem escolhido. Ele começa como cópia do trecho de execução na mesma régua do transporte, e as duas alças andam por passos (1/16 de nota; **Fino**, Shift ou Alt para 1/64), então um vídeo pode começar e terminar em qualquer passo. O início e o fim aparecem como tempo e compasso.tempo. O Story vai até 1:00, vídeo e áudio até 10:00, 4K até 4:21; a alça para no limite e a linha sob a régua diz por quê. Editar o trecho nunca muda o que toca, e **Usar o trecho de execução** volta à cópia. **Ouvir**, ao lado de **Fino**, toca o trecho desde o primeiro compasso e para depois do último; apertado de novo, como **Parar**, para na hora. O trecho de execução fica como estava, a régua do export mostra o compasso que soa, e fechar a folha não para a música. Sem trecho de execução, o Story começa em **{{label nowPlaying}}**, uns 15 segundos a partir do compasso que soa, e vídeo e áudio no loop ou na música, com **{{label selectedRange}}** a um toque. Na música, **{{label from}}** e **{{label to}}** escolhem as partes, e no loop, **{{label bars}}** escolhe 8, 16, 32 ou 64 compassos.
- **{{label quality}}**, no vídeo: **HD** e **4K**, cada uma com a resolução, HD escolhido. {{label checksDeviceFirst}} Depois desse teste, o 4K só aparece num aparelho que o renderiza a tempo, com mais ou menos quanto tempo o render leva.
- A prévia mostra o que o arquivo vai conter: a luz no formato escolhido, o logo Techno Inspire | Untzel e o endereço untzel.com, afastado do logo, em todo quadro, o título da música num cartão nos primeiros 1,5 segundos e depois como legenda, e o cartão de encerramento de 2 segundos só com o logo e o endereço.

Os vídeos são arquivos MP4 com vídeo H.264 e som AAC, 12 Mbit/s em HD e 30 Mbit/s em 4K; onde o navegador não codifica AAC o som sai em Opus, e a linha que diz que o arquivo está pronto acrescenta **{{label exportOpusAudio}}**. O título da música dá nome ao arquivo e vai nos metadados, no MP4 e no WAV. Num aparelho que não codifica H.264, Story e Vídeo ficam inativos e a folha sugere o export em WAV ou outro navegador. Quando o codificador de vídeo não responde a tempo, a folha avisa e mostra **{{label tryAgain}}**, que começa o mesmo render de novo.

Enquanto renderiza, a folha mostra o progresso e o tempo que falta, com **{{label cancel}}**, e a música continua tocando. No fim a prévia vira o próprio arquivo, e **{{label download}}** o salva; onde o sistema aceita arquivos, **{{label share}}** o envia. O logo e o cartão de encerramento são uma condição da licença e não têm opção para tirá-los.

{{status share-link}}

{{status export}}

{{status export-4k}}

