export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Supabase 클라이언트 초기화
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Missing Supabase credentials'
    });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    // GET ?action=download&id=xxx - Word 파일 다운로드
    if (req.method === 'GET' && req.query.action === 'download') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: 'Report ID is required' });

      const { data: report, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !report) return res.status(404).json({ success: false, error: 'Report not found' });

      // 원본 파일이 Storage에 있으면 그 파일을 직접 제공
      if (report.file_url) {
        return res.redirect(302, report.file_url);
      }

      // on-the-fly Word 생성 (스타일 템플릿 적용)
      const {
        Document, Packer, Paragraph, TextRun, AlignmentType,
        Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
        convertInchesToTwip,
      } = await import('docx');

      const FONT = 'Malgun Gothic';
      const C = {
        navy:    '1E3A5F',
        blue:    '2563EB',
        blue2:   '1E40AF',
        gray:    '374151',
        muted:   '94A3B8',
        green:   '059669',
        greenDk: '065F46',
        tblHead: 'DBEAFE',
        tblBdr:  'BFDBFE',
        greenBg: 'F0FDF4',
        hrBlue:  '2563EB',
      };

      // **bold** 텍스트를 TextRun 배열로 파싱
      const boldRuns = (text, opts = {}) =>
        text.split(/\*\*([^*]+)\*\*/g).map((p, i) =>
          new TextRun({ text: p, bold: i % 2 === 1, ...opts })
        );

      // 마크다운 표 → docx Table
      const buildTable = (tableLines) => {
        const dataRows = tableLines.filter(l => !/^\|[\s|:–-]+\|$/.test(l));
        if (!dataRows.length) return null;
        const rows = dataRows.map(l =>
          l.split('|').slice(1, -1).map(c => c.trim())
        );
        const colCount = Math.max(...rows.map(r => r.length));
        const colW = Math.floor(9000 / colCount);
        return new Table({
          width: { size: 9000, type: WidthType.DXA },
          rows: rows.map((cells, ri) =>
            new TableRow({
              tableHeader: ri === 0,
              children: Array.from({ length: colCount }, (_, ci) => {
                const cellText = cells[ci] || '';
                return new TableCell({
                  width: { size: colW, type: WidthType.DXA },
                  shading: ri === 0
                    ? { type: ShadingType.CLEAR, fill: C.tblHead }
                    : (ri % 2 === 0 ? { type: ShadingType.CLEAR, fill: 'F8FAFC' } : undefined),
                  margins: { top: 80, bottom: 80, left: 160, right: 160 },
                  borders: {
                    top:    { style: BorderStyle.SINGLE, size: 1, color: C.tblBdr },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: C.tblBdr },
                    left:   { style: BorderStyle.SINGLE, size: 1, color: C.tblBdr },
                    right:  { style: BorderStyle.SINGLE, size: 1, color: C.tblBdr },
                  },
                  children: [new Paragraph({
                    children: [new TextRun({
                      text: cellText.replace(/\*\*/g, ''),
                      bold: ri === 0,
                      size: ri === 0 ? 19 : 18,
                      font: FONT,
                      color: ri === 0 ? C.navy : C.gray,
                    })],
                  })],
                });
              }),
            })
          ),
        });
      };

      const now = new Date(report.created_at);
      const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
        .replace(/\. /g, '-').replace('.', '');
      const filename = `news_briefing_${dateStr}.docx`;

      const children = [
        // 부제 (팀명)
        new Paragraph({
          children: [new TextRun({ text: '현대자동차 비즈니스 리스크 관리팀', size: 21, font: FONT, color: C.muted })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
        }),
        // 리포트 제목
        new Paragraph({
          children: [new TextRun({ text: report.title, bold: true, size: 38, font: FONT, color: C.navy })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 140 },
        }),
        // 생성일
        new Paragraph({
          children: [new TextRun({
            text: `생성일: ${now.toLocaleDateString('ko-KR')} ${now.toLocaleTimeString('ko-KR')}`,
            italics: true, size: 18, font: FONT, color: C.muted,
          })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 280 },
        }),
        // 구분선
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.hrBlue, space: 1 } },
          spacing: { after: 360 },
        }),
      ];

      const lines = report.content.split('\n');
      let i = 0;

      while (i < lines.length) {
        const raw = lines[i];
        const t = raw.trim();

        // 마크다운 표 블록
        if (t.startsWith('|')) {
          const tableLines = [];
          while (i < lines.length && lines[i].trim().startsWith('|')) {
            tableLines.push(lines[i].trim());
            i++;
          }
          const tbl = buildTable(tableLines);
          if (tbl) {
            children.push(new Paragraph({ text: '', spacing: { after: 60 } }));
            children.push(tbl);
            children.push(new Paragraph({ text: '', spacing: { after: 220 } }));
          }
          continue;
        }

        if (!t) {
          children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
        } else if (t.startsWith('# ')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: t.slice(2), bold: true, size: 34, color: C.navy, font: FONT })],
            spacing: { before: 440, after: 160 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: C.tblBdr, space: 4 } },
          }));
        } else if (t.startsWith('## ')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: t.slice(3), bold: true, size: 27, color: C.blue, font: FONT })],
            spacing: { before: 340, after: 140 },
          }));
        } else if (t.startsWith('### ')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: t.slice(4), bold: true, size: 22, color: C.blue2, font: FONT })],
            spacing: { before: 220, after: 100 },
          }));
        } else if (t.startsWith('- ') || t.startsWith('• ')) {
          children.push(new Paragraph({
            children: boldRuns(t.slice(2), { size: 20, font: FONT, color: C.gray }),
            bullet: { level: 0 },
            spacing: { after: 80 },
          }));
        } else if (t.startsWith('->')) {
          // 현대차 시사점 강조 블록 (-> 형식)
          children.push(new Paragraph({
            children: [
              new TextRun({ text: '→ ', bold: true, size: 20, color: C.green, font: FONT }),
              ...boldRuns(t.slice(2).trim(), { size: 20, color: C.greenDk, font: FONT }),
            ],
            indent: { left: 360 },
            spacing: { before: 80, after: 120 },
            shading: { type: ShadingType.CLEAR, fill: C.greenBg },
          }));
        } else if (t.startsWith('▶')) {
          // 현대차 시사점 강조 블록 (구형 ▶ 형식, 하위 호환)
          children.push(new Paragraph({
            children: [
              new TextRun({ text: '▶ ', bold: true, size: 20, color: C.green, font: FONT }),
              ...boldRuns(t.slice(1).trim(), { size: 20, color: C.greenDk, font: FONT }),
            ],
            indent: { left: 360 },
            spacing: { before: 80, after: 120 },
            shading: { type: ShadingType.CLEAR, fill: C.greenBg },
          }));
        } else if (t.startsWith('—') || t === '— END OF REPORT —') {
          children.push(new Paragraph({
            children: [new TextRun({ text: t, italics: true, size: 18, color: C.muted, font: FONT })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 0 },
          }));
        } else {
          children.push(new Paragraph({
            children: boldRuns(t, { size: 20, font: FONT, color: C.gray }),
            spacing: { after: 120 },
          }));
        }

        i++;
      }

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top:    convertInchesToTwip(1.0),
                bottom: convertInchesToTwip(1.0),
                left:   convertInchesToTwip(1.2),
                right:  convertInchesToTwip(1.0),
              },
            },
          },
          children,
        }],
      });
      const buffer = await Packer.toBuffer(doc);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      return res.status(200).send(buffer);
    }

    // GET - 리포트 목록 조회
    if (req.method === 'GET') {
      const { category: catFilter } = req.query;
      let query = supabase.from('reports').select('*').neq('category', 'news_cache');
      if (catFilter) query = query.eq('category', catFilter);
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const reports = (data || []).map(row => ({
        id: row.id,
        title: row.title,
        category: row.category,
        content: row.content,
        filename: row.filename,
        fileUrl: row.file_url,
        createdAt: row.created_at,
      }));

      return res.status(200).json({ success: true, reports });
    }

    // POST ?action=generate - 선택 기사 종합요약 리포트 생성
    if (req.method === 'POST' && req.query.action === 'generate') {
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ success: false, error: 'Missing Anthropic API key' });
      }

      const { articles, title: reportTitle } = req.body;
      if (!articles || articles.length === 0) {
        return res.status(400).json({ success: false, error: '선택된 기사가 없습니다.' });
      }

      const today = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
      });

      const articlesText = articles.map((a, i) => {
        const source = a.source?.name || a.source || '';
        const desc = (a.description || a.summary || '').slice(0, 100);
        const url = a.url || '';
        return `${i + 1}. [${a.title}]${source ? ` (${source})` : ''}${desc ? ` — ${desc}` : ''}${url ? `\n   URL: ${url}` : ''}`;
      }).join('\n');

      const prompt = `오늘(${today}) 선택된 뉴스 기사들을 분석해 현대자동차 비즈니스 리스크 관리팀용 종합요약 리포트를 작성해주세요.\n\n━━━ 선택된 뉴스 기사 ━━━\n${articlesText}\n━━━━━━━━━━━━━━━━━━━━━━\n\n아래 형식을 정확히 따라 작성하세요:\n\n# 선택 기사 종합요약 ${today}\n\n## 주요 이슈 분석\n[각 기사를 ① ② ③ 형식으로 작성]\n[각 항목: 3~4문장 분석 + 출처 표기 + [원문링크](URL) + 해당시 (빈 줄 후) -> 현대차는... 형식으로 시사점]\n\n## 현대차 종합 시사점\n[선택 기사 전체를 관통하는 현대차 대응 방향을 2~4문장으로 서술]\n\n## 리스크 요약\n| 이슈 | 리스크 수준 | 영향 분야 |\n|------|------------|-------|\n[이슈별 한 줄씩, 리스크 수준: 🔴 높음 / 🟠 중간 / 🟡 주시]\n\n— END OF REPORT —`;

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        system: `당신은 현대자동차 비즈니스 리스크 관리팀 전담 글로벌 시장 인텔리전스 애널리스트입니다. 선택된 뉴스 기사들을 현대차·기아 비즈니스 관점에서 분석해 경영진이 즉시 활용할 수 있는 종합요약을 작성합니다.\n\n[필수 형식 규칙]\n① 출처 표기: 각 항목 끝에 (출처명) 형식\n② 원문링크: URL 제공 시 출처 뒤에 [원문링크](URL) 형식 삽입\n③ 현대차 시사점: 빈 줄 후 "-> 현대차는 [시사점]" 형식. 반드시 "현대차는"으로 시작\n④ 리스크 표: 섹션 말미 마크다운 표 필수\n⑤ 항목 번호: ① ② ③ 형식\n⑥ 수치·날짜·기업명 반드시 포함\n⑦ 단순 사실 나열 금지 — 왜 중요한가 위주로 서술`,
        messages: [{ role: 'user', content: prompt }],
      });

      const reportContent = message.content[0].text;
      const title = reportTitle || `${today} 선택 기사 종합요약 (${articles.length}건)`;

      const { data, error } = await supabase
        .from('reports')
        .insert([{
          title,
          content: reportContent,
          category: 'custom',
          filename: null,
          file_url: null,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        report: { id: data.id, title: data.title, content: data.content, createdAt: data.created_at },
      });
    }

    // POST - 리포트 저장
    if (req.method === 'POST') {
      const { title, content, category, filename, fileData, pdfFilename, pdfData } = req.body;

      if (!title || !content) {
        return res.status(400).json({
          success: false,
          error: 'Title and content are required'
        });
      }

      const timestamp = Date.now();
      let fileUrl = null;
      let pdfUrl = null;

      // docx 파일 업로드
      if (fileData) {
        const buffer = Buffer.from(fileData, 'base64');
        const storagePath = `reports/${timestamp}_${filename}`;

        const { error: uploadError } = await supabase.storage
          .from('reports')
          .upload(storagePath, buffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            upsert: false
          });

        if (uploadError) {
          console.error('Storage upload error (docx):', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('reports')
            .getPublicUrl(storagePath);
          fileUrl = urlData.publicUrl;
        }
      }

      // PDF 파일 업로드
      if (pdfData && pdfFilename) {
        const pdfBuffer = Buffer.from(pdfData, 'base64');
        const pdfStoragePath = `reports/${timestamp}_${pdfFilename}`;

        const { error: pdfUploadError } = await supabase.storage
          .from('reports')
          .upload(pdfStoragePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: false
          });

        if (pdfUploadError) {
          console.error('Storage upload error (pdf):', pdfUploadError);
        } else {
          const { data: pdfUrlData } = supabase.storage
            .from('reports')
            .getPublicUrl(pdfStoragePath);
          pdfUrl = pdfUrlData.publicUrl;
        }
      }

      // 메타데이터 저장
      const { data, error } = await supabase
        .from('reports')
        .insert([{
          title,
          content,
          category: category || null,
          filename: filename || null,
          file_url: fileUrl,
          pdf_url: pdfUrl,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        report: {
          id: data.id,
          title: data.title,
          fileUrl: data.file_url,
          pdfUrl: data.pdf_url,
        }
      });
    }

    // DELETE - 리포트 삭제
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Report ID is required'
        });
      }

      // 먼저 리포트 정보 조회
      const { data: report } = await supabase
        .from('reports')
        .select('filename, file_url')
        .eq('id', id)
        .single();

      // Storage에서 파일 삭제
      if (report?.file_url) {
        const pathMatch = report.file_url.match(/reports\/(.+)$/);
        if (pathMatch) {
          await supabase.storage
            .from('reports')
            .remove([`reports/${pathMatch[1]}`]);
        }
      }

      // 메타데이터 삭제
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (error) {
    console.error('Reports API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
