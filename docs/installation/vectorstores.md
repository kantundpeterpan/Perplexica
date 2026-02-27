# Vector Store Configuration

By default, Perplexica stores uploaded document embeddings as local JSON files and performs in-memory cosine-similarity search. This works well for small-scale usage and requires no additional infrastructure.

For larger deployments you can switch to an external vector database by setting the `VECTOR_STORE_PROVIDER` environment variable.

---

## Providers

### `local` (default)

No extra configuration required. Embeddings are stored in `data/uploads/*.content.json` and retrieved via in-memory cosine similarity.

### `qdrant`

Uses [Qdrant](https://qdrant.tech/) as the vector store.

| Variable | Required | Default | Description |
|---|---|---|---|
| `VECTOR_STORE_PROVIDER` | ✅ | `local` | Set to `qdrant` |
| `QDRANT_URL` | ✅ | `http://localhost:6333` | Qdrant HTTP endpoint |
| `QDRANT_COLLECTION` | ❌ | `perplexica_uploads` | Collection name |
| `QDRANT_API_KEY` | ❌ | – | API key (required for Qdrant Cloud) |

**Quick start with Docker Compose:**

```bash
docker compose -f docker-compose.qdrant.yml up -d
```

### `pgvector`

Uses PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension.

| Variable | Required | Default | Description |
|---|---|---|---|
| `VECTOR_STORE_PROVIDER` | ✅ | `local` | Set to `pgvector` |
| `PGVECTOR_URL` | ✅ | `postgresql://postgres:postgres@localhost:5432/perplexica` | PostgreSQL connection string |
| `PGVECTOR_TABLE` | ❌ | `perplexica_uploads` | Table name |
| `PGVECTOR_SCHEMA` | ❌ | `public` | Schema name |

**Quick start with Docker Compose:**

```bash
docker compose -f docker-compose.pgvector.yml up -d
```

---

## Optional: Dual-write

When migrating from `local` to an external store you may want to keep writing `.content.json` files alongside the external store so that a rollback is possible without re-processing uploads:

```
VECTOR_STORE_DUAL_WRITE=true
```

This has no effect when `VECTOR_STORE_PROVIDER=local`.

---

## Chunk ID scheme

Chunk IDs are deterministic and formatted as `{fileId}:{chunkIndex}` (e.g. `abc123:0`, `abc123:1`). Re-uploading the same file will overwrite existing chunks in the external store, making upserts idempotent.
