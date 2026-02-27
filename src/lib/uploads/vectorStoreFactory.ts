import BaseEmbedding from '../models/base/embedding';
import { VectorStore } from './vectorStore';
import LocalVectorStore from './localVectorStore';

/**
 * Returns the configured VectorStore implementation based on the
 * VECTOR_STORE_PROVIDER environment variable.
 *
 * Supported values (case-insensitive):
 *   local    – Default. Uses local JSON files + in-memory cosine similarity.
 *   qdrant   – Qdrant vector database (requires QDRANT_URL etc.).
 *   pgvector – PostgreSQL + pgvector (requires PGVECTOR_URL etc.).
 */
async function getVectorStore(
  embeddingModel: BaseEmbedding<any>,
): Promise<VectorStore> {
  const provider = (process.env.VECTOR_STORE_PROVIDER ?? 'local').toLowerCase();

  switch (provider) {
    case 'qdrant': {
      const { default: LangChainQdrantVectorStore } = await import(
        './langchainQdrantVectorStore'
      );
      return new LangChainQdrantVectorStore(embeddingModel);
    }
    case 'pgvector': {
      const { default: LangChainPGVectorStore } = await import(
        './langchainPGVectorStore'
      );
      return new LangChainPGVectorStore(embeddingModel);
    }
    case 'local':
    default:
      return new LocalVectorStore(embeddingModel);
  }
}

export { getVectorStore };
