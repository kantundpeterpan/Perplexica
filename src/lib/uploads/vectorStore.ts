import { Chunk } from '../types';

export interface VectorStore {
  upsertFileChunks(
    fileId: string,
    fileName: string,
    chunks: { content: string; embedding: number[] }[],
  ): Promise<void>;

  deleteFile(fileId: string): Promise<void>;

  similaritySearch(
    queries: string[],
    topK: number,
    filter: { fileIds: string[] },
  ): Promise<Chunk[]>;
}
