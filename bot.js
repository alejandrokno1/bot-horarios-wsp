// bot.js
// Bot WhatsApp: envía recordatorios LEAD_MINUTES antes según schedule.json
// Requisitos: npm i whatsapp-web.js qrcode-terminal node-cron dotenv
//
// Archivos:
// - .env (GROUP_IDS, TZ, LEAD_MINUTES, HEADLESS, PUPPETEER_EXECUTABLE_PATH opcional)
// - schedule.json
// - sent_log.json (se crea solo)
//
// Ejecutar:
//   node bot.js

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

// =====================
// Config desde .env
// =====================
const TZ = process.env.TZ || "America/Bogota";
const LEAD_MINUTES = Number.parseInt(process.env.LEAD_MINUTES || "5", 10);

const HEADLESS =
  (process.env.HEADLESS || "true").toLowerCase().trim() === "true";

// IDs de grupos separados por coma
const groupIds = (process.env.GROUP_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!Number.isFinite(LEAD_MINUTES) || LEAD_MINUTES < 1 || LEAD_MINUTES > 60) {
  console.log("❌ LEAD_MINUTES inválido. Usa un número entre 1 y 60.");
  process.exit(1);
}

if (!groupIds.length) {
  console.log("⚠️ GROUP_IDS está vacío. El bot iniciará, pero NO enviará a grupos hasta configurarlo.");
}

// =====================
// Rutas
// =====================
const schedulePath = path.join(__dirname, "schedule.json");
const sentLogPath = path.join(__dirname, "sent_log.json");

// =====================
// Helpers de archivos
// =====================
function loadSchedule() {
  if (!fs.existsSync(schedulePath)) {
    console.log("❌ No existe schedule.json en la carpeta del bot.");
    return [];
  }
  const raw = fs.readFileSync(schedulePath, "utf-8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    console.log("❌ schedule.json debe ser un arreglo de eventos.");
    return [];
  }
  return data;
}

function loadSentLog() {
  if (!fs.existsSync(sentLogPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(sentLogPath, "utf-8"));
  } catch {
    return {};
  }
}

function saveSentLog(log) {
  fs.writeFileSync(sentLogPath, JSON.stringify(log, null, 2), "utf-8");
}

// =====================
// Tiempo en TZ real
// =====================
function partsInTZ(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    hour: Number.parseInt(get("hour"), 10),
    minute: Number.parseInt(get("minute"), 10),
  };
}

function nowInTZ() {
  return partsInTZ(new Date());
}

// Suma minutos usando reloj real y vuelve a formatear en TZ
function addMinutesInTZ(deltaMinutes) {
  const out = new Date(Date.now() + deltaMinutes * 60_000);
  return partsInTZ(out);
}

// =====================
// Mensaje bonito
// =====================
function greetingByHour(hour) {
  if (hour < 12) return "BUENOS DÍAS";
  if (hour < 18) return "BUENAS TARDES";
  return "BUENAS NOCHES";
}

function buildMessage(event) {
  const now = nowInTZ();
  const saludo = greetingByHour(now.hour);

  return `🌟 *${saludo}, FUTUROS SUBINTENDENTES* 🌟

👮‍♂️ En breve estaremos en clase de:

📘 *${event.subject}*
👨‍🏫 *Profesor:* ${event.teacher}

💡 Cada minuto de estudio hoy es un paso más hacia tu objetivo.
¡Conéctate y sigue avanzando! 💪📚
🔗 Enlace de la clase:
https://asesoriasacademicasnaslybeltran.q10.com/`;
}

// =====================
// Puppeteer args (server-safe)
// =====================
const puppeteerArgs = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-first-run",
  "--no-zygote",
  "--disable-features=site-per-process",
];

// Si Railway/Docker define una ruta de Chrome
const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

// =====================
// WhatsApp Client
// =====================
const client = new Client({
  authStrategy: new LocalAuth(), // guarda sesión local
  puppeteer: {
    headless: HEADLESS,
    args: puppeteerArgs,
    ...(executablePath ? { executablePath } : {}),
  },
});

// =====================
// Eventos
// =====================


const QRCode = require("qrcode");

client.on("qr", async (qr) => {
  console.log("📲 QR recibido. Abre este link y escanéalo con WhatsApp:");

  // Link que genera una imagen PNG del QR (data URL)
  const dataUrl = await QRCode.toDataURL(qr);

  // Railway lo imprime como texto, pero lo puedes copiar y pegar en el navegador
  console.log(dataUrl);

  console.log("\n✅ TIP: Copia TODO el texto que empieza por 'data:image/png;base64,'");
  console.log("   pégalo en el navegador (barra de direcciones) y verás la imagen del QR.\n");
});





client.on("authenticated", () => {
  console.log("✅ Autenticado.");
});

client.on("auth_failure", (msg) => {
  console.log("❌ auth_failure:", msg);
});

client.on("disconnected", (reason) => {
  console.log("⚠️ Desconectado:", reason);
});

client.on("ready", async () => {
  console.log("✅ Bot listo.");
  console.log(`🕒 TZ=${TZ} | LEAD_MINUTES=${LEAD_MINUTES} | HEADLESS=${HEADLESS}`);
  console.log(`👥 Grupos configurados: ${groupIds.length}`);
  console.log("⏱️ Revisando cada minuto...\n");

  if (!groupIds.length) return;

  // Validación rápida: mostrar nombres de los grupos (una vez)
  try {
    for (const gid of groupIds) {
      const chat = await client.getChatById(gid);
      console.log(`📌 OK grupo: "${chat.name}" (${gid})`);
    }
    console.log("");
  } catch (e) {
    console.log("⚠️ No pude validar todos los grupos ahora mismo.");
    console.log("   Revisa que el ID termine en @g.us.\n");
  }
});

// =====================
// Tick cada minuto
// =====================
async function tick() {
  if (!groupIds.length) return;

  const schedule = loadSchedule();
  if (!schedule.length) return;

  const sentLog = loadSentLog();
  const now = nowInTZ();

  // Hora objetivo = ahora + LEAD_MINUTES (en reloj real, formateado en TZ)
  const target = addMinutesInTZ(LEAD_MINUTES);
  const targetKeyBase = `${target.date} ${target.time}`;

  const events = schedule.filter(
    (e) => e.date === target.date && e.start === target.time
  );

  if (!events.length) return;

  for (const ev of events) {
    const uniqueKey = `${targetKeyBase}|${ev.subject}|${ev.teacher}`;
    if (sentLog[uniqueKey]) continue;

    const msg = buildMessage(ev);

    console.log(
      `🚀 Enviando aviso: ${targetKeyBase} | ${ev.subject} | ${ev.teacher}`
    );

    for (const gid of groupIds) {
      try {
        const chat = await client.getChatById(gid);
        await chat.sendMessage(msg);
        await new Promise((r) => setTimeout(r, 1200));
      } catch (e) {
        console.log(`❌ Error enviando a ${gid}:`, e?.message || e);
      }
    }

    sentLog[uniqueKey] = {
      sentAt: `${now.date} ${now.time}`,
      targetAt: `${target.date} ${target.time}`,
      subject: ev.subject,
      teacher: ev.teacher,
    };
    saveSentLog(sentLog);

    console.log(`✅ Aviso enviado y registrado: ${uniqueKey}\n`);
  }
}

// Cron cada minuto (en TZ)
cron.schedule(
  "* * * * *",
  async () => {
    try {
      await tick();
    } catch (err) {
      console.log("❌ Error en tick:", err?.message || err);
    }
  },
  { timezone: TZ }
);

// (Opcional) health ping cada 10 min para ver vida en logs
cron.schedule(
  "*/10 * * * *",
  () => {
    const now = nowInTZ();
    console.log(`💚 Health: ${now.date} ${now.time} (${TZ})`);
  },
  { timezone: TZ }
);

// Shutdown limpio
process.on("SIGINT", async () => {
  console.log("🧹 Cerrando (SIGINT)...");
  try { await client.destroy(); } catch {}
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🧹 Cerrando (SIGTERM)...");
  try { await client.destroy(); } catch {}
  process.exit(0);
});

// Start
client.initialize();
