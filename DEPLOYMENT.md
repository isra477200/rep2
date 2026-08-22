# RedVitalia Radar — despliegue aislado

El portal se ejecuta como proyecto independiente `redvitalia-radar`. Se conecta
únicamente a la red externa `traefik-proxy` de Hostinger y no modifica el proyecto,
los contenedores, las variables ni los volúmenes de n8n.

## Puesta en marcha

```sh
docker compose -p redvitalia-radar up -d --build
```

En Hostinger Docker Manager, el nombre del proyecto determina el subdominio. Con
`redvitalia-radar`, la dirección prevista es
`https://redvitalia-radar.srv1480016.hstgr.cloud`. Traefik publica el servicio en
HTTPS y solicita automáticamente el certificado de Let's Encrypt.

## Actualización

Actualizar la fuente del proyecto y volver a implementar desde Docker Manager.

## Reversión

No se comparte volumen, base de datos ni variables con n8n. El proyecto puede
detenerse o eliminarse de manera independiente desde Docker Manager.
