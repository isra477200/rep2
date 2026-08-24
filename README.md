# Inteligencia Mundial de Captación · RedVitalia

Portal de inteligencia competitiva sobre agencias y sistemas de captación de
clientes a escala mundial.

## Cobertura

- 963 empresas canónicas.
- 129 mercados primarios representados en las fichas y atlas territorial de 195 Estados.
- 3.957 materiales locales verificados y vinculados a su ficha madre.
- 6.275 fuentes públicas únicas en el snapshot profundo de 712 fichas.
- 245 precios convertibles a euros en ese snapshot, conservando la moneda original.
- Índice canónico de 963 fichas; la cobertura profunda de funnel se declara por separado y no se extrapola.
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
