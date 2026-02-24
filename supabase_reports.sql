-- =============================================
-- Reports 테이블 생성
-- =============================================

CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  filename TEXT,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);

-- RLS (Row Level Security) 정책
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능 (간단한 설정)
CREATE POLICY "Allow all operations on reports" ON reports
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================
-- Storage 버킷 생성 (Supabase Dashboard에서 수동 생성 필요)
-- =============================================
-- 1. Supabase Dashboard > Storage 메뉴
-- 2. "New bucket" 클릭
-- 3. Name: "reports"
-- 4. Public bucket: ON (다운로드 허용)
-- 5. Create bucket
--
-- 또는 SQL로:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', true);
