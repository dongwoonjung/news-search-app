-- 검색 키워드 테이블 생성
CREATE TABLE IF NOT EXISTS search_keywords (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(100) NOT NULL,
  keyword_ko VARCHAR(100), -- 한국어 키워드 (네이버용)
  category VARCHAR(50) NOT NULL, -- geopolitics, economy, automotive, ai-tech
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  source VARCHAR(50) DEFAULT 'google_trends', -- google_trends, manual
  trend_score INTEGER DEFAULT 0, -- 트렌드 점수 (높을수록 인기)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(keyword, category)
);

-- 인덱스 생성
CREATE INDEX idx_keywords_category ON search_keywords(category);
CREATE INDEX idx_keywords_status ON search_keywords(status);
CREATE INDEX idx_keywords_category_status ON search_keywords(category, status);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_search_keywords_updated_at
  BEFORE UPDATE ON search_keywords
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 기본 키워드 삽입 (현재 하드코딩된 키워드들)
INSERT INTO search_keywords (keyword, keyword_ko, category, status, source) VALUES
-- 지정학
('China', '중국', 'geopolitics', 'approved', 'manual'),
('Russia', '러시아', 'geopolitics', 'approved', 'manual'),
('Ukraine', '우크라이나', 'geopolitics', 'approved', 'manual'),
('Middle East', '중동', 'geopolitics', 'approved', 'manual'),
('Iran', '이란', 'geopolitics', 'approved', 'manual'),
('Israel', '이스라엘', 'geopolitics', 'approved', 'manual'),
('Taiwan', '대만', 'geopolitics', 'approved', 'manual'),
('Trump', '트럼프', 'geopolitics', 'approved', 'manual'),
('EU', 'EU', 'geopolitics', 'approved', 'manual'),
('Europe', '유럽', 'geopolitics', 'approved', 'manual'),
('Greenland', '그린란드', 'geopolitics', 'approved', 'manual'),
('Denmark', '덴마크', 'geopolitics', 'approved', 'manual'),
('NATO', '나토', 'geopolitics', 'approved', 'manual'),
('North Korea', '북한', 'geopolitics', 'approved', 'manual'),
('tariff', '관세', 'geopolitics', 'approved', 'manual'),
('sanctions', '제재', 'geopolitics', 'approved', 'manual'),
-- 경제
('Federal Reserve', '연준', 'economy', 'approved', 'manual'),
('inflation', '인플레이션', 'economy', 'approved', 'manual'),
('GDP', 'GDP', 'economy', 'approved', 'manual'),
('interest rate', '금리', 'economy', 'approved', 'manual'),
('Treasury', '국채', 'economy', 'approved', 'manual'),
('recession', '경기침체', 'economy', 'approved', 'manual'),
('unemployment', '실업', 'economy', 'approved', 'manual'),
-- 자동차
('Tesla', '테슬라', 'automotive', 'approved', 'manual'),
('Hyundai', '현대차', 'automotive', 'approved', 'manual'),
('Kia', '기아', 'automotive', 'approved', 'manual'),
('EV', '전기차', 'automotive', 'approved', 'manual'),
('battery', '배터리', 'automotive', 'approved', 'manual'),
('BYD', 'BYD', 'automotive', 'approved', 'manual'),
-- AI/테크
('artificial intelligence', '인공지능', 'ai-tech', 'approved', 'manual'),
('ChatGPT', '챗GPT', 'ai-tech', 'approved', 'manual'),
('autonomous', '자율주행', 'ai-tech', 'approved', 'manual'),
('robotics', '로봇', 'ai-tech', 'approved', 'manual'),
('humanoid', '휴머노이드', 'ai-tech', 'approved', 'manual')
ON CONFLICT (keyword, category) DO NOTHING;
