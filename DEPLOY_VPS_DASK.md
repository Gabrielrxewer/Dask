# Deploy Dask em `/dask` sem derrubar o Atlas atual

## 1) Ver containers atuais
```bash
docker ps
docker ps -a
```

## 2) Build da imagem do Dask
No diretório do repo:
```bash
docker build -t dask-frontend:latest --build-arg VITE_BASE_PATH=/dask/ .
```

## 3) Subir container do Dask (porta interna 8086)
```bash
docker run -d \
  --name dask-frontend \
  --restart unless-stopped \
  -p 127.0.0.1:8086:8080 \
  dask-frontend:latest
```

## 4) Configurar Nginx host para rotear `/dask`
No servidor Nginx principal do domínio `www.atlasautomate.com.br`, adicione:

```nginx
location = /dask {
  return 301 /dask/;
}

location /dask/ {
  proxy_pass http://127.0.0.1:8086/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

Depois:
```bash
nginx -t && systemctl reload nginx
```

## 5) Cloudflare Tunnel
Se seu tunnel já publica `www.atlasautomate.com.br` para esse Nginx host, não precisa mudar o tunnel.
O roteamento por path (`/dask`) fica no Nginx.

## 6) Testes rápidos
```bash
curl -I https://www.atlasautomate.com.br/dask/
docker logs --tail 100 dask-frontend
```
