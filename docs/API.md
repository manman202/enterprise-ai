# Aiyedun API Reference

Base URL: `https://api.aiyedun.online/api/v1`

All authenticated endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Tokens are obtained from `POST /auth/login` and expire after 8 hours by default.

---

## Table of Contents

- [Authentication](#authentication)
- [Settings (Profile & Password)](#settings-profile--password)
- [Chat](#chat)
- [Documents](#documents)
- [Search](#search)
- [Admin](#admin)
- [Health](#health)
- [Error Format](#error-format)

---

## Authentication

### POST /auth/login

Authenticate a user and receive a JWT access token.

**Auth required:** No

**Request body:**
```json
{
  "username": "alice",
  "password": "s3cur3p@ss"
}
```

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Errors:**
| Code | Detail |
|------|--------|
| 401  | `"Invalid credentials"` |
| 403  | `"Account disabled"` |

---

### POST /auth/register

Register a new user account.

**Auth required:** No

**Request body:**
```json
{
  "username": "alice",
  "email": "alice@company.com",
  "password": "s3cur3p@ss"
}
```

**Response `201 Created`:**
```json
{
  "id": "a1b2c3d4-e5f6-...",
  "username": "alice",
  "email": "alice@company.com",
  "is_active": true,
  "is_admin": false,
  "created_at": "2026-03-08T10:00:00Z"
}
```

**Errors:**
| Code | Detail |
|------|--------|
| 409  | `"Username or email already taken"` |

---

### GET /auth/me

Return the currently authenticated user's profile.

**Auth required:** Yes

**Response `200 OK`:**
```json
{
  "id": "a1b2c3d4-e5f6-...",
  "username": "alice",
  "email": "alice@company.com",
  "is_active": true,
  "is_admin": false,
  "created_at": "2026-03-08T10:00:00Z"
}
```

---

## Settings (Profile & Password)

### PATCH /users/me

Update the authenticated user's username and/or email.

**Auth required:** Yes

**Request body** (all fields optional):
```json
{
  "username": "alice_new",
  "email": "alice_new@company.com"
}
```

**Response `200 OK`:** Updated `UserOut` object (same shape as `GET /auth/me`).

**Errors:**
| Code | Detail |
|------|--------|
| 409  | `"Username already taken"` |
| 409  | `"Email already taken"` |

---

### POST /users/me/password

Change the authenticated user's password.

**Auth required:** Yes

**Request body:**
```json
{
  "current_password": "old_pass",
  "new_password": "new_s3cure!",
  "confirm_password": "new_s3cure!"
}
```

**Response `204 No Content`**

**Errors:**
| Code | Detail |
|------|--------|
| 400  | `"Current password is incorrect"` |
| 422  | `"Passwords do not match"` |

---

## Chat

### POST /chat

Send a message to the AI and receive a response. The backend queries the knowledge base (ChromaDB) for relevant context before generating a response with Mistral via Ollama.

**Auth required:** No *(currently unauthenticated — auth planned in V2)*

**Request body:**
```json
{
  "message": "What is the company leave policy?"
}
```

**Response `200 OK`:**
```json
{
  "response": "Based on the company policy documents, employees are entitled to 25 days annual leave..."
}
```

**Errors:**
| Code | Detail |
|------|--------|
| 422  | `"message must not be empty"` |
| 503  | Ollama unavailable (connection error propagated) |

---

## Documents

### GET /documents

List all uploaded documents.

**Auth required:** No *(currently unauthenticated — auth planned in V2)*

**Response `200 OK`:**
```json
[
  {
    "id": "d1e2f3a4-...",
    "filename": "leave-policy.txt",
    "size": 4096,
    "created_at": "2026-03-01T09:00:00Z"
  },
  {
    "id": "b5c6d7e8-...",
    "filename": "onboarding-guide.pdf",
    "size": 102400,
    "created_at": "2026-03-05T14:30:00Z"
  }
]
```

---

### POST /documents

Upload a document. The file is read, stored in PostgreSQL (metadata), and its text is indexed in ChromaDB.

**Auth required:** No *(currently unauthenticated — auth planned in V2)*

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Plain text or text-extractable file |

**Response `201 Created`:**
```json
{
  "id": "d1e2f3a4-...",
  "filename": "leave-policy.txt",
  "size": 4096,
  "created_at": "2026-03-08T10:00:00Z"
}
```

**Notes:**
- File content is decoded as UTF-8 (with error replacement).
- Large binary files (PDFs with no text layer) will index empty content.

---

### DELETE /documents/{doc_id}

Delete a document from PostgreSQL and remove its vectors from ChromaDB.

**Auth required:** No *(currently unauthenticated — auth planned in V2)*

**Path parameters:**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `doc_id`  | string (UUID) | ID of the document |

**Response `204 No Content`**

**Errors:**
| Code | Detail |
|------|--------|
| 404  | `"Document not found"` |

---

## Search

### POST /search

Perform a semantic similarity search over all indexed documents.

**Auth required:** No *(currently unauthenticated — auth planned in V2)*

**Request body:**
```json
{
  "query": "parental leave entitlement",
  "n_results": 5
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `query` | string | required | Natural language search query |
| `n_results` | integer | 5 | Number of results to return |

**Response `200 OK`:**
```json
{
  "query": "parental leave entitlement",
  "results": [
    {
      "document_id": "d1e2f3a4-...",
      "filename": "leave-policy.txt",
      "excerpt": "Employees are entitled to 18 weeks of parental leave...",
      "score": 0.9231
    },
    {
      "document_id": "b5c6d7e8-...",
      "filename": "hr-handbook.txt",
      "excerpt": "Parental leave is available to all permanent staff...",
      "score": 0.8874
    }
  ]
}
```

`score` is in the range `[0, 1]` — higher is more similar.

**Errors:**
| Code | Detail |
|------|--------|
| 422  | `"query must not be empty"` |

---

## Admin

All admin endpoints require the authenticated user to have `is_admin = true`.

### GET /admin/users

List all registered users.

**Auth required:** Yes (admin)

**Response `200 OK`:**
```json
[
  {
    "id": "a1b2c3d4-...",
    "username": "alice",
    "email": "alice@company.com",
    "is_active": true,
    "is_admin": true,
    "created_at": "2026-01-01T00:00:00Z"
  },
  {
    "id": "e5f6a7b8-...",
    "username": "bob",
    "email": "bob@company.com",
    "is_active": true,
    "is_admin": false,
    "created_at": "2026-02-15T08:00:00Z"
  }
]
```

---

### PATCH /admin/users/{user_id}

Update a user's `is_active` or `is_admin` flags.

**Auth required:** Yes (admin)

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | string (UUID) | Target user ID |

**Request body** (all fields optional):
```json
{
  "is_active": false,
  "is_admin": true
}
```

**Response `200 OK`:** Updated `UserOut` object.

**Errors:**
| Code | Detail |
|------|--------|
| 400  | `"Cannot deactivate your own account"` |
| 400  | `"Cannot remove your own admin role"` |
| 404  | `"User not found"` |

---

### DELETE /admin/users/{user_id}

Permanently delete a user account.

**Auth required:** Yes (admin)

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | string (UUID) | Target user ID |

**Response `204 No Content`**

**Errors:**
| Code | Detail |
|------|--------|
| 400  | `"Cannot delete your own account"` |
| 404  | `"User not found"` |

---

## Health

### GET /health

Check connectivity to all backing services.

**Auth required:** No

**Response `200 OK`:**
```json
{
  "api": "ok",
  "postgres": "ok",
  "chromadb": "ok",
  "ollama": "ok"
}
```

If a service is unreachable, its value will be an error string instead of `"ok"`:

```json
{
  "api": "ok",
  "postgres": "ok",
  "chromadb": "ok",
  "ollama": "connect timeout"
}
```

---

## Error Format

All error responses follow FastAPI's default format:

```json
{
  "detail": "Human-readable error message"
}
```

For validation errors (422):

```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```
