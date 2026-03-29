# 🏠 Bitácora Familiar

App de limpieza colaborativa para uso familiar con Supabase + Netlify.

---

## 📁 Estructura del proyecto

```
bitacora-familiar/
├── index.html
├── package.json
├── vite.config.js
├── netlify.toml
├── .env.example
├── supabase-schema.sql
└── src/
    ├── main.jsx
    ├── App.jsx
    └── supabaseClient.js
```

---

## 🚀 Setup paso a paso

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New Project**
2. Elige nombre, contraseña y región (la más cercana a tu familia)
3. Espera ~2 minutos a que termine de inicializarse

### 2. Crear las tablas y el bucket

1. En tu proyecto de Supabase, ve a **SQL Editor**
2. Haz clic en **New Query**
3. Copia y pega todo el contenido de `supabase-schema.sql`
4. Haz clic en **Run** (▶️)
5. Debes ver "Success. No rows returned" — eso es correcto

### 3. Obtener tus credenciales

1. Ve a **Settings → API** en tu proyecto de Supabase
2. Copia:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon / public key** (la clave larga que empieza con `eyJ...`)

### 4. Subir a GitHub

1. Crea un repositorio nuevo en GitHub (puede ser privado)
2. Sube todos estos archivos manteniendo la misma estructura de carpetas
3. **⚠️ NO subas el archivo `.env`** — solo sube `.env.example`

### 5. Conectar con Netlify

1. Ve a [netlify.com](https://netlify.com) → **Add new site → Import an existing project**
2. Conecta tu repositorio de GitHub
3. Netlify detectará automáticamente la configuración de `netlify.toml`
4. Antes de hacer deploy, ve a **Site settings → Environment variables** y agrega:
   ```
   VITE_SUPABASE_URL     = https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJ...tu-clave-anon...
   ```
5. Haz clic en **Deploy site** ✅

### 6. (Local, opcional) Probar en tu computadora

```bash
# 1. Copia el archivo de variables de entorno
cp .env.example .env

# 2. Edita .env y pega tus credenciales de Supabase

# 3. Instala dependencias
npm install

# 4. Inicia el servidor de desarrollo
npm run dev
```

---

## 👤 Primer uso

1. Abre la app en tu URL de Netlify
2. Ve a **Registrarse** y crea la primera cuenta
3. **La primera cuenta creada será automáticamente Administrador** 👑
4. Comparte la URL con el resto de la familia para que se registren

---

## 🔐 Notas de seguridad

- Las contraseñas se guardan en texto plano (suficiente para uso familiar interno)
- Si quieres mayor seguridad en el futuro, puedes migrar a Supabase Auth
- El bucket de fotos es público (las URLs son accesibles por quien las tenga)
- Para mayor privacidad, puedes activar RLS en Supabase (ver comentarios en el schema)

---

## 📸 Fotos (Evidencias)

Las fotos se redimensionan automáticamente a máximo 800px antes de subir.
Se almacenan en el bucket `evidencias` de Supabase Storage.

---

## 🎯 Puntos y gamificación

| Acción | Puntos |
|--------|--------|
| Tarea completada | +10 pts |
| Entrada 100% completa | +50 pts bonus |
| Racha 3 meses | 🥉 |
| Racha 6 meses | 🥈 |
| Racha 12 meses | 🥇 |

Al final del año, quien acumule más puntos gana 🏆
