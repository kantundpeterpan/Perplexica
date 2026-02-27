import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { Document } from '@langchain/core/documents';
import { Chunk } from '../types';
import { VectorStore } from './vectorStore';
import PerplexicaEmbeddingsAdapter from './langchainEmbeddingsAdapter';
import BaseEmbedding from '../models/base/embedding';

/**
 * PostgreSQL + pgvector backed vector store implementation.
 *
 * Required environment variables:
 *   PGVECTOR_URL  – PostgreSQL connection string, e.g.
 *                   postgresql://user:password@localhost:5432/perplexica
 *
 * Optional:
 *   PGVECTOR_TABLE  – table name (default: perplexica_uploads)
 *   PGVECTOR_SCHEMA – schema name (default: public)
 */
class LangChainPGVectorStore implements VectorStore {
  private readonly connectionString: string;
  private readonly tableName: string;
  private readonly schemaName: string;
  private readonly adapter: PerplexicaEmbeddingsAdapter;

  constructor(embeddingModel: BaseEmbedding<any>) {
    this.connectionString =
      process.env.PGVECTOR_URL ?? 'postgresql://postgres:postgres@localhost:5432/perplexica';
    this.tableName = process.env.PGVECTOR_TABLE ?? 'perplexica_uploads';
    this.schemaName = process.env.PGVECTOR_SCHEMA ?? 'public';
    this.adapter = new PerplexicaEmbeddingsAdapter(embeddingModel);
  }

  private async getStore(): Promise<PGVectorStore> {
    return PGVectorStore.initialize(this.adapter, {
      postgresConnectionOptions: {
        connectionString: this.connectionString,
      },
      tableName: this.tableName,
      schemaName: this.schemaName,
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'embedding',
        contentColumnName: 'content',
        metadataColumnName: 'metadata',
      },
    });
  }

  async upsertFileChunks(
    fileId: string,
    fileName: string,
    chunks: { content: string; embedding: number[] }[],
  ): Promise<void> {
    const store = await this.getStore();

    const docs = chunks.map((chunk) => {
      return new Document({
        pageContent: chunk.content,
        metadata: { fileId, fileName },
      });
    });

    const ids = chunks.map((_, idx) => `${fileId}:${idx}`);

    await store.addDocuments(docs, { ids });
    await store.end();
  }

  async deleteFile(fileId: string): Promise<void> {
    const store = await this.getStore();
    await store.delete({ filter: { fileId } });
    await store.end();
  }

  async similaritySearch(
    queries: string[],
    topK: number,
    filter: { fileIds: string[] },
  ): Promise<Chunk[]> {
    const store = await this.getStore();

    const allResults: Document[] = [];
    const seen = new Set<string>();

    for (const query of queries) {
      const results = await store.similaritySearch(query, topK, {
        fileId: { in: filter.fileIds },
      });

      for (const doc of results) {
        const key = `${doc.metadata.fileId}:${doc.pageContent}`;
        if (!seen.has(key)) {
          seen.add(key);
          allResults.push(doc);
        }
      }
    }

    await store.end();

    return allResults.slice(0, topK).map((doc) => ({
      content: doc.pageContent,
      metadata: {
        fileId: doc.metadata.fileId,
        fileName: doc.metadata.fileName,
        title: doc.metadata.fileName,
        url: `file_id://${doc.metadata.fileId}`,
      },
    }));
  }
}

export default LangChainPGVectorStore;
