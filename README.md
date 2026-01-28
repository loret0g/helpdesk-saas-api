# 🧩 Helpdesk SaaS API

Backend de un **Helpdesk / Ticketing System** desarrollado como proyecto de portfolio, diseñado para reflejar **arquitectura backend real**, control de roles y flujos habituales en aplicaciones SaaS.

La API gestiona:
- usuarios con roles
- tickets y su ciclo de vida
- mensajes con flujo automático de estado
- asignación de tickets
- base de conocimiento (Knowledge Base)

---

## 🚀 Tecnologías

- **Node.js**
- **Express**
- **MongoDB + Mongoose**
- **JWT** (autenticación)
- **bcrypt** (hash de contraseñas)
- **dotenv**
- **morgan**

---

## 👥 Roles del sistema

### CUSTOMER
- Crear tickets
- Ver solo sus propios tickets
- Enviar mensajes en sus tickets
- Consultar artículos publicados de la Knowledge Base

### AGENT
- Ver inbox de tickets
- Asignarse tickets
- Responder tickets
- Cambiar estado de tickets
- Crear y editar artículos de la Knowledge Base

### ADMIN
- Mismos permisos operativos que un agente (MVP)
- Rol preparado para futuras tareas de supervisión y configuración

---

## 🎫 Tickets

### Estados del ticket
- `OPEN`
- `IN_PROGRESS`
- `WAITING_CUSTOMER`
- `RESOLVED`
- `CLOSED`

### Flujo automático de estado
- Cuando responde un **AGENT**:
  - El ticket pasa a `WAITING_CUSTOMER`
  - Si estaba sin asignar, se auto-asigna al agente
- Cuando responde un **CUSTOMER**:
  - Si estaba `RESOLVED` o `CLOSED`, el ticket se reabre
  - Si tiene agente asignado → pasa a `IN_PROGRESS`
- En cada interacción se actualiza `lastMessageAt` para ordenar correctamente el inbox

---

## 💬 Mensajes

Los mensajes están asociados a un ticket y siguen estas reglas:
- Acceso validado según rol
- Se guarda el autor del mensaje
- Cada mensaje puede modificar automáticamente el estado del ticket

---

## 📚 Knowledge Base (KB)

Sistema de artículos de ayuda con los siguientes estados:
- `DRAFT`
- `PUBLISHED`
- `ARCHIVED`

Accesos:
- **CUSTOMER** → solo puede ver artículos `PUBLISHED`
- **AGENT / ADMIN** → pueden crear, editar, publicar y archivar artículos

Los artículos están organizados por categoría y son accesibles mediante `slug`.

---

## 🔐 Autenticación

La API utiliza **JWT** para la autenticación.

Todas las rutas protegidas requieren el header:
```http
Authorization: Bearer TOKEN
```

---

## 📡 Endpoints principales

### Auth
- `POST /api/auth/login`
- `GET /api/auth/me`

### Tickets
- `POST /api/tickets`
- `GET /api/tickets`
- `GET /api/tickets/:id`
- `PATCH /api/tickets/:id/assign`
- `PATCH /api/tickets/:id/status`

### Mensajes
- `GET /api/tickets/:id/messages`
- `POST /api/tickets/:id/messages`

### Knowledge Base
- `GET /api/kb`
- `GET /api/kb/:slug`
- `POST /api/kb`
- `PATCH /api/kb/:id`
- `DELETE /api/kb/:id` (soft delete → `ARCHIVED`)

---
## ⚙️ Variables de entorno

Crear un archivo `.env` en la raíz del proyecto:

```env
PORT=5000
MONGODB_URI=your_mongo_uri
JWT_SECRET=your_secret
ALLOW_SEED=true
```

---

## ▶️ Instalación y ejecución

Instalar dependencias:
```bash
npm install
```
Ejecutar en desarrollo:
```bash
npm run dev

```
Servidor por defecto (si no se define `PORT` en el `.env`):
```
http://localhost:5000
```

---
## 🌱 Seed

El proyecto incluye un script de seed para crear datos iniciales como:
- usuarios demo (customer / agent / admin)
- categorías

El seed **solo se ejecuta** si:
```env
ALLOW_SEED=true
```



Ejecutar el seed:
```bash
npm run seed

```

---

## 🧪 Estado del proyecto

- ✅ Backend completo (MVP funcional)
- 🔜 Frontend en React
- 🔜 Deploy en producción

---
## ✨ Autora

**Loreto Garde**  
Proyecto de portfolio diseñado como base para un Helpdesk SaaS completo, con frontend y despliegue en producción previstos.

