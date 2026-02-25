import BaseEmbedding from '../models/base/embedding';
import UploadManager from './manager';
import computeSimilarity from '../utils/computeSimilarity';
import { Chunk } from '../types';
import { hashObj } from '../serverUtils';
import { VectorStore } from './vectorStore';

/**
 * Default local implementation of VectorStore that uses the existing
 * JSON content files and in-memory cosine similarity search.
 */
class LocalVectorStore implements VectorStore {
  constructor(private embeddingModel: BaseEmbedding<any>) {}

  async upsertFileChunks(
    _fileId: string,
    _fileName: string,
    _chunks: { content: string; embedding: number[] }[],
  ): Promise<void> {
    // Local store writes are handled by UploadManager directly; nothing to do here.
  }

  async deleteFile(_fileId: string): Promise<void> {
    // Not implemented for local store.
  }

  async similaritySearch(
    queries: string[],
    topK: number,
    filter: { fileIds: string[] },
  ): Promise<Chunk[]> {
    const records: {
      embedding: number[];
      content: string;
      fileId: string;
      metadata: Record<string, any>;
    }[] = [];

    for (const fileId of filter.fileIds) {
      const file = UploadManager.getFile(fileId);
      if (!file) continue;

      const chunks = UploadManager.getFileChunks(fileId);
      records.push(
        ...chunks.map((chunk) => ({
          embedding: chunk.embedding,
          content: chunk.content,
          fileId,
          metadata: {
            fileName: file.name,
            title: file.name,
            url: `file_id://${file.id}`,
          },
        })),
      );
    }

    const queryEmbeddings = await this.embeddingModel.embedText(queries);

    const results: { chunk: Chunk; score: number }[][] = [];
    const hashResults: string[][] = [];

    for (const queryEmbedding of queryEmbeddings) {
      const similarities = records
        .map((record) => ({
          chunk: {
            content: record.content,
            metadata: { ...record.metadata, fileId: record.fileId },
          } as Chunk,
          score: computeSimilarity(queryEmbedding, record.embedding),
        }))
        .sort((a, b) => b.score - a.score);

      results.push(similarities);
      hashResults.push(similarities.map((s) => hashObj(s)));
    }

    const chunkMap = new Map<string, Chunk>();
    const scoreMap = new Map<string, number>();
    const k = 60;

    for (let i = 0; i < results.length; i++) {
      for (let j = 0; j < results[i].length; j++) {
        const chunkHash = hashResults[i][j];
        chunkMap.set(chunkHash, results[i][j].chunk);
        scoreMap.set(
          chunkHash,
          (scoreMap.get(chunkHash) || 0) + results[i][j].score / (j + 1 + k),
        );
      }
    }

    return Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([chunkHash]) => chunkMap.get(chunkHash)!)
      .slice(0, topK);
  }
}

export default LocalVectorStore;
