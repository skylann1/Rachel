import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  // --- Master Table ---
  table: {
    display: 'flex',
    flexDirection: 'column',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#000',
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
  },
  
  // --- Common Cell Style ---
  cell: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#000',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellLeftAlign: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#000',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  // --- Row 1 ---
  row1Logo: { width: '25%' },
  row1Title: { width: '50%' },
  
  // --- Row 2 ---
  row2Col1: { width: '10%' },
  row2Col2: { width: '15%' },
  row2Col3: { width: '15%' },
  row2Col4: { width: '30%' },
  row2Col5: { width: '10%' },
  row2Col6: { width: '20%' },

  // --- Row 3 (Grey bar) ---
  row3Grey: {
    width: '100%',
    height: 15,
    backgroundColor: '#e5e7eb',
  },

  // --- Row 4 (Big Title) ---
  row4BigTitle: {
    width: '100%',
    height: 150,
  },

  // --- Revision Rows ---
  revCol1: { width: '10%' },
  revCol2: { width: '30%' },
  revCol3: { width: '30%' },
  revCol4: { width: '10%' },
  revCol5: { width: '10%' },
  revCol6: { width: '10%' },

  revEmptyRow: { height: 20 },
  revDataRow: { height: 40 },
  revHeaderRow: { height: 18 },

  // --- Typography ---
  textBoldCenter: { fontFamily: 'Helvetica-Bold', fontSize: 9, textAlign: 'center' },
  textCenter: { fontSize: 9, textAlign: 'center' },
  textNormal: { fontSize: 9 },
  textBigBoldCenter: { fontFamily: 'Helvetica-Bold', fontSize: 12, textAlign: 'center' },
  textHugeBoldCenter: { fontFamily: 'Helvetica-Bold', fontSize: 14, textAlign: 'center', marginBottom: 6 },
  placeholderText: { fontSize: 8, color: '#9ca3af' },

  // --- Tahapan Revisi ---
  revisiTitle: { fontFamily: 'Helvetica-Bold', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  revisiTable: {
    flexDirection: 'column',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#000',
  },
  revisiRow: { flexDirection: 'row', minHeight: 25 },
  revisiHeader: {
    borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#000', padding: 5,
    justifyContent: 'center', alignItems: 'center', fontFamily: 'Helvetica-Bold', fontSize: 10
  },
  revisiCell: {
    borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#000', padding: 5,
    justifyContent: 'flex-end',
  },
  dottedLine: { borderBottomWidth: 1, borderBottomStyle: 'dashed', borderBottomColor: '#666', width: '100%', height: 10 },

  // --- Daftar Isi ---
  tocContainer: { marginTop: 20, paddingHorizontal: 20 },
  tocItem: { flexDirection: 'row', marginBottom: 15, alignItems: 'flex-end' },
  tocText: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  tocDots: { flex: 1, borderBottomWidth: 1, borderBottomStyle: 'dotted', borderBottomColor: '#000', marginHorizontal: 5, marginBottom: 3 },
  tocPage: { fontFamily: 'Helvetica-Bold', fontSize: 10 },

  // --- Body ---
  bodyHeader: { fontFamily: 'Helvetica-Bold', fontSize: 11, textAlign: 'center', marginBottom: 20, textTransform: 'uppercase' },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 15, marginBottom: 5, textTransform: 'uppercase' },
  subSectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 5, marginBottom: 5, marginLeft: 10 },
  paragraph: { fontSize: 10, lineHeight: 1.5, marginBottom: 8, textAlign: 'justify' },
  bulletContainer: { flexDirection: 'row', marginBottom: 4, paddingLeft: 10 },
  bulletPoint: { width: 15, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.5 },
  subBulletContainer: { flexDirection: 'row', marginBottom: 4, paddingLeft: 25 },
});

interface ProsedurPDFProps {
  data: {
    projectName: string;
    docNo: string;
    contractNo: string;
    submissionDate: string;
    umum: string;
    scopeOfWork: string;
    tools: string[];
    apd: string[];
    perlengkapanLainnya: string[];
    tahapanPekerjaan: { title: string; points: string[] }[];
    penyelesaianAkhir: string[];
  };
}

export const ProsedurPDF: React.FC<ProsedurPDFProps> = ({ data }) => {
  const sowBullets = data.scopeOfWork.split('\n').filter(line => line.trim() !== '');

  // Render 20 empty rows for Tahapan Revisi
  const emptyRevisiRows = Array.from({ length: 20 }).map((_, i) => (
    <View key={i} style={styles.revisiRow}>
      <View style={[styles.revisiCell, { width: '15%' }]}><View style={styles.dottedLine}></View></View>
      <View style={[styles.revisiCell, { width: '20%' }]}><View style={styles.dottedLine}></View></View>
      <View style={[styles.revisiCell, { width: '65%' }]}><View style={styles.dottedLine}></View></View>
    </View>
  ));

  return (
    <Document>
      {/* PAGE 1: DOKUMEN KONTROL */}
      <Page size="A4" style={styles.page}>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={[styles.cell, styles.row1Logo]}><Text style={styles.placeholderText}>[LOGO PGN]</Text></View>
            <View style={[styles.cell, styles.row1Title]}><Text style={styles.textBigBoldCenter}>{data.projectName.toUpperCase()}</Text></View>
            <View style={[styles.cell, styles.row1Logo]}><Text style={styles.placeholderText}>[LOGO VENDOR]</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.cell, styles.row2Col1]}><Text style={styles.textCenter}>Doc.{'\n'}No</Text></View>
            <View style={[styles.cell, styles.row2Col2]}></View>
            <View style={[styles.cell, styles.row2Col3]}><Text style={styles.textCenter}>Contract No.</Text></View>
            <View style={[styles.cell, styles.row2Col4]}><Text style={styles.textCenter}>{data.contractNo}</Text></View>
            <View style={[styles.cell, styles.row2Col5]}><Text style={styles.textCenter}>Date.</Text></View>
            <View style={[styles.cell, styles.row2Col6]}><Text style={styles.textCenter}>{data.submissionDate}</Text></View>
          </View>
          <View style={styles.tableRow}><View style={[styles.cell, styles.row3Grey]}></View></View>
          <View style={styles.tableRow}>
            <View style={[styles.cell, styles.row4BigTitle]}>
              <Text style={styles.textHugeBoldCenter}>PROSEDUR KERJA</Text>
              <Text style={styles.textBigBoldCenter}>{data.projectName.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.cell, styles.revCol1, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol2, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol3, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol4, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol5, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol6, styles.revEmptyRow]}></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.cell, styles.revCol1, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol2, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol3, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol4, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol5, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol6, styles.revEmptyRow]}></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.cell, styles.revCol1, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol2, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol3, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol4, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol5, styles.revEmptyRow]}></View>
            <View style={[styles.cell, styles.revCol6, styles.revEmptyRow]}></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.cell, styles.revCol1, styles.revDataRow]}><Text style={styles.textCenter}>A</Text></View>
            <View style={[styles.cellLeftAlign, styles.revCol2, styles.revDataRow, { justifyContent: 'center' }]}><Text style={styles.textNormal}>Issued for Review</Text></View>
            <View style={[styles.cell, styles.revCol3, styles.revDataRow]}></View>
            <View style={[styles.cell, styles.revCol4, styles.revDataRow]}></View>
            <View style={[styles.cell, styles.revCol5, styles.revDataRow]}></View>
            <View style={[styles.cell, styles.revCol6, styles.revDataRow]}></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.cell, styles.revCol1, styles.revHeaderRow]}><Text style={styles.textBoldCenter}>REV.</Text></View>
            <View style={[styles.cell, styles.revCol2, styles.revHeaderRow]}><Text style={styles.textBoldCenter}>DESCRIPTION</Text></View>
            <View style={[styles.cell, styles.revCol3, styles.revHeaderRow]}><Text style={styles.textBoldCenter}>BY</Text></View>
            <View style={[styles.cell, styles.revCol4, styles.revHeaderRow]}><Text style={styles.textBoldCenter}>CHKD</Text></View>
            <View style={[styles.cell, styles.revCol5, styles.revHeaderRow]}><Text style={styles.textBoldCenter}>APVD</Text></View>
            <View style={[styles.cell, styles.revCol6, styles.revHeaderRow]}><Text style={styles.textBoldCenter}>APVD</Text></View>
          </View>
        </View>
      </Page>

      {/* PAGE 2: TAHAPAN REVISI */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.revisiTitle}>TAHAPAN REVISI</Text>
        <View style={styles.revisiTable}>
          <View style={styles.revisiRow}>
            <View style={[styles.revisiHeader, { width: '15%' }]}><Text>REVISI</Text></View>
            <View style={[styles.revisiHeader, { width: '20%' }]}><Text>TANGGAL</Text></View>
            <View style={[styles.revisiHeader, { width: '65%' }]}><Text>URAIAN</Text></View>
          </View>
          {emptyRevisiRows}
        </View>
      </Page>

      {/* PAGE 3: DAFTAR ISI */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.revisiTitle}>DAFTAR ISI</Text>
        <View style={styles.tocContainer}>
          <View style={styles.tocItem}><Text style={styles.tocText}>1. UMUM</Text><View style={styles.tocDots}></View><Text style={styles.tocPage}>3</Text></View>
          <View style={styles.tocItem}><Text style={styles.tocText}>2. RUANG LINGKUP</Text><View style={styles.tocDots}></View><Text style={styles.tocPage}>3</Text></View>
          <View style={styles.tocItem}><Text style={styles.tocText}>3. ALAT/ TOOLS</Text><View style={styles.tocDots}></View><Text style={styles.tocPage}>3</Text></View>
          <View style={styles.tocItem}><Text style={styles.tocText}>4. APD</Text><View style={styles.tocDots}></View><Text style={styles.tocPage}>3</Text></View>
          <View style={styles.tocItem}><Text style={styles.tocText}>5. PERLENGKAPAN LAINNYA</Text><View style={styles.tocDots}></View><Text style={styles.tocPage}>4</Text></View>
          <View style={styles.tocItem}><Text style={styles.tocText}>6. TAHAPAN PEKERJAAN</Text><View style={styles.tocDots}></View><Text style={styles.tocPage}>4</Text></View>
          <View style={styles.tocItem}><Text style={styles.tocText}>7. PEKERJAAN PENYELESAIAN AKHIR</Text><View style={styles.tocDots}></View><Text style={styles.tocPage}>4</Text></View>
        </View>
      </Page>

      {/* PAGE 4+: BODY KONTEN */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.bodyHeader}>PROSEDUR KERJA{'\n'}{data.projectName}</Text>
        
        <Text style={styles.sectionTitle}>1. UMUM</Text>
        <Text style={styles.paragraph}>{data.umum}</Text>

        <Text style={styles.sectionTitle}>2. RUANG LINGKUP (SCOPE OF WORK)</Text>
        <View style={{ marginBottom: 10 }}>
          {sowBullets.length > 0 ? (
            sowBullets.map((bullet, idx) => (
              <View key={idx} style={styles.bulletContainer}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.bulletText}>{bullet.replace(/^- /, '')}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.paragraph}>Belum ada rincian ruang lingkup.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>3. ALAT / TOOLS</Text>
        <Text style={styles.paragraph}>Peralatan yang digunakan antara lain:</Text>
        <View style={{ marginBottom: 10 }}>
          {data.tools.map((tool, idx) => (
            <View key={idx} style={styles.bulletContainer}>
              <Text style={styles.bulletPoint}>•</Text>
              <Text style={styles.bulletText}>{tool}</Text>
            </View>
          ))}
          {data.tools.length === 0 && <Text style={styles.paragraph}>Tidak ada alat spesifik.</Text>}
        </View>

        <Text style={styles.sectionTitle}>4. APD</Text>
        <Text style={styles.paragraph}>Seluruh pekerja wajib menggunakan APD sebagai berikut:</Text>
        <View style={{ marginBottom: 10 }}>
          {data.apd.map((item, idx) => (
            <View key={idx} style={styles.bulletContainer}>
              <Text style={styles.bulletPoint}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
          {data.apd.length === 0 && <Text style={styles.paragraph}>Tidak ada APD spesifik dipilih.</Text>}
        </View>

        <Text style={styles.sectionTitle}>5. PERLENGKAPAN LAINNYA</Text>
        <View style={{ marginBottom: 10 }}>
          {data.perlengkapanLainnya.length > 0 ? (
            data.perlengkapanLainnya.map((item, idx) => (
              <View key={idx} style={styles.bulletContainer}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.paragraph}>Tidak ada perlengkapan lainnya.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>6. TAHAPAN PEKERJAAN</Text>
        {data.tahapanPekerjaan.map((tahapan, idx) => (
          <React.Fragment key={idx}>
            <Text style={styles.subSectionTitle}>6.{idx + 1} {tahapan.title}</Text>
            <View style={{ marginBottom: 10 }}>
              {tahapan.points.length > 0 ? (
                tahapan.points.map((pt, ptIdx) => (
                  <View key={ptIdx} style={styles.subBulletContainer}>
                    <Text style={styles.bulletPoint}>•</Text>
                    <Text style={styles.bulletText}>{pt}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.paragraph, { paddingLeft: 25 }]}>Tidak ada rincian tahapan.</Text>
              )}
            </View>
          </React.Fragment>
        ))}

        <Text style={styles.sectionTitle}>7. PEKERJAAN PENYELESAIAN AKHIR</Text>
        <View style={{ marginBottom: 10 }}>
          {data.penyelesaianAkhir.length > 0 ? (
            data.penyelesaianAkhir.map((item, idx) => (
              <View key={idx} style={styles.bulletContainer}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.paragraph}>Tidak ada rincian pekerjaan penyelesaian akhir.</Text>
          )}
        </View>

      </Page>
    </Document>
  );
};
