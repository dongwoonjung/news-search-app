-- 기존 테이블에 새 컬럼 추가 (키워드 타입, 점수 시스템)
ALTER TABLE search_keywords ADD COLUMN IF NOT EXISTS keyword_type VARCHAR(20) DEFAULT 'active';
-- keyword_type: anchor (고정), active (활성), watchlist (관찰)

ALTER TABLE search_keywords ADD COLUMN IF NOT EXISTS frequency_score INTEGER DEFAULT 0;
-- 빈도 점수: 기사에서 얼마나 자주 등장하는지

ALTER TABLE search_keywords ADD COLUMN IF NOT EXISTS acceleration_score INTEGER DEFAULT 0;
-- 가속도 점수: 최근 7일 대비 오늘 얼마나 튀었는지

ALTER TABLE search_keywords ADD COLUMN IF NOT EXISTS reliability_score INTEGER DEFAULT 0;
-- 신뢰도 점수: 주요 매체/공식 발표 소스 가점

ALTER TABLE search_keywords ADD COLUMN IF NOT EXISTS domain_score INTEGER DEFAULT 0;
-- 도메인 적합성 점수: 카테고리와의 연관성

ALTER TABLE search_keywords ADD COLUMN IF NOT EXISTS total_score INTEGER DEFAULT 0;
-- 종합 점수

ALTER TABLE search_keywords ADD COLUMN IF NOT EXISTS consecutive_low_days INTEGER DEFAULT 0;
-- 연속 저점수 일수 (N일 연속 낮으면 자동 제거/보류)

ALTER TABLE search_keywords ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;
-- 마지막으로 기사에서 발견된 시간

ALTER TABLE search_keywords ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
-- 엔티티 타입: country, organization, company, person, concept, trigger

-- 키워드 히스토리 테이블 (점수 변화 추적)
CREATE TABLE IF NOT EXISTS keyword_history (
  id SERIAL PRIMARY KEY,
  keyword_id INTEGER REFERENCES search_keywords(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  frequency INTEGER DEFAULT 0,
  article_count INTEGER DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_keyword_history_keyword_id ON keyword_history(keyword_id);
CREATE INDEX IF NOT EXISTS idx_keyword_history_recorded_at ON keyword_history(recorded_at);

-- 기사 클러스터 테이블 (토픽 군집)
CREATE TABLE IF NOT EXISTS article_clusters (
  id SERIAL PRIMARY KEY,
  cluster_name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  article_count INTEGER DEFAULT 0,
  keywords JSONB, -- 클러스터에서 추출된 키워드들
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_article_clusters_category ON article_clusters(category);
CREATE INDEX IF NOT EXISTS idx_article_clusters_created_at ON article_clusters(created_at);

-- 기존 키워드들을 anchor 타입으로 설정
UPDATE search_keywords SET keyword_type = 'anchor' WHERE source = 'manual' AND status = 'approved';
