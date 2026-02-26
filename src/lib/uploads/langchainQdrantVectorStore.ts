import { QdrantVectorStore } from '@langchain/qdrant';
import { Document } from '@langchain/core/documents';
import { Chunk } from '../types';
import { VectorStore } from './vectorStore';
import PerplexicaEmbeddingsAdapter from './langchainEmbeddingsAdapter';
import BaseEmbedding from '../models/base/embedding';
import { v5 as uuidv5 } from 'uuid';

/**
 * Qdrant-backed vector store implementation.
 *
 * Required environment variables:
 *   QDRANT_URL        – e.g. http://localhost:6333
 *   QDRANT_COLLECTION – collection name (default: perplexica_uploads)
 *
 * Optional:
 *   QDRANT_API_KEY    – API key for Qdrant Cloud
 */

const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace for deterministic v5 IDs

class LangChainQdrantVectorStore implements VectorStore {
  private readonly url: string;
  private readonly collection: string;
  private readonly apiKey: string | undefined;
  private readonly adapter: PerplexicaEmbeddingsAdapter;

  constructor(embeddingModel: BaseEmbedding<any>) {
    this.url = process.env.QDRANT_URL ?? 'http://localhost:6333';
    this.collection =
      process.env.QDRANT_COLLECTION ?? 'perplexica_uploads';
    this.apiKey = process.env.QDRANT_API_KEY;
    this.adapter = new PerplexicaEmbeddingsAdapter(embeddingModel);
  }

  private getStore(): QdrantVectorStore {
    return new QdrantVectorStore(this.adapter, {
      url: this.url,
      collectionName: this.collection,
      ...(this.apiKey ? { apiKey: this.apiKey } : {}),
    });
  }

  async upsertFileChunks(
    fileId: string,
    fileName: string,
    chunks: { content: string; embedding: number[] }[],
  ): Promise<void> {
    const store = this.getStore();
    const docs = chunks.map((chunk) => {
      const doc = new Document({
        pageContent: chunk.content,
        metadata: { fileId, fileName },
      });
      return doc;
    });

    // Use deterministic IDs: fileId:chunkIndex
    // const ids = chunks.map((_, idx) => `${fileId}:${idx}`);
    const ids = chunks.map((_, idx) => uuidv5(`${fileId}:${idx}`, UUID_NAMESPACE));

    await store.addDocuments(docs, { ids });
  }

  async deleteFile(fileId: string): Promise<void> {
    const store = this.getStore();
    await store.delete({ filter: { must: [{ key: 'metadata.fileId', match: { value: fileId } }] } });
  }

  async similaritySearch(
    queries: string[],
    topK: number,
    filter: { fileIds: string[] },
  ): Promise<Chunk[]> {
    const store = this.getStore();

    const qdrantFilter = {
      must: [
        {
          key: 'metadata.fileId',
          match: { any: filter.fileIds },
        },
      ],
    };

    const allResults: Document[] = [];
    const seen = new Set<string>();

    for (const query of queries) {
      const results = await store.similaritySearch(query, topK, qdrantFilter);
      for (const doc of results) {
        const key = `${doc.metadata.fileId}:${doc.pageContent}`;
        if (!seen.has(key)) {
          seen.add(key);
          allResults.push(doc);
        }
      }
    }

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

export default LangChainQdrantVectorStore;
