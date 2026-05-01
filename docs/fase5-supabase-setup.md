# Fase 5 — Configuración de Supabase

Instrucciones para crear y configurar el proyecto Supabase que sirve de backend a GeoTask.
Sigue los pasos en orden. Una vez terminado, el proyecto está listo para integrar el código de la app.

---

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) e inicia sesión (o crea una cuenta gratuita).
2. Pulsa **New project**.
3. Elige un nombre (p. ej. `geotask`), una contraseña fuerte para la base de datos y la región más cercana a tus usuarios (p. ej. `West EU`).
4. Pulsa **Create new project** y espera ~2 minutos a que se aprovisione.

---

## 2. Obtener las credenciales

Ve a **Project Settings → API** y copia:

| Variable | Dónde encontrarla | Ejemplo |
|----------|-------------------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL | `https://xxxxxxxxxxxx.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon / public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC...` |

Crea el fichero `.env` en la raíz del proyecto (ya está en `.gitignore`) con ese contenido:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC...
```

> **Nota:** El prefijo `EXPO_PUBLIC_` hace que Expo exponga la variable al bundle de la app.
> Nunca uses aquí la `service_role` key — esa es solo para servidores.

---

## 3. Configurar proveedores de autenticación

### Email / Contraseña (obligatorio)

Ya está habilitado por defecto. Verifica en **Authentication → Providers → Email** que está activo.

Opcional pero recomendado: desactivar **Confirm email** durante el desarrollo para no tener que verificar cada cuenta de prueba.

### Google OAuth (opcional — Fase 5, Paso 4)

1. Ve a [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Crea un **OAuth 2.0 Client ID** de tipo *Web application*.
3. En **Authorized redirect URIs** añade: `https://xxxxxxxxxxxx.supabase.co/auth/v1/callback`
4. Copia el **Client ID** y **Client Secret**.
5. En Supabase: **Authentication → Providers → Google** → pega ambos valores → Save.

### Apple Sign In (opcional — solo iOS, Fase 5, Paso 4)

1. Necesitas una cuenta de Apple Developer ($99/año).
2. En [developer.apple.com](https://developer.apple.com) → Certificates → Identifiers → tu App ID → habilita **Sign In with Apple**.
3. Crea un **Service ID** y configura el dominio de Supabase como dominio autorizado.
4. En Supabase: **Authentication → Providers → Apple** → rellena los campos.

---

## 4. Ejecutar el script SQL

Ve a **SQL Editor → New query**, pega el script completo de abajo y pulsa **Run**.

```sql
-- ============================================================
-- GeoTask — Esquema de base de datos (Fase 5)
-- Ejecutar completo en Supabase SQL Editor → New query → Run
-- ============================================================

-- ------------------------------------------------------------
-- TABLA: perfiles
-- Almacena el nombre y avatar de cada usuario registrado.
-- Se crea automáticamente (vía trigger) al registrarse.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS perfiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede ver el perfil de otros
-- (necesario para mostrar quién creó una tarea compartida)
CREATE POLICY "perfiles_publicos_lectura"
  ON perfiles FOR SELECT
  USING (TRUE);

-- Solo el propio usuario puede modificar su perfil
CREATE POLICY "perfil_propio_escritura"
  ON perfiles FOR ALL
  USING (id = auth.uid());

-- Trigger: crear fila vacía en perfiles cada vez que se registra un usuario nuevo
CREATE OR REPLACE FUNCTION manejar_nuevo_usuario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfiles (id, nombre)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_nuevo_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION manejar_nuevo_usuario();

-- ------------------------------------------------------------
-- TABLA: tareas
-- Espejo en la nube de la tabla SQLite local.
-- Cada fila pertenece a un usuario (owner_id) o a una lista
-- compartida (lista_id). RLS garantiza que nadie ve datos ajenos.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tareas (
  id               UUID PRIMARY KEY,
  owner_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lista_id         UUID,                          -- null = tarea personal
  titulo           TEXT NOT NULL,
  descripcion      TEXT DEFAULT '',
  categoria_id     TEXT NOT NULL,
  latitud          DOUBLE PRECISION NOT NULL,
  longitud         DOUBLE PRECISION NOT NULL,
  direccion        TEXT DEFAULT '',
  nombre_lugar     TEXT,
  osm_id           TEXT,
  radio_proximidad INTEGER DEFAULT 500,
  geocerca_activa  BOOLEAN DEFAULT TRUE,
  completada       BOOLEAN DEFAULT FALSE,
  prioridad        TEXT DEFAULT 'media'
                   CHECK (prioridad IN ('alta', 'media', 'baja')),
  fecha_creacion   TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_completada TIMESTAMPTZ,
  fecha_limite     TIMESTAMPTZ,
  fotos            TEXT[] DEFAULT '{}',
  plantilla_id     UUID,
  updated_at       TIMESTAMPTZ DEFAULT now()      -- usado para sync incremental
);

ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

-- El usuario solo ve y modifica sus propias tareas personales
CREATE POLICY "propietario_tareas"
  ON tareas
  USING (owner_id = auth.uid());

-- Los miembros de una lista también pueden ver las tareas de esa lista
CREATE POLICY "miembros_lista_tareas"
  ON tareas FOR SELECT
  USING (
    lista_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM miembros_lista
      WHERE miembros_lista.lista_id = tareas.lista_id
        AND miembros_lista.user_id  = auth.uid()
    )
  );

-- Función auxiliar: actualizar updated_at automáticamente al editar
CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_tareas_updated_at
  BEFORE UPDATE ON tareas
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- ------------------------------------------------------------
-- TABLA: listas
-- Grupos de tareas que varios usuarios pueden compartir.
-- Cada lista tiene un código de 8 caracteres para invitar
-- a otros sin necesidad de conocer su email.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL,
  owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Código corto para invitar a otros usuarios (p. ej. "a3f9bc12")
  codigo     TEXT UNIQUE NOT NULL
             DEFAULT substring(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE listas ENABLE ROW LEVEL SECURITY;

-- El creador de la lista puede hacer todo
CREATE POLICY "lista_propietario"
  ON listas
  USING (owner_id = auth.uid());

-- Los miembros pueden leer la lista (para mostrar su nombre)
CREATE POLICY "lista_miembro_lectura"
  ON listas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM miembros_lista
      WHERE miembros_lista.lista_id = listas.id
        AND miembros_lista.user_id  = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- TABLA: miembros_lista
-- Tabla de unión usuarios ↔ listas con rol por miembro.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS miembros_lista (
  lista_id  UUID REFERENCES listas(id)      ON DELETE CASCADE,
  user_id   UUID REFERENCES auth.users(id)  ON DELETE CASCADE,
  rol       TEXT DEFAULT 'editor'
            CHECK (rol IN ('admin', 'editor', 'lector')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (lista_id, user_id)
);

ALTER TABLE miembros_lista ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve las listas a las que pertenece
CREATE POLICY "miembro_ver_lista"
  ON miembros_lista FOR SELECT
  USING (user_id = auth.uid());

-- Solo el admin de la lista puede añadir o eliminar miembros
CREATE POLICY "admin_gestionar_miembros"
  ON miembros_lista FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM miembros_lista m
      WHERE m.lista_id = miembros_lista.lista_id
        AND m.user_id  = auth.uid()
        AND m.rol      = 'admin'
    )
  );

-- ------------------------------------------------------------
-- REALTIME
-- Habilita la escucha en tiempo real sobre la tabla tareas.
-- Necesario para que los cambios de un usuario lleguen
-- automáticamente a los demás miembros de la misma lista.
-- ------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE tareas;
```

---

## 5. Configurar Supabase Storage (para avatares de perfil)

1. Ve a **Storage → New bucket**.
2. Nombre: `avatares`, marca **Public bucket** (los avatares son visibles para otros usuarios).
3. Pulsa **Create bucket**.
4. En **Storage → Policies → avatares** añade:
   - **SELECT** (lectura pública): `USING (TRUE)`
   - **INSERT/UPDATE** (solo el propio usuario): `USING (auth.uid()::text = (storage.foldername(name))[1])`

   Esto permite que cada usuario suba sus archivos dentro de una carpeta con su propio `user_id` (p. ej. `avatares/abc-123/foto.jpg`).

---

## 6. Verificar que todo está listo

Antes de integrar en la app, comprueba en el dashboard:

- [ ] En **Table Editor**: existen las tablas `perfiles`, `tareas`, `listas`, `miembros_lista`
- [ ] En **Authentication → Providers**: Email habilitado
- [ ] En **Storage**: existe el bucket `avatares`
- [ ] En **Database → Replication**: la tabla `tareas` aparece en `supabase_realtime`
- [ ] Tienes el fichero `.env` con `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## 7. Dependencias npm a instalar en la app

Cuando empieces a integrar el código (Paso 1 de la implementación):

```bash
npx expo install @supabase/supabase-js
npx expo install expo-apple-authentication
```

> `@react-native-google-signin/google-signin` **no** se usa en esta implementación.
> El login con Google se hace vía OAuth browser (`supabase.auth.signInWithOAuth`)
> para evitar configuración nativa compleja. Se puede migrar al SDK nativo en el futuro.

---

## Referencias

- [Supabase Docs — React Native quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/reactnative)
- [Supabase Auth con Expo](https://supabase.com/docs/guides/auth/social-login/auth-google?platform=react-native)
- [Row Level Security (RLS) — guía completa](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
