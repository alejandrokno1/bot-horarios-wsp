// capture_group_id.js
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  },
});

client.on("qr", (qr) => {
  console.log("📲 Escanea el QR (WhatsApp -> Dispositivos vinculados):");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("✅ Autenticado. Esperando READY...");
});

client.on("ready", () => {
  console.log("✅ READY. Ahora envía un mensaje al grupo destino (por ejemplo: ID).");
  console.log("👉 Apenas lo envíes, aquí aparecerá el ID del grupo.\n");
});

// Captura mensajes creados por TI (fromMe = true)
client.on("message_create", async (msg) => {
  if (!msg.fromMe) return;

  try {
    const chat = await msg.getChat();
    const chatId = chat?.id?._serialized;

    console.log("📩 Detecté un mensaje tuyo:");
    console.log("   Nombre:", chat.name || "(sin nombre)");
    console.log("   ID:", chatId);

    if (chatId?.endsWith("@g.us")) {
      console.log("\n✅ ESTE ES EL ID DEL GRUPO (termina en @g.us). Cópialo.\n");
      // process.exit(0); // <- si quieres que se cierre al encontrarlo, descomenta
    } else {
      console.log("ℹ️ Esto parece chat individual (termina en @c.us), no grupo.\n");
    }
  } catch (e) {
    console.log("⚠️ Aún no puedo leer el chat. Espera 5s y envía otro mensaje.");
  }
});

client.initialize();
