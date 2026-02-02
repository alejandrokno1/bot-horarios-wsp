// index.js
require("dotenv").config();
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const client = new Client({
  authStrategy: new LocalAuth(), // guarda sesión local (evita QR cada vez)
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("Escanea este QR con WhatsApp (Dispositivos vinculados):");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  console.log("✅ Bot conectado a WhatsApp.");

  // Enviar mensaje de prueba al chat/grupo configurado
  const targetId = process.env.TARGET_CHAT_ID; // Ej: 12345-67890@g.us (grupo) o 57300...@c.us (contacto)
  if (!targetId) {
    console.log("⚠️ Falta TARGET_CHAT_ID en .env. Primero vamos a obtener el ID del grupo.");
    return;
  }

  try {
    await client.sendMessage(targetId, "✅ Hola, soy el bot. Mensaje de prueba.");
    console.log("✅ Mensaje de prueba enviado.");
  } catch (err) {
    console.error("❌ Error enviando mensaje:", err);
  }
});

client.on("auth_failure", (msg) => {
  console.error("❌ Falló la autenticación:", msg);
});

client.on("disconnected", (reason) => {
  console.log("⚠️ Bot desconectado:", reason);
});

client.initialize();
