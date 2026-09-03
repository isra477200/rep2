# Maestro MiniMax en n8n

`redvitalia-maestro.workflow.ts` es la fuente reproducible del workflow
`✦ RedVitalia — Maestro MiniMax`.

## Contrato

- Webhook `POST /webhook/redvitalia-maestro`.
- Autenticación servidor a servidor mediante `X-RedVitalia-AI`.
- Credencial n8n `MiniMax account`; ningún token se incluye en el código.
- Modos aceptados: `ask`, `analyze`, `create` y `audit`.
- Recuperación selectiva sobre 1.091 fichas y lectura profunda disponible para 712 expedientes.
- Biblioteca recuperable de patrones, playbooks, hipótesis, huecos y aprendizajes de landings.
- 20 encargos con modelo por minuto y 500 al día; la comprobación de estado no consume ese cupo.
- Sin herramientas de escritura ni acciones externas.
- La salida declara `executedActions: []` y mantiene la aprobación humana.

Antes de actualizar el workflow, valida siempre este archivo con el validador
del SDK de n8n. Después de guardar una revisión, hay que publicar esa versión
para que el webhook de producción la use.
