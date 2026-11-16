export default defineNuxtConfig({
  compatibilityDate: "2026-11-11",
  devtools: { enabled: true },
  css: ["~/assets/css/style.css"],
  devServer: {
    port: 3001,
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI || "",
    mongodbDatabase:
      process.env.MONGODB_DATABASE || "gudonavarro_db_user",
    smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    smtpFrom: process.env.SMTP_FROM || "",
  },
  app: {
    head: {
      title: "BOSSGUDO A.R.C. AQUA FARM",
      meta: [
        {
          name: "description",
          content: "Australian Red Claw crayfish services and farm visits.",
        },
      ],
    },
  },
});
