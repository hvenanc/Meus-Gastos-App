# Meus Gastos

Aplicativo de finanças pessoais em **React Native + Expo + TypeScript**, inspirado no vídeo fornecido: temas claro e escuro, destaque verde, resumo mensal, contas, cartões, transações, metas e relatórios.

## Executar

Requer Node.js 22.13+ (Node 24 recomendado).

```bash
npm ci
npm start
```

Abra o QR code no Expo Go compatível com SDK 57, ou execute `npm run android` / `npm run ios` com emulador configurado. O simulador iOS exige macOS. Para testar no navegador: `npm run web`.

```bash
npm run typecheck
npm test
npm run build:web
```

## Configurar o Firebase

O `.env` está configurado para `meusgastos-d224e`; `.env.example` documenta os campos. O `google-services.json` na raiz configura o Android. O SDK JavaScript de Authentication e Firestore usa o `.env` em Android, iOS e web.

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=sua_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto
EXPO_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:seu_app_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
```

1. Ative Authentication → Sign-in method → E-mail/senha no Firebase Console.
2. Para a prévia web, confira os domínios autorizados em Authentication → Settings, incluindo `localhost` no desenvolvimento.
3. Reinicie o Expo após editar o `.env`: `npx expo start --clear`.
4. Cadastre um usuário pela tela **Criar minha conta**, saia e entre novamente. Teste também recuperação de senha e a restauração da sessão após fechar o app.

Sem configuração, login/cadastro ficam desabilitados e **Explorar no modo local** permite usar o app. Com Firebase configurado, o app exige autenticação. Login, cadastro e recuperação de senha exigem internet; uma sessão já persistida permite usar os dados locais offline. A sessão é persistida com AsyncStorage no nativo e persistência local do Firebase no navegador.

Variáveis `EXPO_PUBLIC_*` são incorporadas ao aplicativo e representam a configuração pública do cliente. Não coloque contas de serviço, chaves privadas ou credenciais administrativas nelas. O `.env` está no `.gitignore`. Senhas são enviadas somente ao Firebase Authentication e não são guardadas pelo app. Para migrar registros do modo local para um usuário, exporte um backup antes de configurar o Firebase e importe-o depois de entrar na conta. O app não associa esses dados automaticamente a um usuário.

A integração segue a [documentação oficial do Firebase Authentication](https://firebase.google.com/docs/auth/web/start) e a [persistência para React Native](https://firebase.google.com/docs/reference/js/auth#getreactnativepersistence).

## Funcionalidades

- Cadastro, edição e exclusão de contas com saldo inicial e identificação do banco.
- Despesas, receitas, pendências e transferências entre contas.
- Cartões com limite, fechamento, vencimento, compras em até 48 parcelas e pagamento da fatura pela conta vinculada.
- Antecipação de parcelas pelo cartão: seleção individual ou de todas as parcelas futuras de uma compra, escolha da fatura aberta de destino e desconto opcional em reais, com resumo antes de confirmar.
- Exclusão de uma parcela ou de todas as parcelas em aberto de uma compra, incluindo antecipadas; descontos e estornos vinculados saem junto, sem apagar parcelas pagas ou pagamentos de fatura.
- Filtros por mês, tipo e conta; busca por descrição.
- Categorias personalizáveis, metas com progresso e limites mensais por categoria.
- Relatórios por categoria e evolução diária de receitas e despesas.
- Temas claro/escuro com preferência salva e alternância na tela de login, cabeçalho e Perfil → Aparência.
- Firebase Authentication: login, cadastro por e-mail/senha, recuperação de senha, sessão persistente e logout.
- Ocultar valores; personalizar nome; exportar e restaurar backup JSON.
- Dados de demonstração opcionais em Perfil → Carregar demonstração. A instalação começa vazia.

## Armazenamento e regras

A partir da versão 1.6.0, o Firestore mantém um documento por conta, cartão, categoria, lançamento, meta, limite e registro de investimento. `users/<uid>/finance/state` contém apenas a versão do protocolo (4), a revisão, as contagens e o identificador da geração ativa. Os registros ficam em `users/<uid>/financeGenerations/<generation>/<entidade>/<id>`, e o perfil em `profile/main`.

Alterações comuns gravam somente os documentos modificados e o índice, na mesma transação. A revisão protege leituras e gravações contra mudanças simultâneas. Migrações e operações com mais de 400 documentos são preparadas em uma nova geração em lotes; a troca do índice só ocorre após todos os registros serem confirmados. Isso elimina o limite agregado de 900 KB do JSON antigo, mantendo os limites de cada documento do Firestore.

No aparelho, AsyncStorage armazena registros imutáveis separados, com índices paginados e um manifesto pequeno. O manifesto só muda depois que os registros estão gravados. A fila offline guarda a base confirmada e as alterações locais por referências a esses registros, sem duplicar o histórico em um JSON único. Uma versão anterior é mantida para recuperação; o reset descarta também essa versão.

A migração do cache antigo é automática, validada e remove a chave legada somente depois da gravação no novo formato. A migração remota cria uma cópia privada e imutável do documento legado em `financeBackups/legacy-<revision>` antes de publicar o novo índice. Gerações substituídas são removidas após a publicação; uma falha nessa limpeza pode deixar registros inativos que não são lidos pelo app. O reset também tenta remover backups legados. Operações parcialmente preparadas nunca se tornam o banco ativo.

O snapshot JSON continua sendo apenas o formato portátil de exportação/importação e a estrutura em memória usada pelos cálculos. Backups anteriores continuam compatíveis. O login, os IDs e os vínculos entre registros são preservados. Após a migração remota, versões antigas do app não podem sobrescrever o protocolo 4; atualize os demais aparelhos para 1.6.0 antes de continuar a sincronização.

As regras em `firestore.rules` permitem somente ao usuário autenticado ler/gravar seu documento, validam o índice, a revisão incremental e a coordenação das gravações nos registros ativos e negam acesso a outros caminhos. Para ativar no projeto real, crie o banco **Cloud Firestore (Standard)** no Firebase Console e publique as regras:

```bash
npx --yes --package firebase-tools firebase login --reauth
npx --yes --package firebase-tools firebase deploy --only firestore:rules --project meusgastos-d224e
```

O Firestore Standard do projeto foi confirmado e as regras atualizadas foram publicadas em 12/10/2026. O app mostra erro de configuração/permissão mantendo os dados locais. As regras e o protocolo 4 foram verificados nos emuladores locais, com `npm run test:firebase`, e publicados em 16/10/2026. Não use regras públicas de teste no projeto real.


Valores monetários usam centavos inteiros. Saldo atual considera apenas receitas, despesas e transferências concluídas em contas. Compras no crédito descontam da conta apenas no pagamento da fatura. Relatórios consideram a data do lançamento (parcelas em meses sucessivos), incluindo pendências, e excluem transferências e débitos de pagamento de fatura para evitar contagem dupla. Faturas são agrupadas pelo mês de vencimento. Compra no dia do fechamento entra no próximo ciclo. O limite disponível desconta todas as parcelas em aberto. Dias inexistentes em parcelas são ajustados ao último dia do mês.

Editar uma parcela altera só aquela parcela; excluir uma compra parcelada remove todas as parcelas em aberto do grupo. Compras quitadas e pagamentos de fatura são preservados. Contas, cartões e categorias em uso não podem ser excluídos. Alterações no ciclo do cartão valem para novas compras. Metas são um acompanhamento manual e não movimentam contas. Limites de categoria se repetem a cada mês.

A cópia local **não é criptografada pelo app**. Desinstalar ou limpar os dados apaga o cache e alterações ainda não enviadas; dados já confirmados na nuvem são recuperados ao entrar novamente. Mantenha backups.

## Bancos e identidade visual

Os logos de 21 instituições usam os arquivos locais identificados por ISPB no [repositório Bancos Brasileiros de Guilherme Branco](https://github.com/guibranco/bancosbrasileiros), incluindo C6 Bank e BTG Pactual. Os PNGs vêm do pacote `logos-bancos-br` referenciado pela base. Origem, versão, commit, licença e mapeamento estão em `assets/banks/`.

“Outro banco” oferece um ícone de instituição financeira para bancos fora da lista e permanece disponível quando a busca não encontra resultados. Identificadores desconhecidos também usam esse ícone. Carteira conserva seu ícone próprio. Banco Original mantém o logo da fonte anterior, pois a nova base não fornece um logo para ele; seus créditos estão em `assets/fonts/ATTRIBUTION.md`. Todos os logos funcionam offline. Nomes e marcas pertencem aos respectivos titulares.

## Datas

Formulários usam o calendário nativo Android/iOS (`@react-native-community/datetimepicker`); na web, o seletor de datas do navegador. A apresentação permanece em **DD/MM/AAAA**. Cancelar preserva a data anterior. Datas de registros antigos também aparecem no formato brasileiro. Internamente, registros e backups mantêm ISO (`AAAA-MM-DD`) para preservar a ordenação, os filtros mensais e os dados existentes. Arquivos de backup usam `meus-gastos-DD-MM-AAAA.json`. Períodos mensais e dias de fechamento/vencimento continuam em português.

## Estrutura

- `App.tsx`: telas, navegação e ações.
- `src/components/Editor.tsx`: formulários e validação.
- `src/components/ui.tsx`: componentes visuais e ícones.
- `src/lib/finance.ts`: regras de saldos, parcelas, faturas e validação do backup.
- `src/lib/storage.ts`: persistência local.
- `src/lib/backup.ts`: importação e exportação nativa/web.
- `src/auth/`: Firebase, sessão, telas de autenticação e mensagens de erro.
- `src/theme/ThemeProvider.tsx`: paletas e preferência de aparência.
- `tests/`: testes de regras financeiras, mensagens de autenticação e separação das chaves locais.

A prévia web e os testes não substituem a validação em um dispositivo Android/iOS. Notificações, Open Finance e integração bancária automática não fazem parte desta versão.

## Validação desta versão

TypeScript, testes automatizados e exportação de bundles web/Android/iOS verificados. As telas e o armazenamento local foram inspecionados na prévia web, incluindo persistência do tema. A configuração Firebase está preenchida; login real e sincronização em produção aguardam validação no aparelho; as regras do Firestore já foram publicadas. A exportação de bundles não gera APK/IPA e não substitui teste no aparelho. A auditoria npm ainda aponta avisos em dependências transitivas; as correções compatíveis disponíveis foram aplicadas, sem forçar a troca do SDK Expo.

## APK Android e Firebase configurado

O arquivo `google-services.json` na raiz configura o projeto `meusgastos-d224e` e o pacote Android `com.henrique.meusgastos`. O `.env` contém a configuração usada pelo SDK JavaScript de autenticação. Ambos ficam fora do Git. O provedor E-mail/senha deve estar ativado no Firebase Authentication, e o Firestore deve estar criado com as regras do app; login real exige internet.

Para gerar um APK release com JavaScript incorporado, execute `npm run build:apk` com JDK e SDK Android instalados e `ANDROID_HOME` configurado. Nesta máquina, o SDK está em `.build-tools/android-sdk` e o cache Gradle em `.build-tools/gradle`. A saída é `android/app/build/outputs/apk/release/app-release.apk`, copiada para `artifacts/meus-gastos-<versão>.apk`. Para alterações somente de JavaScript com o projeto nativo já configurado, use `npm run build:apk -- --skip-prebuild`.

A assinatura usa a chave local `.build-tools/signing/release.jks`, com propriedades em `.build-tools/signing/release.properties`. Faça backup privado dessa pasta: futuras versões precisam da mesma chave para atualizar o aplicativo instalado. O plugin `plugins/withAndroidSigning.js` mantém a configuração após `expo prebuild`. A chave e suas senhas ficam fora do Git e do APK.

APK atualizado: `artifacts/meus-gastos-1.3.0.apk` (universal, Android 7.0+, versão 1.3.0, versionCode 4). Assinatura v2 validada com `apksigner`, pacote conferido com `aapt`, bundle JavaScript incorporado e verificações `lintVitalRelease` concluídas. O checksum SHA-256 acompanha o APK. Instalação e autenticação real ainda precisam ser verificadas em aparelho.

O espaço ocupado por `.build-tools/android-sdk` e `.build-tools/gradle` corresponde às ferramentas e caches locais, não ao tamanho instalado do app. Os caches podem ser recriados; preserve `.build-tools/signing` para assinar atualizações.

## Atualização 1.1.0

- Categorias de receitas e despesas separadas no Perfil; adicionar/editar receitas com salário, renda extra, freelance, rendimentos, aluguéis, vendas, reembolsos e outras receitas. Novas categorias padrão são adicionadas uma vez aos registros antigos, sem desfazer exclusões posteriores.
- Máscaras monetárias em saldos, limites de cartão, lançamentos, metas, valores guardados e limites por categoria, como `1.234,56`. Digitação numérica em centavos, colagem brasileira e exclusão são aceitas. Valores persistidos continuam em centavos inteiros.
- Calendário nativo nas datas de receitas, despesas e transferências; é necessário instalar o APK atualizado para carregar o novo módulo nativo.
- Firestore com cache local, fila offline, revisão transacional e isolamento por UID.

Validação: `npm run typecheck`, `npm test` (24 testes), exportação web e testes de integração do protocolo/regras com Authentication e Firestore emulados. O teste de cache usa um adaptador de armazenamento para exercitar a classe de sincronização e seu reinício; não substitui teste offline no aparelho.

## Atualização 1.2.0

- Novo ícone original de carteira e crescimento, em verde e grafite, com versões Android adaptativa/monocromática, iOS, favicon e splash. Fonte vetorial em `assets/app-icon.svg`; renderizador em `scripts/render-app-icon.py`.
- Perfil → Zerar dados → Zerar meus dados: confirmação explícita para limpar apenas as finanças do usuário atual. Mantém acesso, nome e categorias padrão. A limpeza remota exige internet, substitui o snapshot do Firestore de maneira atômica, zera o cache e remove cópias antigas locais dessa conta. Nenhum dado de outra conta é alterado. Exporte um backup antes: a limpeza é irreversível. Um marcador impede que alterações pendentes de aparelhos antigos restaurem os registros apagados; nesses aparelhos, use a versão da nuvem após preservar um backup se necessário.
- Cartões → Ver compras da fatura → botão de estorno em cada compra. Permite estorno total ou parcial da parcela selecionada, inclusive já quitada, limitado ao saldo ainda não estornado. A data determina a fatura de entrada do crédito. O valor reduz despesas e saldo da fatura, libera limite e não aumenta o saldo bancário. Crédito excedente acompanha faturas futuras e é consumido sem duplicação. Compras com estorno e créditos ficam preservados no histórico.
- Fatura antes do fechamento → Antecipar fatura aberta: registra a quitação do saldo atualmente lançado. Novas compras ainda entram no ciclo aberto e podem gerar novo saldo a pagar. Isso registra o pagamento no app; não executa pagamento no banco.
- Editar a data de uma compra não quitada recalcula sua fatura com fechamento/vencimento do cartão. Alterações apenas na descrição preservam o ciclo original; editar uma parcela não move automaticamente as demais. Fechamento no dia 31 usa o último dia real do mês.
- Snapshots com estornos ou limpeza usam protocolo 2. Atualize todos os aparelhos para 1.2.0 para interpretar esses dados; clientes 1.1 não processam esse formato, evitando somar créditos como despesas. As regras aceitam os protocolos 1 e 2, mantendo o isolamento por UID e revisão incremental.

Validação 1.2.0: TypeScript, 33 testes unitários, integração Authentication/Firestore emulada (incluindo limpeza de cache/snapshot e isolamento), bundles web/iOS, APK release Android e assinatura v2. Regras compiladas e publicadas no projeto `meusgastos-d224e`. A interface nativa ainda precisa ser conferida no aparelho. A implementação não apagou dados financeiros reais durante o desenvolvimento.

## Atualização 1.3.0 — investimentos

Acesse **Perfil → Investimentos** (ou Investimentos no menu lateral em telas grandes). No primeiro acesso, crie e confirme um PIN de exatamente quatro dígitos. A seção permite cadastrar/editar contas de investimento por instituição, saldo inicial e histórico de aportes, retiradas, rendimentos positivos e perdas/ajustes negativos. Valores usam máscara brasileira e datas usam o calendário do aparelho. Contas com movimentações não podem ser excluídas; edições/exclusões que deixariam retiradas sem saldo são recusadas, incluindo inconsistências cronológicas.

O saldo investido, aportes, retiradas e rendimentos são **independentes das contas comuns** e não entram no saldo geral, receitas/despesas ou relatórios principais. Não há transferência automática entre as duas áreas. Os investimentos e o verificador do PIN são sincronizados com Firebase usando protocolo 3, mantendo cache e fila offline. Atualize os outros aparelhos para 1.3.0; clientes antigos não processam este formato para evitar apagar informações novas.

O PIN é exigido ao entrar na seção e novamente após o app ir para segundo plano; o botão Bloquear permite encerrá-la manualmente. Alterar PIN fica disponível após desbloquear. Cinco erros causam bloqueio inicial de um minuto, que aumenta com novas tentativas até quinze minutos. O estado das tentativas persiste por usuário/aparelho. Não há PIN padrão nem recuperação automática de PIN esquecido; preserve seu PIN e use Alterar PIN enquanto ainda o conhece.

PINs não são guardados em texto: o verificador usa PBKDF2-HMAC-SHA256 com 100.000 iterações e salt aleatório de 16 bytes, gerado por Expo Crypto. O PIN controla o acesso **na interface do app**, sem criptografia adicional dos registros, do cache ou do backup JSON. Backups completos incluem investimentos e o verificador, e exigem o PIN para exportar/restaurar quando já há dados protegidos. Demonstração, limpeza e substituição por versão da nuvem também pedem PIN nessa condição. A limpeza remota recusa uma autorização cujo PIN tenha mudado em outro aparelho entre desbloqueio e confirmação.

A seção não realiza operações em bancos/corretoras nem calcula preços de mercado; os valores são registrados manualmente. A proteção não substitui o bloqueio do aparelho nem o login Firebase. Regras Firestore continuam limitando acesso ao UID proprietário.

Validação 1.3.0: TypeScript, 46 testes (incluindo bloqueio/desbloqueio do componente de PIN), integração Firebase emulada com protocolo 3 e proteção da limpeza, exportações web/iOS e APK Android assinado e regras do protocolo 3 publicadas. Conferir a navegação, criação/desbloqueio/troca de PIN e bloqueio ao sair/voltar no aparelho.

## Atualização 1.3.1 — recuperação em outro aparelho

A instalação nova aguarda a confirmação do Firestore antes de inicializar o nome do perfil. Quando já existe um documento, recupera os dados da nuvem sem escrever valores padrão. O cache antigo com revisão zero e apenas o nome automático da autenticação é reparado, preservando alterações financeiras pendentes.

Regressões em emuladores cobrem instalação limpa na mesma conta com nome personalizado, reparo do cache antigo e recuperação após limpeza anterior; verificam os dados recuperados e que a revisão remota não muda. Atualize ambos os aparelhos com o APK 1.3.1.

## Atualização 1.3.2 — desbloqueio e contas de investimentos

No Android/iOS, o PIN agora usa PBKDF2-HMAC-SHA256 assíncrono nativo via react-native-quick-crypto, fora da execução JavaScript/Hermes. Mantém 100.000 iterações, salt de 16 bytes, resultado de 32 bytes e compatibilidade com os PINs existentes. As tentativas e o bloqueio ao sair da seção continuam funcionando. A versão web mantém a implementação JavaScript. Esta alteração precisa do APK atualizado; Expo Go não contém o módulo nativo.

Os cartões de contas têm padding de 22 px e espaçamento inferior de 16 px. Contas novas registram createdAt em YYYY-MM-DD e mostram a data em DD/MM/AAAA. Contas antigas geradas pelo uid do app recuperam a data do timestamp no identificador; ao editar, preservam essa data. Identificadores importados sem uma data recuperável mostram Data de cadastro não disponível. O campo é opcional para manter compatibilidade com backups antigos e segue junto no snapshot Firebase.

Validação 1.3.2: 50 testes aprovados, TypeScript, Firebase emulado, exportações web/iOS, APK Android release assinado com a chave existente; módulo nativo confirmado no bundle e no APK para quatro arquiteturas. O tempo de desbloqueio ainda precisa ser conferido no celular.

## Atualização 1.3.3 — mês da despesa

Ao cadastrar uma despesa ou alterar sua data, o editor abre automaticamente o mês do lançamento salvo (a primeira parcela, quando parcelado). Resumo, lista, categorias e limites usam o mês da data informada, independente de estar paga ou pendente. Faturas continuam usando seu próprio ciclo de fechamento/vencimento. Regressão cobre 01/11/2026 fora de outubro, no total de novembro, e edição para dezembro. TypeScript e 51 testes aprovados.

## Atualização 1.4.0 — despesas fixas, categorias e competência do cartão

No cadastro de despesa, escolha Fixa mensal e informe de 1 a 120 ocorrências, incluindo a primeira. Cada mês recebe o valor integral, sem dividi-lo como parcelas. A data mensal parte do dia original (31/01 → 28/02 → 31/03). A primeira ocorrência de conta respeita o indicador Pago; as próximas ficam pendentes. No cartão todas ficam na fatura calculada a partir do fechamento e vencimento. A edição/exclusão é individual e preserva o número da ocorrência. Todos os lançamentos são gerados uma vez ao salvar, mantidos no cache/backup e sincronizados sem um agendador adicional.

Categorias novas e existentes permitem escolher entre 20 ícones com prévia, aplicados nos lançamentos, relatórios e seletores.

A competência mensal de compras, parcelas e estornos no cartão é invoiceMonth, correspondente ao mês de vencimento da fatura, incluindo compras feitas após o fechamento e vencimentos no mês seguinte. Antecipar uma fatura não desloca sua competência prevista; o débito do pagamento continua no extrato da conta na data efetiva. Lançamentos comuns seguem sua própria data. Resumos, categorias, limites e listagem mensal usam a mesma regra; o pagamento da fatura é excluído dos totais de despesas para evitar dupla contagem.

Validação: TypeScript, 54 testes unitários/componentes, exportação web e integração Firebase emulada incluindo recuperação das recorrências e ícone personalizado. Interface nativa deve ser conferida no aparelho.

## Atualização 1.5.1 — remoção do monitoramento

O monitoramento e a importação de notificações bancárias foram removidos da interface e do serviço Android. O aplicativo não solicita acesso às notificações. Transações já cadastradas continuam preservadas, assim como a biometria dos investimentos e a sincronização na nuvem.

### Antecipar parcelas

Em **Meus cartões → Antecipar parcelas**, escolha a fatura de destino, a compra e as parcelas futuras. Informe o desconto total em reais e confira o resumo antes de confirmar. As parcelas selecionadas saem das faturas originais e passam para a fatura escolhida. O desconto é distribuído entre elas em centavos e registrado como crédito vinculado, preservando os valores originais e os meses de origem. O saldo da conta só muda ao registrar o pagamento da fatura.

São aceitas faturas abertas deste mês ou de meses futuros. Parcelas pagas, já antecipadas ou com estorno não entram na seleção. Antecipações e descontos ficam preservados no histórico; o backup e a sincronização validam os vínculos entre os lançamentos.

### Excluir compras e parcelas

Use o ícone de lixeira ao lado da compra em Transações ou na lista de compras da fatura. Escolha entre remover somente a parcela selecionada e remover todas as parcelas em aberto daquela compra. A revisão mostra os valores originais, os descontos/estornos vinculados e a redução líquida das faturas. Parcelas pagas e débitos de pagamento permanecem no histórico. Parcelas vinculadas a um crédito já quitado não podem ser removidas, pois esse crédito precisa manter sua origem.

### Layout dos lançamentos

A versão 1.6.2 usa linhas compactas de receitas e despesas: ícone, descrição, data/banco/categoria e valor/status à direita. Os detalhes ocupam até duas linhas, sem serem comprimidos por botões laterais. Compras no cartão usam o menu ⋯ para editar, registrar estorno ou excluir, respeitando as proteções de parcelas pagas e antecipadas. Pendências em conta oferecem confirmação de pagamento no mesmo menu.
