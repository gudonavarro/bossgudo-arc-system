import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2026-11-11",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  devServer: {
    port: 3001,
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["@vue/devtools-core"],
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI || "",
    mongodbDatabase:
      process.env.MONGODB_DATABASE || "bossgudo_arc",
    smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    smtpFrom: process.env.SMTP_FROM || "",
    passwordResetSecret: process.env.PASSWORD_RESET_SECRET || "",
  },
  app: {
    head: {
      title: "BOSSGUDO A.R.C. AQUA FARM",
      htmlAttrs: { lang: "en", "data-theme": "bossgudo" },
      meta: [
        {
          name: "description",
          content: "Australian Red Claw crayfish services and farm visits.",
        },
        { name: "theme-color", content: "#2e6a43" },
      ],
      link: [
        { rel: "icon", type: "image/png", href: "/images/boss-gudo-logo.png" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
        },
      ],
    },
  },
});
