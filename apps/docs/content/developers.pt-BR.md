# Para desenvolvedores {#developers}

Como o Untzel é construído, para quem quer entendê-lo, estendê-lo ou incorporá-lo. O desenho está documentado; o código-fonte ainda não é público.

## O código-fonte {#source}

O repositório é privado enquanto a primeira versão é terminada. O código-fonte será publicado depois, sob a licença abaixo. Até lá, esta página descreve a arquitetura, o contrato de instrumento e as regras que toda contribuição vai seguir.

## Pacotes e a regra de dependência {#packages}

O Untzel é um monorepo TypeScript com um motor de som em Rust. As dependências apontam só para dentro: o núcleo não conhece navegador, Web Audio, DOM nem biblioteca de interface, e uma ferramenta confere a regra a cada mudança.

| Camada | Pacotes | Responsabilidade |
|---|---|---|
| domínio | `core`, `templates` | tempo racional exato, eventos, padrões, sinais, escalas, o modelo do programa, o contrato do manifesto de instrumento; a biblioteca de templates por estilo |
| linguagem | `language`, `commands` | gramática, análise para programa, diagnósticos, edições mínimas de texto; a linha de comando do painel Code, que planeja as mesmas edições mínimas |
| aplicação | `transport`, `session` | agendamento antecipado, mudanças na virada de compasso, posição na música e o trecho de execução; os casos de uso, a biblioteca de projetos e suas portas |
| adaptadores | `audio`, `dsp`, `visual`, `editor`, `controls`, `share`, `export` | Web Audio e o worker, o DSP em Rust, a luz, o editor de código, os controles de toque e teclado; links, arquivos e projetos no navegador; o render fora do tempo real de story, vídeo e WAV |
| base | `i18n` | o componente único de tradução, sem DOM no núcleo |
| composição | o app web | a página de `app.untzel.com`, que liga tudo |
| ferramentas | `tools/sim`, `tools/docs`, `tools/release`, `tools/samples` | o simulador, esta documentação, o pacote de release e os pacotes dos instrumentos gravados; nunca importadas pelo app |

O texto-fonte é a única fonte de verdade de uma sessão. Blocos, a linha do tempo da música e o editor são vistas que editam o mesmo texto; nenhum gesto muda a música sem passar por ele.

## Threads {#threads}

| Thread | Roda | Conversa por |
|---|---|---|
| principal | interface, editor, controles, desenho da luz | um `MessagePort` com o worker |
| worker de transporte | o transporte, consultando o programa 120 ms à frente | `MessagePort`s com o worklet e com a principal |
| áudio (`AudioWorklet`) | o DSP, compilado de Rust para WebAssembly sem importações, agendando por amostra | um `MessagePort` com o worker |

O som é agendado no worker, então uma thread principal ocupada com digitação ou gráficos não o atrasa. O tempo é feito de frações exatas, nunca ponto flutuante, então loops não derivam. Os mesmos eventos movem o som e a luz.

## O contrato de instrumento {#instrument-contract}

Um instrumento é uma pasta com um manifesto e uma voz:

```text
instruments/<name>/
  manifest.json   name, model, group, kind, engine, range, description, tags,
                  voices, allocation, steal, costPerVoice, patterns (name, text),
                  preview, defaultDuck, parameters (name, min, max, default, unit,
                  curve, or choices), tone mapping, toneLevelDb, presets,
                  defaultPreset, light
  voice.rs        implements the Voice trait of the DSP crate
  samples/v1/     pack.json and pack.opus, only for an instrument that plays recordings
  README.md       what it sounds like, parameters, credits
```

`patterns` guarda de um a seis padrões iniciais com nome; o primeiro é o que o **Add track** escreve, e o detalhe da faixa oferece todos. `model` é o nome que a biblioteca mostra ao lado da palavra da linguagem, de 3 a 20 letras, dígitos, espaços ou hífens, nunca marca de terceiros. Um instrumento que toca gravações tem um parâmetro `source` com as escolhas `synth` e `samples`, e o pacote dele lista cada arquivo de origem de que foi feito.

O manifesto é a fonte única de cada parâmetro: o analisador valida contra ele, o detalhe da faixa desenha um controle para cada parâmetro, e a página [Instrumentos](instruments.md) é gerada dele. Um parâmetro não pode reusar o nome de um modificador geral, uma curva exponencial precisa de mínimo acima de 0, e todo manifesto é validado no build do app.

## Harness local {#harness}

Toda mudança é verificada localmente antes de ser relatada. Os comandos, para quem contribui com acesso ao código:

```sh
pnpm check          # types, unit tests, Rust tests, layer rules, license headers, docs
pnpm check:full     # check, then production build, budgets, golden files, simulator, browser tests
pnpm sim song.untzel --bars 16    # the real language, transport and DSP in Node, to WAV
pnpm test:browser   # Playwright in the installed Chrome, with screenshots
pnpm docs:check     # rebuilds these docs and fails on any drift from the code
```

O simulador renderiza um texto em WAV sem navegador e falha em qualquer NaN, corte ou deriva do bumbo.

## Releases {#releases}

Uma versão só é publicada por uma tag: `vX.Y.Z`, versão estável num commit que já está no ramo principal. Um merge não publica nada. A tag roda as verificações e o build de produção, e depois monta um pacote só, `untzel-<versão>.tar.gz`, com `app/` (o app), `docs/` (estas páginas) e, na raiz, `LICENSE`, `ATTRIBUTION.md` e `TRADEMARKS.md`, que a licença pede que acompanhem toda cópia. O pacote é determinístico: o mesmo commit dá os mesmos bytes. Ao lado dele, `untzel-<versão>.manifest.json` lista cada arquivo com tamanho e SHA-256. Cada release é avisada ao site do projeto, que serve o app em `app.untzel.com` e esta documentação em `untzel.com/docs/`; `untzel.com` é o próprio site.

## Hospedar uma cópia {#hosting}

A pasta `app/` de uma release é um site estático. Uma cópia hospedada por você precisa de duas coisas do servidor. A primeira é o tipo `application/wasm` para o arquivo `.wasm`: sem ele o motor de som carrega por um caminho mais lento. A segunda é a Content-Security-Policy do app, a mesma em toda resposta:

```text
default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'self'
```

Ela é estática: sem nonce, sem hash e sem `'unsafe-inline'`. O editor de código monta os estilos como folhas construídas, que a política permite, então nada na página precisa de estilo ou script inline. A documentação em `docs/` roda sob uma política estática própria, mais estrita, sem WebAssembly, workers nem `blob:`.

## Licença e atribuição {#license}

O código está sob CPAL-1.0, a Common Public Attribution License, uma licença de código aberto aprovada pela OSI: você pode usar, estudar, modificar e compartilhar. Em troca, toda cópia que roda para alguém, inclusive um fork, uma cópia modificada ou hospedada por conta própria e uma página que incorpora o player, precisa mostrar a atribuição: o logotipo do Untzel, sem modificação, com pelo menos 16 px de altura e com link para untzel.com, na barra superior; a linha "Powered by Untzel · Techno Inspire", sempre na tela, no rodapé; e o aviso "Copyright (c) 2026 Techno Inspire", no aviso legal ou na tela "sobre". Todo vídeo exportado precisa terminar com o cartão final do logo Techno Inspire | Untzel e do endereço untzel.com. A atribuição fica legível e nunca é escondida, coberta, cortada ou deixada transparente. Isto é uma condição da licença, não um pedido. O próprio app vai além do que a licença pede: os vídeos dele também levam o logo e o endereço em todo quadro, e o cartão final dura 2 segundos ([Share e Export](app.md#share-export)). O material de terceiros que o app traz mantém a própria licença e o próprio crédito ([Créditos](credits.md)).

## Marcas {#trademarks}

"Untzel", "Techno Inspire", o logotipo do Untzel e o logo da Techno Inspire são marcas da Techno Inspire, e a licença do código não as concede além da atribuição que exige. Os nomes de modelo dos instrumentos (AURA Grand, VOLTA K9 e os outros da página [Instrumentos](instruments.md)) também são nomes da Techno Inspire e seguem as mesmas regras. Sem pedir, você pode mostrar a atribuição, dizer com verdade que seu projeto é baseado no Untzel ou compatível com ele, e linkar untzel.com. Um fork mantém a atribuição e usa um nome próprio: "MeuNome, baseado no Untzel da Techno Inspire" pode, "Untzel Pro" não. Apresentar uma versão modificada como a oficial, alterar o logo ou usar os nomes para divulgar seus próprios eventos ou produtos exige permissão por escrito.

## O que existe hoje {#features}

{{features}}
