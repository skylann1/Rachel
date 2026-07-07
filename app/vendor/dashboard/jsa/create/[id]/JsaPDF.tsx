import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-regular-webfont.ttf' },
    { src: 'https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 'bold' }
  ]
});

const B = '#000';
const GREY = '#e6e6e6';
const fs = 4.5; // base font size

const styles = StyleSheet.create({
  page: {
    padding: 10,
    fontFamily: 'Helvetica',
    fontSize: fs,
    backgroundColor: '#fff'
  },
  titleBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  title: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center'
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
    backgroundColor: '#f9f9f9'
  },
  approvalCol: {
    width: '33.33%',
    padding: 3,
    borderRightWidth: 1,
    borderColor: B
  },
  approvalTitle: {
    fontWeight: 'bold',
    marginBottom: 2,
    textAlign: 'center',
    fontSize: 5.5
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
    backgroundColor: GREY
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
  colParaf:       { width: '5%' },
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
  rpnLow: {
    backgroundColor: '#a7f3d0'
  },
  rpnMod: {
    backgroundColor: '#34d399'
  },
  rpnModHigh: {
    backgroundColor: '#facc15'
  },
  rpnHigh: {
    backgroundColor: '#ef4444'
  }
});

const getRpnStyle = (rpn: number) => {
  if (rpn >= 15) return styles.rpnHigh;
  if (rpn >= 8) return styles.rpnModHigh;
  if (rpn >= 4) return styles.rpnMod;
  return styles.rpnLow;
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
      <View style={{ width: '14.28%', justifyContent: 'center', alignItems: 'center', padding: 1, backgroundColor: '#d1d5db' }}>
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
const RiskBlockData = ({ risk, rpnStyle }: { risk: any; rpnStyle: any }) => (
  <View style={[styles.tCell, styles.colRiskBlock, { padding: 0, flexDirection: 'row' }]}>
    <View style={[styles.colRiskSub, { width: '14.28%' }]}><Text style={styles.textCenter}>{risk?.severity || ''}</Text></View>
    <View style={[styles.colRiskSub, { width: '14.28%' }]}><Text style={styles.textCenter}>{risk?.intensitas || ''}</Text></View>
    <View style={[styles.colRiskSub, { width: '14.28%' }]}><Text style={styles.textCenter}>{risk?.kapabilitas || ''}</Text></View>
    <View style={[styles.colRiskSub, { width: '14.28%' }]}><Text style={styles.textCenter}>{risk?.history || ''}</Text></View>
    <View style={[styles.colRiskSub, { width: '14.28%' }]}><Text style={[styles.bold, styles.textCenter]}>{risk?.total || ''}</Text></View>
    <View style={[styles.colRiskSub, { width: '14.28%' }]}><Text style={[styles.bold, styles.textCenter]}>{risk?.probability || ''}</Text></View>
    <View style={[{ width: '14.28%', justifyContent: 'center', alignItems: 'center', padding: 1 }, rpnStyle]}>
      <Text style={[styles.bold, styles.textCenter]}>{risk?.rpn || ''}</Text>
    </View>
  </View>
);

export default function JsaPDF({ projectId, steps }: any) {
  const currentDate = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        
        {/* Title */}
        <View style={styles.titleBox}>
          <Text style={styles.title}>FORMULIR ANALISA KESELAMATAN KERJA / JOB SAFETY ANALYSIS FORM</Text>
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
          <View style={[styles.infoRight, { borderLeftWidth: 1, borderColor: B, marginLeft: -1 }]}>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Tanggal Pembuatan</Text><Text style={styles.infoValue}>: {currentDate}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Revisi</Text><Text style={styles.infoValue}>: 0</Text></View>
          </View>
        </View>

        {/* Approval Section */}
        <View style={styles.approvalSection}>
          <View style={styles.approvalCol}>
            <Text style={styles.approvalTitle}>Disiapkan Oleh</Text>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Nama</Text><Text style={styles.infoValue}>: Vendor Representative</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Jabatan</Text><Text style={styles.infoValue}>: Site Supervisor</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Perusahaan / Satker</Text><Text style={styles.infoValue}>: CV. Mitra Kerja</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Tanggal</Text><Text style={styles.infoValue}>: {currentDate}</Text></View>
          </View>
          <View style={styles.approvalCol}>
            <Text style={styles.approvalTitle}>Direview Oleh</Text>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Nama</Text><Text style={styles.infoValue}>:</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Jabatan</Text><Text style={styles.infoValue}>:</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Satker Pemberi Kerja</Text><Text style={styles.infoValue}>:</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Tanggal Review</Text><Text style={styles.infoValue}>:</Text></View>
          </View>
          <View style={[styles.approvalCol, { borderRightWidth: 0 }]}>
            <Text style={styles.approvalTitle}>Disetujui Oleh</Text>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Penanggung Jawab</Text><Text style={styles.infoValue}>:</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Nama</Text><Text style={styles.infoValue}>:</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Jabatan</Text><Text style={styles.infoValue}>:</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Satker Penanggung Jawab</Text><Text style={styles.infoValue}>:</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Tanggal Persetujuan</Text><Text style={styles.infoValue}>:</Text></View>
          </View>
        </View>

        {/* ===== MAIN TABLE ===== */}
        <View style={styles.table}>
          
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
          <View style={[styles.tHeaderRow, { backgroundColor: '#f3f3f3' }]}>
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
          <View style={[styles.tRow, { backgroundColor: '#fafafa' }]}>
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

          {/* ===== TABLE BODY ===== */}
          {steps.map((step: any, index: number) => (
            <View key={step.id || index} style={styles.tRow} wrap={false}>
              <View style={[styles.tCell, styles.colNo, styles.textCenter]}><Text>{index + 1}</Text></View>
              <View style={[styles.tCell, styles.colLangkah]}><Text>{step.langkah || ''}</Text></View>
              <View style={[styles.tCell, styles.colJenisBahaya]}><Text>{step.jenisBahaya || ''}</Text></View>
              <View style={[styles.tCell, styles.colSebab]}><Text>{step.sebab || ''}</Text></View>
              <View style={[styles.tCell, styles.colPotensi]}><Text>{step.potensiBahaya || ''}</Text></View>
              <View style={[styles.tCell, styles.colFaktor]}><Text>{step.faktorPositif || ''}</Text></View>

              <RiskBlockData risk={step.inherentRisk} rpnStyle={getRpnStyle(step.inherentRisk?.rpn || 0)} />

              <View style={[styles.tCell, styles.colMitigasi]}><Text>{step.mitigasi || ''}</Text></View>

              <RiskBlockData risk={step.residualRisk} rpnStyle={getRpnStyle(step.residualRisk?.rpn || 0)} />

              <View style={[styles.tCell, styles.colParaf]}><Text></Text></View>
            </View>
          ))}
          
        </View>

        {/* ttd note */}
        <View style={{ alignItems: 'flex-end', marginTop: 3 }}>
          <Text style={{ fontSize: 4, fontStyle: 'italic' }}>ttd</Text>
        </View>

      </Page>
    </Document>
  );
}
