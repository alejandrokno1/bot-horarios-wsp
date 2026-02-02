// bot.js
// Bot WhatsApp: envía recordatorios 5 minutos antes según schedule.json
// Requisitos: npm i whatsapp-web.js qrcode-terminal node-cron dotenv
//
// Archivos:
// - .env (GROUP_IDS, TZ, LEAD_MINUTES, HEADLESS)
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

// HEADLESS=true/false (por defecto true)
const HEADLESS =
  (process.env.HEADLESS || "true").toLowerCase().trim() === "true";

// IDs de grupos separados por coma
const groupIds = (process.env.GROUP_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!groupIds.length) {
  console.log("❌ Falta GROUP_IDS en .env (IDs separados por coma).");
  process.exit(1);
}

if (!Number.isFinite(LEAD_MINUTES) || LEAD_MINUTES < 1 || LEAD_MINUTES > 60) {
  console.log("❌ LEAD_MINUTES inválido. Usa un número entre 1 y 60.");
  process.exit(1);
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
    process.exit(1);
  }
  const raw = fs.readFileSync(schedulePath, "utf-8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    console.log("❌ schedule.json debe ser un arreglo de eventos.");
    process.exit(1);
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
// Tiempo en TZ (America/Bogota)
// =====================

// Obtiene { date:"YYYY-MM-DD", time:"HH:mm", hour, minute } en TZ
function nowInTZ() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value;

  const hour = Number.parseInt(get("hour"), 10);
  const minute = Number.parseInt(get("minute"), 10);

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    hour,
    minute,
  };
}

// Suma minutos a un date+time *interpretado en Bogota*.
// Como Bogota no usa DST, podemos usar un offset fijo -05:00.
function addMinutesBogota(dateStr, timeStr, deltaMinutes) {
  const iso = `${dateStr}T${timeStr}:00-05:00`; // Bogota offset
  const dt = new Date(iso);
  const out = new Date(dt.getTime() + deltaMinutes * 60_000);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(out);

  const get = (type) => parts.find((p) => p.type === type)?.value;

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
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
 https://asesoriasacademicasnaslybeltran.q10.com/ `;
}

// =====================
// WhatsApp Client
// =====================
const client = new Client({
  authStrategy: new LocalAuth(), // guarda sesión local
  puppeteer: {
    headless: HEADLESS,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  },
});

client.on("qr", (qr) => {
  console.log("📲 Escanea el QR en WhatsApp -> Dispositivos vinculados:");
  qrcode.generate(qr, { small: true });
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

  // Validación rápida: mostrar nombres de los grupos configurados (solo una vez)
  try {
    for (const gid of groupIds) {
      const chat = await client.getChatById(gid);
      console.log(`📌 OK grupo: "${chat.name}" (${gid})`);
    }
    console.log("");
  } catch (e) {
    console.log("⚠️ No pude validar todos los grupos ahora mismo.");
    console.log("   Si luego no envía a alguno, revisa que el ID termine en @g.us.\n");
  }
});

// =====================
// Tick cada minuto
// =====================
async function tick() {
  const schedule = loadSchedule();
  const sentLog = loadSentLog();

  const now = nowInTZ();

  // Hora objetivo = ahora + LEAD_MINUTES
  const target = addMinutesBogota(now.date, now.time, LEAD_MINUTES);
  const targetKeyBase = `${target.date} ${target.time}`;

  // Eventos que empiezan exactamente en target
  const events = schedule.filter(
    (e) => e.date === target.date && e.start === target.time
  );

  if (!events.length) return;

  for (const ev of events) {
    // Clave única para no duplicar (fecha/hora + materia + profe)
    const uniqueKey = `${targetKeyBase}|${ev.subject}|${ev.teacher}`;

    if (sentLog[uniqueKey]) {
      // ya enviado
      continue;
    }

    const msg = buildMessage(ev);

    console.log(`🚀 Enviando aviso para: ${targetKeyBase} | ${ev.subject} | ${ev.teacher}`);

    // Enviar a todos los grupos
    for (const gid of groupIds) {
      try {
        const chat = await client.getChatById(gid);
        await chat.sendMessage(msg);

        // Pausa corta entre grupos (evita rate-limit)
        await new Promise((r) => setTimeout(r, 1200));
      } catch (e) {
        console.log(`❌ Error enviando a ${gid}:`, e?.message || e);
      }
    }

    // Marcar como enviado
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

// Start
client.initialize();
