// send_test.js
require("dotenv").config();
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const TZ = process.env.TZ || "America/Bogota";

const groupIds = (process.env.GROUP_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (groupIds.length === 0) {
  console.log("❌ No hay GROUP_IDS en .env");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  },
});

client.on("qr", (qr) => {
  console.log("📲 Escanea el QR (si lo pide)...");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  console.log("✅ Conectado. Esperando a que WhatsApp termine de sincronizar (8s)...");
  await sleep(8000);

  const now = new Date();
  const stamp = now.toLocaleString("es-CO", { timeZone: TZ });

  const msg = `✅ Prueba BOT (${stamp})
Si lees esto, el envío a múltiples grupos funciona.`;

  for (const id of groupIds) {
    try {
      // Validar que el ID corresponde a un chat existente
      const chat = await client.getChatById(id);
      console.log(`📌 Enviando a: "${chat.name}" (${id})`);

      await chat.sendMessage(msg);
      console.log(`✅ Enviado OK a ${id}`);

      // Pausa corta entre envíos (buena práctica)
      await sleep(1500);
    } catch (e) {
      console.log(`❌ Falló envío a ${id}:`, e?.message || e);
    }
  }

  console.log("\n🟡 Listo. NO cierro automáticamente.");
  console.log("👉 Revisa WhatsApp en el celular y confirma si llegó.");
  console.log("👉 Cuando confirmes, vuelve aquí y presiona Ctrl + C para cerrar.\n");
});

client.on("disconnected", (reason) => {
  console.log("⚠️ Desconectado:", reason);
});

client.initialize();
