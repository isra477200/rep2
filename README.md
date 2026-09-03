# Inteligencia Mundial de Captación · RedVitalia

Portal de inteligencia competitiva sobre agencias y sistemas de captación de
clientes a escala mundial.

## Cobertura

- 1.091 empresas canónicas.
- 131 mercados primarios representados en las fichas y atlas territorial de 195 Estados.
- 3.957 materiales locales verificados y vinculados a su ficha madre.
- 6.275 fuentes públicas únicas en el snapshot profundo de 712 fichas.
- 245 precios convertibles a euros en ese snapshot, conservando la moneda original.
- Índice canónico de 1.091 fichas; la cobertura profunda de funnel se declara por separado y no se extrapola.
- `public/data/data-manifest.json` separa el universo actual, el snapshot profundo, identidad visual y cobertura publicitaria bajo una revisión reproducible.
- El Centro de Operaciones conecta cobertura, validación OCR, Fábrica 360, experimentos, métricas y battlecards en un espacio local exportable.

## Uso local

```sh
npm ci
npm run dev
```

## Verificación

```sh
npm run lint
npm test
npm run ads:build
npm run ads:qa
```

El despliegue de Hostinger se define en `docker-compose.yml` y se mantiene
aislado del resto de proyectos del servidor.

## Maestro MiniMax

`/maestro` es el centro de mando conversacional de RedVitalia. También aparece
como asistente flotante en el resto de la aplicación. Admite cuatro modos:
preguntar, analizar, crear un entregable y auditar. El historial y los encargos
guardados permanecen en el navegador.

La credencial de MiniMax nunca llega al navegador ni se guarda en este
repositorio. El recorrido es aplicación → Worker privado → webhook protegido de
n8n → credencial `MiniMax account`. Para activarlo en local:

1. Copia las dos variables de `config/redvitalia-ai.env.example` a `.dev.vars`.
2. Usa la misma llave privada que valida el workflow de n8n.
3. Reinicia el servidor local.

La memoria compacta y los índices privados de recuperación se generan en cada
compilación con `npm run ai:context`. Maestro puede localizar una ficha por
nombre, país, oferta o canal y recuperar patrones, playbooks, hipótesis y
aprendizajes relacionados. El workflow reproducible se conserva en
`automation/n8n/redvitalia-maestro.workflow.ts`.
