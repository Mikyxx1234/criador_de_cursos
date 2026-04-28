# Curso Platform - Admin (Criação de Cursos)

Área administrativa em **React + Vite + TypeScript + Tailwind** para criar cursos, montar a estrutura (vídeos, artigos, embeds, materiais, quiz e prova final), cadastrar questões e conferir o resultado consumindo a API Laravel REST.

## Principais funcionalidades

- Formulário principal do curso com upload de capa (multipart/form-data obrigatório)
- Builder de atividades com 6 tipos: `video`, `article`, `embed_content`, `support_material`, `quiz`, `final_exam`
- Drag & drop (dnd-kit) + setas para reordenar (com bloqueio automático da prova final no fim)
- Bloqueio visual de cadastrar mais de uma prova final por curso
- Editores de questões (quiz e prova final) com adicionar / remover / duplicar / mover
- Stepper com 5 etapas e persistência no localStorage (não perde progresso ao recarregar)
- Preview lateral com capa, preço final calculado, desconto, badges (Gratuito / Pago / Promocional) e status
- Conferência final via `GET /courses/{id}` com layout de vitrine
- Visualização/cópia do JSON da estrutura completa
- Toasts (sonner) com loading / success / error em todas as chamadas
- Validação robusta com `react-hook-form` + `zod`
- Service layer separada (sem token hardcoded em componente)

## Estrutura de pastas

```
curso-platform-admin/
├── .env                      # VITE_API_BASE_URL + VITE_API_TOKEN (não versionar)
├── .env.example
├── index.html
├── package.json
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx               # bootstrap + <Toaster />
    ├── App.tsx                # renderiza CourseCreatorPage
    ├── index.css              # Tailwind + base styles
    ├── vite-env.d.ts          # tipagem de import.meta.env
    ├── lib/
    │   └── utils.ts           # cn(), formatBRL(), calcFinalPrice(), etc.
    ├── types/
    │   ├── course.ts
    │   ├── activity.ts
    │   └── question.ts
    ├── services/
    │   ├── apiClient.ts       # axios + Bearer + parse de erros 422
    │   ├── courseService.ts   # createCourse/updateCourse/getCourse (FormData)
    │   ├── activityService.ts # create/update/delete/reorder
    │   └── questionService.ts # createQuizQuestions / createFinalExamQuestions
    ├── hooks/
    │   └── useCourseBuilder.ts  # estado central + persistência localStorage
    ├── components/
    │   ├── ui/                # Button, Input, Textarea, Select, Switch,
    │   │                      # Card, Badge, Modal, Spinner, FileDrop
    │   ├── layout/
    │   │   ├── PageHeader.tsx
    │   │   └── Stepper.tsx
    │   ├── course/
    │   │   ├── CourseMainForm.tsx
    │   │   └── CourseSidebarPreview.tsx
    │   ├── activities/
    │   │   ├── ActivitiesBuilder.tsx
    │   │   ├── ActivityCard.tsx
    │   │   ├── ActivityTypePicker.tsx
    │   │   └── forms/
    │   │       ├── activitySchemas.ts
    │   │       ├── VideoForm.tsx
    │   │       ├── ArticleForm.tsx
    │   │       ├── EmbedForm.tsx
    │   │       ├── SupportMaterialForm.tsx
    │   │       ├── QuizForm.tsx
    │   │       └── FinalExamForm.tsx
    │   ├── questions/
    │   │   ├── QuestionsEditor.tsx
    │   │   ├── QuizQuestionsEditor.tsx
    │   │   └── FinalExamQuestionsEditor.tsx
    │   └── review/
    │       ├── CourseReviewPanel.tsx
    │       └── JsonPreviewModal.tsx
    └── pages/
        └── CourseCreatorPage.tsx
```

## Configuração do `.env`

Copie o arquivo de exemplo e ajuste:

```bash
cp .env.example .env
```

Conteúdo:

```
VITE_API_BASE_URL=http://localhost:8080/api
VITE_API_TOKEN=6|qd8QVnQsWJIqxDDqphmwO97HobaCt94RaTTfoRsPe8375dbf
```

- **`VITE_API_BASE_URL`**: base da API Laravel (inclua `/api` no final).
- **`VITE_API_TOKEN`**: token Sanctum de um usuário admin (fallback inicial). Obtenha via `POST /auth/login` com as credenciais de admin (`admin@curso-platform.com` / `password`). **Não é mais obrigatório** — você pode renovar pela própria interface.

> **Onde trocar base URL e token?** A base URL só pelo `.env`. O token, além do `.env`, pode ser renovado via UI (botão **Renovar token** no cabeçalho de qualquer página). Os tokens renovados ficam salvos em `localStorage` (chave `curso_admin_api_token_v1`) e têm prioridade sobre o `.env`.

### Renovar token pela interface

Na lista de cursos, no criador de curso e na importação de Word existe um botão **Renovar token**. Ele abre um modal com duas opções:

1. **Fazer login** — informe e-mail e senha de admin; é feito `POST /auth/login` e o `token` retornado é salvo no navegador.
2. **Colar token manualmente** — útil se você gerou o token via cURL/Postman e só quer aplicá-lo aqui.

Também é possível **testar** a conexão com o token atual e **limpar** o token salvo (voltando ao token padrão do `.env`). Se uma chamada falhar com 401/403, o aviso de erro mostra um atalho para abrir o mesmo modal.

## Como rodar

Requisitos: **Node 18+** (recomendado 20+).

```bash
cd curso-platform-admin
npm install
npm run dev     # http://localhost:5173
```

Build de produção:

```bash
npm run build   # gera dist/
npm run preview # serve o build localmente
```

## Fluxo de uso na interface (casa com o README_COURSE_CRUD da API)

1. **Etapa 1 – Dados do curso**: preencha título, descrição, carga horária, preço e faça upload da capa (obrigatória). Ao clicar em **Criar curso**, é feito `POST /courses` multipart e o `COURSE_ID` é salvo no builder.
2. **Etapa 2 – Atividades**: clique em **Adicionar atividade** e escolha um tipo. Cada form cria via `POST /courses/{id}/activities`. Quiz e Prova Final guardam automaticamente `activity.quiz.id` e `activity.final_exam.id`. A prova final não pode ser adicionada duas vezes (botão desabilitado).
3. **Reordenação**: arraste cards ou use as setas ↑/↓. Clique em **Salvar ordem** para persistir via `PUT /courses/{id}/activities/reorder`. A prova final é automaticamente fixada no fim.
4. **Etapa 3 – Questões do Quiz**: com `QUIZ_ACTIVITY_ID` salvo, adicione múltiplas questões (4 alternativas + marcar correta). **Salvar** envia `POST /quiz/{id}/questions` em lote.
5. **Etapa 4 – Questões da Prova Final**: mesma mecânica, endpoint `POST /final_exam/{id}/questions`.
6. **Etapa 5 – Revisão final**: `GET /courses/{id}` mostra tudo que foi criado com layout de vitrine.
7. **Publicar / Ativar** (no cabeçalho): alterna `is_active` via `PUT /courses/{id}`.
8. **Ver JSON** (no cabeçalho): modal com a estrutura completa montada (útil para depuração).

## Endpoints consumidos

| Ação | Método | Endpoint |
|------|--------|----------|
| Criar curso | POST | `/courses` (multipart) |
| Atualizar curso | POST + `_method=PUT` | `/courses/{id}` (multipart) |
| Consultar curso | GET | `/courses/{id}` |
| Criar atividade | POST | `/courses/{id}/activities` (JSON) |
| Atualizar atividade | PUT | `/activities/{id}` (JSON) |
| Remover atividade | DELETE | `/activities/{id}` |
| Reordenar atividades | PUT | `/courses/{id}/activities/reorder` |
| Criar questões do quiz | POST | `/quiz/{quizActivityId}/questions` |
| Criar questões da prova | POST | `/final_exam/{finalExamActivityId}/questions` |

## Decisões de arquitetura

- **React Hook Form + Zod** para validação declarativa por tipo de atividade.
- **Axios** com interceptor único para `Authorization: Bearer`, sem dependência de um provider/contexto global de auth.
- **useCourseBuilder** como única fonte de verdade do estado do builder, com persistência em `localStorage` (chave `curso_admin_builder_v1`) para resiliência em dev.
- **FormData** apenas no `courseService` (onde a API exige multipart); JSON puro no resto.
- **dnd-kit/sortable** para DnD acessível + setas como fallback sempre visível.
- **sonner** para toasts (`toast.promise`) cobrindo loading/success/error em todas as chamadas.
- Cada tipo de atividade tem seu **form próprio** + **schema zod próprio**, em vez de um form mega-genérico — mais previsível e escalável.
- **Regra da prova final duplicada** tratada em 3 níveis: botão do picker desabilitado, ordem forçada ao fim antes de persistir, e mensagem de erro tratada caso a API retorne 422.

## Evoluções sugeridas (pronto para receber)

- Adicionar rota de login (`POST /auth/login`) e salvar token dinamicamente em `localStorage`, removendo dependência do `.env`.
- Integrar `@tanstack/react-query` para cache e revalidação do `GET /courses/{id}`.
- Integrar um editor rich text (ex.: Tiptap) nos campos `content_richtext` (hoje usam textarea com HTML).
- Endpoints de `GET /quiz/{id}/questions` e `GET /final_exam/{id}/questions` para listar/editar questões já salvas (hoje só criação em lote).
- Listagem global de cursos (`GET /courses`) para gerenciar múltiplos cursos.

## Troubleshooting

- **401 em todas as chamadas**: o token do `.env` expirou ou está incorreto. Faça login em `POST /auth/login` e cole o novo token.
- **CORS**: ajuste `config/cors.php` no backend Laravel para permitir `http://localhost:5173`.
- **`cover_image` retornando 422**: o backend exige a imagem no `POST /courses`. Certifique-se de selecionar um arquivo antes de enviar.
- **Curso não atualiza preview lateral**: o builder usa localStorage; clique em **Limpar builder** se quiser zerar sem refresh.
