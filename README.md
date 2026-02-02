# 🤖 Bot de Horarios WhatsApp (bot-horarios-wsp)


## 📁 Estructura del proyecto

.
├── index.js               # Archivo principal del bot
├── schedule.json          # Horarios y mensajes configurados
├── package.json           # Dependencias y scripts
├── package-lock.json
├── README.md              # Documentación del proyecto

Esto ayuda muchísimo cuando alguien (o tú mismo) abre el repo.

---

### 2️⃣ Añadir una mini sección de **Deploy / Actualización**
Esto responde exactamente a lo que preguntaste antes (“¿cambio schedule y redeploy?”).

Añade esta sección cerca del final:

```markdown
## 🚀 Deploy y actualización

El proyecto está conectado a GitHub y Railway.

Flujo de actualización:
1. Modificar `schedule.json` o código en Visual Studio Code
2. Hacer commit y push a GitHub
3. Railway detecta el cambio
4. Se ejecuta un deploy automático

⚠️ Nota:
- Cada redeploy requiere volver a escanear el QR de WhatsApp


Bot automatizado de WhatsApp que envía recordatorios de horarios a grupos específicos, ejecutándose en la nube mediante Railway y utilizando WhatsApp Web (whatsapp-web.js).

El bot está diseñado para:
- Mantener bajo consumo de recursos
- Ejecutarse de forma continua
- Ser fácil de modificar y mantener en el tiempo

---

## 🧩 Funcionalidad principal

- Lee un archivo `schedule.json` con horarios configurados
- Revisa **cada minuto** si corresponde enviar un mensaje
- Envía mensajes automáticamente a grupos de WhatsApp configurados
- Funciona con zona horaria específica (America/Bogota)
- Mantiene sesión activa sin necesidad de reescanear QR (mientras no se redeploye)

---

## 🛠️ Tecnologías utilizadas

- **Node.js**
- **whatsapp-web.js**
- **Puppeteer / Chromium**
- **Railway** (deploy y ejecución continua)
- **GitHub** (control de versiones y deploy automático)

---

## 📁 Estructura del proyecto



---

## ⏱️ Lógica de ejecución

1. El bot se inicia
2. Se autentica con WhatsApp Web
3. Queda en espera (idle)
4. **Cada minuto**:
   - Lee `schedule.json`
   - Compara la hora actual con los horarios definidos
   - Si hay coincidencia → envía mensaje
5. Vuelve a esperar

> Revisar cada minuto **NO genera alto consumo**.  
> Es una operación muy liviana (lectura + comparación).

---

## 🧠 ¿Por qué revisar cada minuto?

- Garantiza precisión en los horarios
- Evita perder mensajes por retrasos
- Consume recursos mínimos (confirmado por métricas)

Patrón de consumo observado:
- CPU ≈ 0% la mayor parte del tiempo
- Picos breves solo al enviar mensajes
- Memoria estable (Chromium + WhatsApp Web)

---

## 🕒 Zona horaria

La zona horaria se controla mediante la variable de entorno:

TZ=America/Bogota


Esto asegura que los horarios coincidan con la hora local esperada.

---

## ⚙️ Variables de entorno (Railway)

Configuradas en Railway → **Variables**:

| Variable        | Descripción |
|-----------------|-------------|
| `GROUP_IDS`     | IDs de los grupos de WhatsApp (separados por coma) |
| `LEAD_MINUTES`  | Minutos de anticipación (si aplica) |
| `TZ`            | Zona horaria (`America/Bogota`) |
| `HEADLESS`      | `true` para ejecutar Chromium sin interfaz |

---

## 🗓️ Configuración de horarios (`schedule.json`)

Ejemplo de estructura:

```json
[
  {
    "day": "Monday",
    "time": "08:00",
    "message": "Buenos días, recuerden el horario de hoy..."
  }
]



## 🔐 Autenticación WhatsApp (QR)

- El QR aparece en los logs como un texto que empieza por:
  `data:image/png;base64,...`
- Se debe copiar **completo** y pegar en la barra de direcciones del navegador
- El QR expira rápido, se recomienda escanearlo inmediatamente
- Cada redeploy invalida la sesión anterior
## 🧘 Nota final

El bot está diseñado para ejecutarse de forma continua con bajo consumo.
Si los mensajes llegan correctamente y las métricas son estables:

👉 **no es necesario intervenir ni optimizar más**.
