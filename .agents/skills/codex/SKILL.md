---
name: codex
description: >
  Trabajar con OpenAI Codex (CLI y app) como agente de build: cómo carga AGENTS.md (raíz a cwd, tope
  de 32 KiB, AGENTS.override.md), dónde busca skills (.agents/skills en el repo, ~/.agents/skills,
  $CODEX_HOME/skills) y su frontmatter, los slash commands que importan (/init, /status, /goal,
  /plan, /review, /skills, /permissions), sandbox y aprobaciones, y cómo dejar evidencia del uso de
  Codex cuando un jurado la puntúa. Usar cuando el usuario dice "Codex", "codex cli", "session ID",
  "/status", "skills de Codex", "AGENTS.md para Codex", o un evento exige construir con Codex.
---

<!-- codex.md: cómo usar Codex como agente de build sin perder el método de este repositorio —
     dónde lee instrucciones y skills, y qué evidencia deja—. Se distingue de agent_contract.md (qué
     dice el contrato, que Codex lee tal cual) y de 03_Garden/claude-code-project-structure.md (lo
     mismo para Claude Code): aquí solo va lo propio de Codex. -->

# Codex — el contrato ya sirve; las skills cambian de carpeta

El método de este repositorio ya es compatible con Codex: el contrato vive en `AGENTS.md`, que es el
archivo que Codex lee. Lo que cambia es dónde van las skills y qué evidencia queda del trabajo.

Verificado el 2026-10-23 contra el código fuente de `openai/codex@7c568b3` (`codex-rs`). La
documentación pública (`developers.openai.com/codex`) no fue alcanzable desde el entorno de trabajo.

## Cómo carga las instrucciones

| Regla | Detalle |
|---|---|
| Raíz del proyecto | Sube desde el cwd hasta el primer marcador de `project_root_markers` (por defecto `.git`). Sin marcador, solo cuenta el cwd |
| Qué concatena | Todo `AGENTS.md` desde la raíz hasta el cwd, en ese orden. Nunca pasa de la raíz |
| Override | `AGENTS.override.md` tiene prioridad sobre `AGENTS.md`, en el proyecto y en `$CODEX_HOME` |
| Global | `$CODEX_HOME/AGENTS.md` (por defecto `~/.codex`), antepuesto al del proyecto |
| Tope | `project_doc_max_bytes` = **32 KiB** por defecto. Lo que pasa del tope no se lee |
| Otros nombres | `project_doc_fallback_filenames` (vacío por defecto). Un `CLAUDE.md` no se lee salvo que se configure ahí |
| Proyecto no confiable | No carga el `AGENTS.md` del proyecto |

**Consecuencia:** el espejo `AGENTS.md ≡ CLAUDE.md` funciona en los dos agentes sin tocar nada. Un
contrato de más de 32 KiB queda cortado en silencio: medirlo con `wc -c AGENTS.md`.

## Dónde busca skills

| Ubicación | Alcance |
|---|---|
| `<repo>/.agents/skills/<nombre>/SKILL.md` | El proyecto, compartido por git |
| `~/.agents/skills/<nombre>/SKILL.md` | El usuario, en todos sus proyectos |
| `$CODEX_HOME/skills/` (`~/.codex/skills`) | El usuario; es donde instala `skill-installer` |
| `<repo>/.codex/skills/` | Ruta vieja que el código todavía reconoce; preferir `.agents/skills` |

**Frontmatter:** `name` (máximo 64 caracteres) y `description` (obligatoria, máximo 1024). Opcional:
`metadata.short-description`. El archivo **empieza** con `---`: una línea de estado antes del
frontmatter (como `brote` en esta carpeta) lo invalida. Al copiar una nota del jardín a
`.agents/skills`, quitar esa línea.

## Los slash commands que importan

| Comando | Para qué |
|---|---|
| `/init` | Crea un `AGENTS.md`. En un repo con contrato, no usarlo: ya existe |
| `/status` | Configuración de la sesión y uso de tokens. **Muestra la línea `Session`**: es el id que pide un evento que exige "el session ID de Codex" |
| `/goal` · `/plan` | Meta de una tarea larga · modo plan. Encajan con la plantilla `/GOAL` de [agent_loops.md](https://github.com/LuisAlejandroCR/procedures/blob/main/00_Files/agent_loops.md) |
| `/review` | Revisión de los cambios actuales. Sirve de segundo agente que califica |
| `/skills` · `/mcp` · `/permissions` | Ver skills, ver herramientas MCP, elegir qué puede hacer |
| `/fork` · `/resume` · `/compact` | Bifurcar, retomar y resumir la conversación |

## Sandbox y aprobaciones

Hay tres sandbox: `read-only`, `workspace-write` y `danger-full-access`. Las aprobaciones van de
`untrusted` a `never`. Para un ciclo desatendido: `workspace-write` con red solo si el verificador la
necesita, y nunca `danger-full-access` en una máquina con secretos.

## Evidencia de uso, cuando el jurado la puntúa

1. **Un hilo principal para el build.** Su id sale de `/status` y se anota en `PROGRESS.md` el día uno, no la noche del envío.
2. **El contrato del repo es `AGENTS.md`.** Es lo primero que demuestra que Codex trabajó con reglas.
3. **Cada ciclo con verificador** ([agent_loops.md](https://github.com/LuisAlejandroCR/procedures/blob/main/00_Files/agent_loops.md)): el commit dice qué verificador pasó.
4. **`/review` como juez distinto del autor**, con su hallazgo citado en el PR.
5. **Una toma corta del hilo en el video:** prompt, rojo, verde.

## Reglas

1. **Un contrato, dos agentes:** `AGENTS.md` es la fuente y `CLAUDE.md` su espejo. Nunca dos contratos distintos.
2. **`AGENTS.md` por debajo de 32 KiB**, o se parte en `AGENTS.md` por carpeta.
3. **Skills del proyecto en `.agents/skills/<nombre>/SKILL.md`**, con el frontmatter en la primera línea.
4. **El session ID se anota el día uno.**
5. **El agente que escribió el código no lo califica:** `/review` en otro hilo, o el verificador.

## Para promoverla a perenne

1. Usarla en un proyecto real con Codex de punta a punta.
2. Confirmar contra `developers.openai.com/codex` la carga de skills y el formato de `/status`.
3. Anotar cada regla que cambió una decisión, con su costo.

## Verify

```bash
wc -c AGENTS.md                                   # < 32768
for f in .agents/skills/*/SKILL.md; do head -1 "$f" | grep -qx -- '---' || echo "SIN FRONTMATTER: $f"; done
```

1. `AGENTS.md` pesa menos de 32 KiB: PASS/FAIL.
2. Toda skill del proyecto empieza con `---` y tiene `name` (≤ 64) y `description` (≤ 1024): PASS/FAIL.
3. `/skills` en una sesión de Codex lista las skills del repo: PASS/FAIL.
4. El id que muestra `/status` está anotado en `PROGRESS.md`: SÍ/NO.
