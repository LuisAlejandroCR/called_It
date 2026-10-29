<!-- .agents/skills/README.md: las skills de proyecto que Codex descubre en este repositorio —qué hay
     y de dónde salen—. Se distingue de BRAINSTORM.md (la idea y el plan) y de README.md
     (la portada): aquí solo va el índice de las skills y la regla de sincronía. -->

# Skills de proyecto para Codex

Codex carga las skills de `<repo>/.agents/skills/<nombre>/SKILL.md`. Esto se verificó el 2026-10-23
contra `openai/codex@7c568b3`.

| Skill | Cuándo |
|---|---|
| [twitch](twitch/SKILL.md) | Helix, EventSub, chat, Predictions, Extensions y la Twitch CLI |
| [codex](codex/SKILL.md) | Cómo carga Codex `AGENTS.md` y las skills, `/status` y la evidencia de uso |
| [realtime-vision](realtime-vision/SKILL.md) | Decidir sobre video en vivo: la escalera de verificadores, `UNKNOWN` y el AR como fase 2 |

**La fuente de verdad es `procedures/03_Garden/<nombre>.md`.** Estas copias son iguales salvo dos
cambios: no tienen la línea de estado (`brote` o `semilla`), porque `SKILL.md` tiene que empezar con
`---`, y los enlaces relativos apuntan al repositorio de procedimientos. Una corrección se hace allá
y se vuelve a copiar.
