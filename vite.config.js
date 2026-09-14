import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // "./" (caminhos relativos) é necessário para o Capacitor carregar os
  // arquivos direto do dispositivo (file://). Como o Tradefy não usa
  // react-router (é tudo troca de aba em memória), isso não muda nada
  // pro site em produção na Vercel — continua funcionando normalmente.
  base: "./",
});
