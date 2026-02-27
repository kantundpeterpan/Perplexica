import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';
import BaseEmbedding from '../models/base/embedding';

/**
 * Bridges Perplexica's BaseEmbedding to the LangChain Embeddings interface
 * so that LangChain vector store implementations can use the configured
 * embedding model directly.
 */
class PerplexicaEmbeddingsAdapter extends Embeddings {
  constructor(
    private readonly model: BaseEmbedding<any>,
    params?: EmbeddingsParams,
  ) {
    super(params ?? {});
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.model.embedText(texts);
  }

  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.model.embedText([text]);
    return embedding;
  }
}

export default PerplexicaEmbeddingsAdapter;
