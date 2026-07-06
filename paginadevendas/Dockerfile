# Landing wabadisparos.com.br — serviço Easypanel waba_paginadevendas
# Imagem OG estática + patch do index (React/Vite) no build ou via deploy-wabadisparos-og-vps.sh
FROM nginx:alpine

COPY paginadevendas/public/wabadisparos-og.jpg /usr/share/nginx/html/wabadisparos-og.jpg

# Se o build Vite copiar dist/ para /usr/share/nginx/html, manter a imagem na raiz.
# Easypanel: usar este Dockerfile apenas se o serviço paginadevendas apontar para este path.
