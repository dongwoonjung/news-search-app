-- 벡터 확장 활성화 (Supabase에서 pgvector 사용)
CREATE EXTENSION IF NOT EXISTS vector;

-- 기사 임베딩 저장 테이블
CREATE TABLE IF NOT EXISTS article_embeddings (
  id SERIAL PRIMARY KEY,
  article_url TEXT UNIQUE NOT NULL,
  article_title TEXT NOT NULL,
  article_summary TEXT,
  category VARCHAR(50),
  source VARCHAR(100),
  published_at TIMESTAMP WITH TIME ZONE,
  embedding vector(384), -- all-MiniLM-L6-v2 모델 차원
  entities JSONB, -- 추출된 엔티티 (국가/기업/인물 등)
  keywords JSONB, -- 핵심 키워드
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_article_embeddings_category ON article_embeddings(category);
CREATE INDEX IF NOT EXISTS idx_article_embeddings_published ON article_embeddings(published_at);
CREATE INDEX IF NOT EXISTS idx_article_embeddings_url ON article_embeddings(article_url);

-- 벡터 유사도 검색을 위한 인덱스 (IVFFlat)
CREATE INDEX IF NOT EXISTS idx_article_embeddings_vector ON article_embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 유사 기사 검색 함수
CREATE OR REPLACE FUNCTION search_similar_articles(
  query_embedding vector(384),
  query_category VARCHAR(50),
  days_back INTEGER DEFAULT 7,
  match_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id INTEGER,
  article_url TEXT,
  article_title TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.id,
    ae.article_url,
    ae.article_title,
    1 - (ae.embedding <=> query_embedding) AS similarity
  FROM article_embeddings ae
  WHERE ae.category = query_category
    AND ae.published_at >= NOW() - (days_back || ' days')::INTERVAL
  ORDER BY ae.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
