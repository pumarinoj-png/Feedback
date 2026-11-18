# Práctica de Feedback

Simulador para practicar conversaciones de feedback con una contraparte simulada por IA (Claude).

**Flujo:** elegir modelo (SBI, CARPA o Comunicación No Violenta) → definir para quién es, contexto y actitud → construir el caso → conversar como líder → pedir feedback con % por criterio, promedio general y dos tips.

## Estructura

```
feedback-coach/
├── index.html      # Interfaz (4 pantallas)
├── styles.css      # Estilos
├── app.js          # Lógica del front (estado, chat, feedback)
├── api/
│   └── chat.js     # Función serverless: habla con Claude (la API key queda en el servidor)
├── vercel.json     # Duración máxima de la función
├── package.json
├── .env.example    # Variables de entorno de ejemplo
└── .gitignore
```

No hay dependencias que instalar ni paso de build.

## Publicar en GitHub y Vercel

1. **GitHub:** crea un repositorio nuevo y sube todos estos archivos (puedes arrastrarlos desde la web de GitHub: *Add file → Upload files*).
2. **Vercel:** entra a [vercel.com/new](https://vercel.com/new), importa el repositorio y deja la configuración por defecto (*Framework Preset: Other*, sin build command ni output directory).
3. **Variable de entorno:** antes de desplegar (o después, en *Settings → Environment Variables*), agrega:
   - `ANTHROPIC_API_KEY` = tu API key de Anthropic.
4. Despliega. Si agregaste la variable después, haz *Redeploy* para que se aplique.

## Probar en local (opcional)

```bash
npm i -g vercel
cp .env.example .env.local   # y pega tu API key
vercel dev
```

Abre http://localhost:3000.

## Personalización rápida

- **Modelos de IA:** variables `CHAT_MODEL` y `FEEDBACK_MODEL` (por defecto `claude-sonnet-5-5`). Para abaratar costos puedes usar un modelo más liviano en `CHAT_MODEL`.
- **Comportamiento de la contraparte y criterios de evaluación:** están en `api/chat.js` (`ATTITUDES`, `buildPersonaPrompt`, `buildFeedbackPrompt`, `MODELS`).
- **Campos y textos de cada modelo en la pantalla:** `MODELS` en `app.js`.

## Notas

- La conversación se guarda solo en la sesión del navegador (`sessionStorage`); no se almacena nada en el servidor.
- Si publicas la app abiertamente, cualquiera que tenga el enlace consumirá tu cuota de API. Para uso privado considera activar *Vercel Authentication* / *Password Protection* en el proyecto, o agregar un límite de uso a la función.
