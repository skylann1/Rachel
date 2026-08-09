import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';

// Register fonts
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-regular-webfont.ttf' },
    { src: 'https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 'bold' }
  ]
});

const B = '#000';
// Colors extracted directly from docs/templates/JSA EXAMPLE.xlsx (theme + dxf fills)
const HEADER_BG = '#DCE6F2';   // theme "Accent1, Lighter 80%" - table header / approval title band
const DESC_BG = '#C3D69B';     // theme "Accent3, Lighter 40%" - italic instruction row
const STATIC_GRAY = '#D9D9D9'; // theme "Background 1, Darker 15%" - computed Total/Probability columns
const TITLE_BG = '#C0C0C0';    // indexed color 22 - company name band
const fs = 4.5; // base font size

const styles = StyleSheet.create({
  page: {
    padding: 10,
    fontFamily: 'Helvetica',
    fontSize: fs,
    backgroundColor: '#fff'
  },
  fixedHeader: {
    // Rely on react-pdf native flow layout for fixed elements
    width: '100%'
  },
  titleBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: B,
    marginBottom: 6,
  },
  titleLeft: {
    width: '8%',
    padding: 3,
    borderRightWidth: 1,
    borderColor: B,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleCenter: {
    width: '72%',
    borderRightWidth: 1,
    borderColor: B,
    flexDirection: 'column',
  },
  companyNameRow: {
    backgroundColor: TITLE_BG,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    paddingVertical: 4,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRight: {
    width: '20%',
    padding: 3,
  },
  title: {
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  titleSub: {
    fontSize: 6,
    fontWeight: 'bold',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 1
  },
  companyName: {
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Header info section
  infoSection: {
    flexDirection: 'row',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: B
  },
  infoLeft: {
    width: '60%',
    padding: 3,
    borderRightWidth: 1,
    borderColor: B
  },
  infoRight: {
    width: '40%',
    padding: 3
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 1
  },
  infoLabel: {
    width: '35%',
    fontWeight: 'bold',
    fontSize: 5
  },
  infoValue: {
    width: '65%',
    fontSize: 5
  },
  // Approval Section
  approvalSection: {
    flexDirection: 'row',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: B,
  },
  approvalCol: {
    width: '33.33%',
    borderRightWidth: 1,
    borderColor: B
  },
  approvalTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 5.5,
    backgroundColor: HEADER_BG,
    paddingVertical: 2,
  },
  approvalBody: {
    padding: 3
  },
  signatureBox: {
    borderTopWidth: 1,
    borderColor: B,
    padding: 3,
    alignItems: 'center',
  },
  signatureLabel: {
    fontSize: 4.5,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  signatureArea: {
    height: 26,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#94a3b8',
    borderStyle: 'dashed',
  },
  signatureStamp: {
    fontSize: 7,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#16a34a',
  },
  // Team Penyusun JSA
  teamSection: {
    marginBottom: 6,
    borderWidth: 1,
    borderColor: B,
  },
  teamTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 5.5,
    backgroundColor: HEADER_BG,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderColor: B,
  },
  teamHeaderRow: {
    flexDirection: 'row',
    backgroundColor: HEADER_BG,
  },
  teamRow: {
    flexDirection: 'row',
  },
  teamCellHeader: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: B,
    padding: 2,
    fontWeight: 'bold',
    fontSize: 5,
    textAlign: 'center',
  },
  teamCell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: B,
    padding: 2,
    fontSize: 5,
    minHeight: 14,
    justifyContent: 'center',
  },
  // Main Table
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: B,
    borderBottomWidth: 0,
    borderRightWidth: 0
  },
  tRow: {
    flexDirection: 'row',
  },
  tHeaderRow: {
    flexDirection: 'row',
    backgroundColor: HEADER_BG
  },
  tCellHeader: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: B,
    padding: 1.5,
    fontWeight: 'bold',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center'
  },
  tCell: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: B,
    padding: 1.5
  },
  // Column widths (total = 100%)
  colNo:          { width: '2%' },
  colLangkah:     { width: '10%' },
  colJenisBahaya: { width: '5%' },
  colSebab:       { width: '7%' },
  colPotensi:     { width: '7%' },
  colFaktor:      { width: '10%' },
  colRiskBlock:   { width: '20%' },
  colMitigasi:    { width: '12%' },
  colParaf:       { width: '7%' },
  // Risk sub-columns: 7 sub-cols inside 20%
  // Severity=1, Int=1, Kap=1, His=1, Tot=1, Prob=1, RPN=1 => 7 equal
  colRiskSub:     { width: '14.28%', borderRightWidth: 1, borderColor: B, justifyContent: 'center', alignItems: 'center', padding: 1 },
  colRiskSubLast: { width: '14.28%', justifyContent: 'center', alignItems: 'center', padding: 1 },
  textCenter: {
    textAlign: 'center'
  },
  bold: {
    fontWeight: 'bold'
  },
  italic: {
    fontStyle: 'italic',
    fontSize: 3.5
  },
  staticGray: {
    backgroundColor: STATIC_GRAY
  },
  // RPN conditional-formatting colors, thresholds taken verbatim from the template's cfRules
  rpnGreen: {
    backgroundColor: '#00B050'
  },
  rpnLightGreen: {
    backgroundColor: '#92D050'
  },
  rpnYellow: {
    backgroundColor: '#FFFF00'
  },
  rpnOrange: {
    backgroundColor: '#FFC000'
  },
  rpnRed: {
    backgroundColor: '#FF0000'
  }
});

const getRpnStyle = (rpn: number) => {
  if (rpn >= 15) return styles.rpnRed;
  if (rpn >= 10) return styles.rpnOrange;
  if (rpn >= 5) return styles.rpnYellow;
  if (rpn === 4) return styles.rpnLightGreen;
  if (rpn >= 1) return styles.rpnGreen;
  return {};
};

/* ---- helper: renders one risk-block header (Inherent or Residual) ---- */
const RiskBlockHeader = ({ label, sevNum, intNum, kapNum, hisNum, totNum, probNum, rpnNum }: {
  label: string; sevNum: string; intNum: string; kapNum: string; hisNum: string; totNum: string; probNum: string; rpnNum: string;
}) => (
  <View style={[styles.tCellHeader, styles.colRiskBlock, { padding: 0 }]}>
    {/* Row A: Risk group title */}
    <View style={{ borderBottomWidth: 1, borderColor: B, width: '100%', padding: 1.5, alignItems: 'center' }}>
      <Text style={styles.bold}>{label}</Text>
    </View>
    {/* Row B: Severity + Probability group + Nilai Prob + Nilai RPN */}
    <View style={{ flexDirection: 'row', width: '100%' }}>
      {/* Severity */}
      <View style={[styles.colRiskSub, { width: '14.28%' }]}>
        <Text style={styles.bold}>Severity</Text>
      </View>
      {/* Probability group (4 sub-cols) */}
      <View style={{ width: '57.12%', borderRightWidth: 1, borderColor: B }}>
        <View style={{ borderBottomWidth: 1, borderColor: B, padding: 1, alignItems: 'center' }}>
          <Text style={styles.bold}>Probability</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <View style={[styles.colRiskSub, { width: '25%' }]}><Text>Intensitas</Text></View>
          <View style={[styles.colRiskSub, { width: '25%' }]}><Text>Kapabilitas</Text></View>
          <View style={[styles.colRiskSub, { width: '25%' }]}><Text>History</Text></View>
          <View style={{ width: '25%', justifyContent: 'center', alignItems: 'center', padding: 1 }}><Text>Total</Text></View>
        </View>
      </View>
      {/* Nilai Probability */}
      <View style={[styles.colRiskSub, { width: '14.28%' }]}>
        <Text style={styles.bold}>Nilai{"\n"}Prob-{"\n"}ability</Text>
      </View>
      {/* Nilai RPN */}
      <View style={{ width: '14.28%', justifyContent: 'center', alignItems: 'center', padding: 1, backgroundColor: HEADER_BG }}>
        <Text style={styles.bold}>Nilai{"\n"}RPN</Text>
      </View>
    </View>
  </View>
);

/* ---- helper: column numbers row for one risk block ---- */
const RiskBlockColNums = ({ nums }: { nums: string[] }) => (
  <View style={[styles.tCell, styles.colRiskBlock, { padding: 0, flexDirection: 'row' }]}>
    {nums.map((n, i) => (
      <View key={i} style={i < nums.length - 1
        ? [styles.colRiskSub, { width: '14.28%' }]
        : { width: '14.28%', justifyContent: 'center', alignItems: 'center', padding: 1 }
      }>
        <Text style={styles.textCenter}>({n})</Text>
      </View>
    ))}
  </View>
);

/* ---- helper: description row for one risk block ---- */
const RiskBlockDesc = ({ descs }: { descs: string[] }) => (
  <View style={[styles.tCell, styles.colRiskBlock, { padding: 0, flexDirection: 'row' }]}>
    {descs.map((d, i) => (
      <View key={i} style={i < descs.length - 1
        ? [styles.colRiskSub, { width: '14.28%' }]
        : { width: '14.28%', justifyContent: 'center', alignItems: 'center', padding: 1 }
      }>
        <Text style={styles.italic}>{d}</Text>
      </View>
    ))}
  </View>
);

/* ---- helper: risk block data row ---- */
// Template statically shades the "computed" columns gray: Total + Nilai Probability
// for Inherent Risk, and History + Total + Nilai Probability for Residual Risk.
const RiskBlockData = ({ risk, rpnStyle, variant }: { risk: any; rpnStyle: any; variant: 'inherent' | 'residual' }) => {
  const historyGray = variant === 'residual' ? styles.staticGray : {};
  return (
    <View style={[styles.tCell, styles.colRiskBlock, { padding: 0, flexDirection: 'row' }]}>
      <View style={[styles.colRiskSub, { width: '14.28%' }]}><Text style={styles.textCenter}>{risk?.severity || ''}</Text></View>
      <View style={[styles.colRiskSub, { width: '14.28%' }]}><Text style={styles.textCenter}>{risk?.intensitas || ''}</Text></View>
      <View style={[styles.colRiskSub, { width: '14.28%' }]}><Text style={styles.textCenter}>{risk?.kapabilitas || ''}</Text></View>
      <View style={[styles.colRiskSub, { width: '14.28%' }, historyGray]}><Text style={styles.textCenter}>{risk?.history || ''}</Text></View>
      <View style={[styles.colRiskSub, { width: '14.28%' }, styles.staticGray]}><Text style={[styles.bold, styles.textCenter]}>{risk?.total || ''}</Text></View>
      <View style={[styles.colRiskSub, { width: '14.28%' }, styles.staticGray]}><Text style={[styles.bold, styles.textCenter]}>{risk?.probability || ''}</Text></View>
      <View style={[{ width: '14.28%', justifyContent: 'center', alignItems: 'center', padding: 1 }, rpnStyle]}>
        <Text style={[styles.bold, styles.textCenter]}>{risk?.rpn || ''}</Text>
      </View>
    </View>
  );
};


const renderControlCell = (control: any) => {
  if (typeof control === 'string') {
    return <View style={{ flex: 1, padding: 1.5 }}><Text style={{ fontSize: 3.5 }}>{control}</Text></View>;
  }
  if (!control) return <View style={{ flex: 1 }}></View>;

  const rows = [
    { label: 'Eliminasi', val: control.eliminasi },
    { label: 'Substitusi', val: control.substitusi },
    { label: 'Rekaya Alat', val: control.rekayasa },
    { label: 'Administrasi', val: control.administrasi },
    { label: 'APD', val: control.apd }
  ];

  return (
    <View style={{ width: '100%' }}>
      {rows.map((r, i) => (
        <View key={i} style={{
          flexDirection: 'row',
          borderBottomWidth: i < rows.length - 1 ? 0.5 : 0,
          borderColor: '#000',
        }}>
          <View style={{
            width: '35%',
            borderRightWidth: 0.5,
            borderColor: '#000',
            paddingVertical: 2,
            paddingHorizontal: 1.5,
          }}>
            <Text style={{ fontSize: 3.5 }}>{r.label}</Text>
          </View>
          <View style={{
            width: '65%',
            paddingVertical: 2,
            paddingHorizontal: 1.5,
          }}>
            <Text style={{ fontSize: 3.5 }}>{r.val || ''}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

export default function JsaPDF({ projectId, steps, signatories, preparer, team }: any) {
  const currentDate = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  const reviewer = signatories?.reviewer ?? null;
  const approver = signatories?.approver ?? null;
  const teamRows = (team && team.length > 0) ? team : Array.from({ length: 4 }).map(() => ({ nama: '', jabatan: '' }));

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        
        <View fixed style={styles.fixedHeader}>
          {/* Title Box - 3 columns: Logo | Company+Title | Revisi */}
          <View style={styles.titleBox}>
            <View style={styles.titleLeft}>
              <Image src="/assets/logo/main-logo.png" style={{ width: '90%', objectFit: 'contain' }} />
            </View>
            <View style={styles.titleCenter}>
              <View style={styles.companyNameRow}>
                <Text style={styles.companyName}>CV. JAYA PUTRA BAHARI</Text>
              </View>
              <View style={styles.titleRow}>
                <Text style={styles.title}>FORMULIR ANALISA KESELAMATAN KERJA / JOB SAFETY ANALYSIS FORM</Text>
              </View>
            </View>
            <View style={styles.titleRight}>
              <View style={styles.infoRow}><Text style={{ fontSize: 4.5 }}>No</Text></View>
              <View style={styles.infoRow}><Text style={{ fontSize: 4.5 }}>Revisi</Text></View>
              <View style={styles.infoRow}><Text style={{ fontSize: 4.5, fontWeight: 'bold' }}>Tanggal Pembuatan</Text><Text style={{ fontSize: 4.5 }}>  {currentDate}</Text></View>
            </View>
          </View>
        
        {/* Header Information */}
        <View style={styles.infoSection}>
          <View style={styles.infoLeft}>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>No JSA</Text><Text style={styles.infoValue}>: JSA-{projectId?.split('-')[1] || '001'}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Nama Pekerjaan</Text><Text style={styles.infoValue}>: Pekerjaan Perbaikan (Sesuai Proyek)</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Lokasi</Text><Text style={styles.infoValue}>: Area Proyek</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Nama Paket Pekerjaan</Text><Text style={styles.infoValue}>: Kontrak {projectId}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Nomor Kontrak</Text><Text style={styles.infoValue}>: {projectId}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Tanggal Kontrak</Text><Text style={styles.infoValue}>: {currentDate}</Text></View>
          </View>
        </View>

        {/* Approval Section */}
        <View style={styles.approvalSection}>
          <View style={styles.approvalCol}>
            <Text style={styles.approvalTitle}>Disiapkan Oleh</Text>
            <View style={styles.approvalBody}>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Nama</Text><Text style={styles.infoValue}>: {preparer?.nama || 'Vendor Representative'}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Jabatan</Text><Text style={styles.infoValue}>: {preparer?.jabatan || 'Site Supervisor'}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Perusahaan / Satker</Text><Text style={styles.infoValue}>: {preparer?.satker || '-'}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Tanggal</Text><Text style={styles.infoValue}>: {preparer?.tanggal || currentDate}</Text></View>
            </View>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Tanda Tangan</Text>
              <View style={styles.signatureArea}>
                <Text style={styles.signatureStamp}>Already Sign</Text>
              </View>
            </View>
          </View>
          <View style={styles.approvalCol}>
            <Text style={styles.approvalTitle}>Direview Oleh</Text>
            <View style={styles.approvalBody}>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Nama</Text><Text style={styles.infoValue}>: {reviewer?.nama || ''}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Jabatan</Text><Text style={styles.infoValue}>: {reviewer?.jabatan || ''}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Satker Pemberi Kerja</Text><Text style={styles.infoValue}>: {reviewer?.satker || ''}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Tanggal Review</Text><Text style={styles.infoValue}>: {reviewer?.tanggal || ''}</Text></View>
            </View>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Tanda Tangan</Text>
              <View style={styles.signatureArea}>
                <Text style={styles.signatureStamp}>Already Sign</Text>
              </View>
            </View>
          </View>
          <View style={[styles.approvalCol, { borderRightWidth: 0 }]}>
            <Text style={styles.approvalTitle}>Disetujui Oleh</Text>
            <View style={styles.approvalBody}>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Penanggung Jawab</Text><Text style={styles.infoValue}>: {approver?.satker || ''}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Nama</Text><Text style={styles.infoValue}>: {approver?.nama || ''}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Jabatan</Text><Text style={styles.infoValue}>: {approver?.jabatan || ''}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Satker Penanggung Jawab</Text><Text style={styles.infoValue}>: {approver?.satker || ''}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Tanggal Persetujuan</Text><Text style={styles.infoValue}>: {approver?.tanggal || ''}</Text></View>
            </View>
            <View style={[styles.signatureBox, { borderLeftWidth: 0 }]}>
              <Text style={styles.signatureLabel}>Tanda Tangan</Text>
              <View style={styles.signatureArea}>
                <Text style={styles.signatureStamp}>Already Sign</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ===== MAIN TABLE HEADER ===== */}
        <View style={[styles.table, { borderBottomWidth: 0 }]}>
          
          {/* ===== HEADER ROW 1: Main column labels + Risk group titles ===== */}
          <View style={styles.tHeaderRow}>
            <View style={[styles.tCellHeader, styles.colNo]}><Text>No</Text></View>
            <View style={[styles.tCellHeader, styles.colLangkah]}><Text>Langkah-langkah pekerjaan</Text></View>
            <View style={[styles.tCellHeader, styles.colJenisBahaya]}><Text>Jenis{"\n"}Bahaya</Text></View>
            <View style={[styles.tCellHeader, styles.colSebab]}><Text>Sebab /{"\n"}Sumber</Text></View>
            <View style={[styles.tCellHeader, styles.colPotensi]}><Text>Potensi Bahaya</Text></View>
            <View style={[styles.tCellHeader, styles.colFaktor]}><Text>Faktor Positif{"\n"}(Pengendalian yang ada)</Text></View>
            
            {/* Inherent Risk block header */}
            <RiskBlockHeader label="Inherent Risk" sevNum="6" intNum="7" kapNum="8" hisNum="9" totNum="10" probNum="11" rpnNum="12" />
            
            <View style={[styles.tCellHeader, styles.colMitigasi]}><Text>Pengendalian{"\n"}tambahan /{"\n"}Tindakan{"\n"}Mitigasi</Text></View>
            
            {/* Residual Risk block header */}
            <RiskBlockHeader label="Residual Risk" sevNum="14" intNum="15" kapNum="16" hisNum="17" totNum="18" probNum="19" rpnNum="20" />
            
            <View style={[styles.tCellHeader, styles.colParaf]}><Text>Paraf /{"\n"}Verifikasi</Text></View>
          </View>

          {/* ===== HEADER ROW 2: Column numbers (1) - (21) ===== */}
          <View style={styles.tRow}>
            <View style={[styles.tCell, styles.colNo, styles.textCenter]}><Text>(1)</Text></View>
            <View style={[styles.tCell, styles.colLangkah, styles.textCenter]}><Text>(2)</Text></View>
            <View style={[styles.tCell, styles.colJenisBahaya, styles.textCenter]}><Text>(3)</Text></View>
            <View style={[styles.tCell, styles.colSebab, styles.textCenter]}><Text>(4)</Text></View>
            <View style={[styles.tCell, styles.colPotensi, styles.textCenter]}><Text>(5)</Text></View>
            <View style={[styles.tCell, styles.colFaktor, styles.textCenter]}><Text>(6)</Text></View>
            <RiskBlockColNums nums={['7', '8', '9', '10', '11', '12', '13']} />
            <View style={[styles.tCell, styles.colMitigasi, styles.textCenter]}><Text>(14)</Text></View>
            <RiskBlockColNums nums={['15', '16', '17', '18', '19', '20', '21']} />
            <View style={[styles.tCell, styles.colParaf, styles.textCenter]}><Text>(22)</Text></View>
          </View>

          {/* ===== HEADER ROW 3: Italic descriptions ===== */}
          <View style={[styles.tRow, { backgroundColor: DESC_BG }]}>
            <View style={[styles.tCell, styles.colNo]}><Text style={styles.italic}> </Text></View>
            <View style={[styles.tCell, styles.colLangkah]}><Text style={styles.italic}>Kolom diisi dengan langkah-langkah pekerjaan yang di lakukan</Text></View>
            <View style={[styles.tCell, styles.colJenisBahaya]}><Text style={styles.italic}>Kolom diisi dengan jenis bahaya: Fisika, Kimia, Biologi, Ergonomi, Psikologi</Text></View>
            <View style={[styles.tCell, styles.colSebab]}><Text style={styles.italic}>Kolom diisi dengan sebab/ sumber terjadinya kejadian tak di inginkan</Text></View>
            <View style={[styles.tCell, styles.colPotensi]}><Text style={styles.italic}>Kolom diisi dengan potensi bahaya yang dapat terjadi</Text></View>
            <View style={[styles.tCell, styles.colFaktor]}><Text style={styles.italic}>Kolom diisi dengan pengendalian yang sudah dilakukan untuk mengurangi risiko</Text></View>
            <RiskBlockDesc descs={[
              'Kolom diisi dengan tingkat keparahan',
              'Kolom diisi dengan intensitas paparan bahaya',
              'Kolom diisi dengan kapabilitas pekerja',
              'Kolom diisi dengan riwayat kecelakaan',
              'Jumlah Intensitas + Kapabilitas + History',
              'Tingkat kemungkinan terjadi',
              'Severity x Probability'
            ]} />
            <View style={[styles.tCell, styles.colMitigasi]}><Text style={styles.italic}>Kolom diisi dengan pengendalian tambahan yang akan dilakukan</Text></View>
            <RiskBlockDesc descs={[
              'Kolom diisi setelah mitigasi',
              'Kolom diisi setelah mitigasi',
              'Kolom diisi setelah mitigasi',
              'Kolom diisi setelah mitigasi',
              'Jumlah Intensitas + Kapabilitas + History',
              'Tingkat kemungkinan terjadi',
              'Severity x Probability'
            ]} />
            <View style={[styles.tCell, styles.colParaf]}><Text style={styles.italic}>Tanda tangan penanggung jawab pekerjaan</Text></View>
          </View>
        </View>
      </View>

      {/* ===== TABLE BODY ===== */}
      <View style={[styles.table, { borderTopWidth: 0 }]}>
        {steps.map((step: any, index: number) => (
            <View key={step.id || index} style={styles.tRow} wrap={false}>
              <View style={[styles.tCell, styles.colNo, styles.textCenter]}><Text>{index + 1}</Text></View>
              <View style={[styles.tCell, styles.colLangkah]}><Text>{step.langkah || ''}</Text></View>
              <View style={[styles.tCell, styles.colJenisBahaya]}><Text>{step.jenisBahaya || ''}</Text></View>
              <View style={[styles.tCell, styles.colSebab]}><Text>{step.sebab || ''}</Text></View>
              <View style={[styles.tCell, styles.colPotensi]}><Text>{step.potensiBahaya || ''}</Text></View>
              <View style={[styles.tCell, styles.colFaktor, { padding: 0 }]}>{renderControlCell(step.faktorPositif)}</View>

              <RiskBlockData risk={step.inherentRisk} rpnStyle={getRpnStyle(step.inherentRisk?.rpn || 0)} variant="inherent" />

              <View style={[styles.tCell, styles.colMitigasi, { padding: 0 }]}>{renderControlCell(step.mitigasi)}</View>

              <RiskBlockData risk={step.residualRisk} rpnStyle={getRpnStyle(step.residualRisk?.rpn || 0)} variant="residual" />

              <View style={[styles.tCell, styles.colParaf]}><Text></Text></View>
            </View>
          ))}
          
        </View>

        {/* ttd note */}
        <View style={{ alignItems: 'flex-end', marginTop: 3 }}>
          <Text style={{ fontSize: 4, fontStyle: 'italic' }}>ttd</Text>
        </View>

        {/* Team Penyusun JSA */}
        <View style={[styles.teamSection, { marginTop: 6 }]} wrap={false}>
          <Text style={styles.teamTitle}>Team Penyusun JSA</Text>
          <View style={styles.teamHeaderRow}>
            <View style={[styles.teamCellHeader, { width: '6%' }]}><Text>No</Text></View>
            <View style={[styles.teamCellHeader, { width: '32%' }]}><Text>Nama</Text></View>
            <View style={[styles.teamCellHeader, { width: '32%' }]}><Text>Jabatan</Text></View>
            <View style={[styles.teamCellHeader, { width: '30%', borderRightWidth: 0 }]}><Text>Tanda Tangan</Text></View>
          </View>
          {teamRows.map((member: any, i: number) => (
            <View key={i} style={styles.teamRow}>
              <View style={[styles.teamCell, { width: '6%' }]}><Text style={styles.textCenter}>{i + 1}</Text></View>
              <View style={[styles.teamCell, { width: '32%' }]}><Text>{member?.nama || ''}</Text></View>
              <View style={[styles.teamCell, { width: '32%' }]}><Text>{member?.jabatan || ''}</Text></View>
              <View style={[styles.teamCell, { width: '30%', borderRightWidth: 0, alignItems: 'center' }]}>
                {member?.nama ? <Text style={styles.signatureStamp}>Already Sign</Text> : null}
              </View>
            </View>
          ))}
        </View>

      </Page>
    </Document>
  );
}
