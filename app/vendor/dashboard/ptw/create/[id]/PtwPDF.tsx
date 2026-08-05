import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { PTW_TYPES, HAZARD_SOURCES, APD_ITEMS, PtwType } from '@/lib/ptw-types';

// Register fonts
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-regular-webfont.ttf' },
    { src: 'https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 'bold' }
  ]
});

const B = '#000';
const SECTION_BG = '#f1f5f9'; // Neutral light grey for subheaders
const fs = 5; // Base font size optimized for dense Excel look
const fs_title = 10;
const fs_subtitle = 8;
const fs_header = 6;

const styles = StyleSheet.create({
  page: {
    padding: 10,
    fontFamily: 'Helvetica',
    fontSize: fs,
    backgroundColor: '#fff',
    flexDirection: 'column',
  },
  
  // Top Header (Dynamic color)
  topHeader: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: B,
    marginBottom: 6,
    height: 40,
    alignItems: 'stretch',
  },
  topHeaderLogo: {
    width: '18%',
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderColor: B,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderCenter: {
    width: '82%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: fs_title, fontWeight: 'bold' },
  headerSubtitle: { fontSize: fs_subtitle, fontWeight: 'bold' },
  headerRegion: { fontSize: fs },

  // Main 2-column layout
  mainColumns: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  leftColumn: { width: '42%', flexDirection: 'column', gap: 4 },
  rightColumn: { width: '58%', flexDirection: 'column' },

  // Section styling
  sectionBox: { borderWidth: 1, borderColor: B },
  sectionHeader: {
    backgroundColor: SECTION_BG,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: B,
    fontWeight: 'bold',
    fontSize: fs_header,
  },
  
  // A. UMUM
  umumRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: B, minHeight: 12, alignItems: 'center' },
  umumLabel: { width: '32%', paddingLeft: 4, fontWeight: 'bold' },
  umumVal: { width: '68%', borderLeftWidth: 1, borderColor: B, paddingLeft: 4, height: '100%', justifyContent: 'center' },

  // Checkbox items
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 2 },
  checkItem: { width: '33.33%', flexDirection: 'row', alignItems: 'center', paddingVertical: 1, paddingHorizontal: 2 },
  checkItemD: { width: '50%', flexDirection: 'row', alignItems: 'center', paddingVertical: 1, paddingHorizontal: 2 },
  checkBoxEmpty: { width: 4, height: 4, borderWidth: 1, borderColor: B, marginRight: 3 },
  checkBoxFilled: { width: 4, height: 4, borderWidth: 1, borderColor: B, backgroundColor: B, marginRight: 3 },

  // C. APD Category Group
  apdCatCol: { width: '33.33%', padding: 2 },
  apdCatTitle: { fontWeight: 'bold', marginBottom: 2, fontSize: fs },

  // D. Dokumen Pendukung
  docContainer: { flexDirection: 'row', padding: 2 },
  docCol: { flex: 1 },
  docColTitle: { fontWeight: 'bold', marginBottom: 2 },

  // E. SAFETY CHECKLIST
  tHeaderRow: { flexDirection: 'row', backgroundColor: SECTION_BG, borderBottomWidth: 1, borderColor: B, alignItems: 'stretch' },
  tRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: B },
  tCell: { paddingVertical: 1, paddingHorizontal: 2, borderRightWidth: 1, borderColor: B, justifyContent: 'center' },
  
  // Verifikasi (End of checklist)
  verifRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: B },
  verifLabel: { width: '30%', borderRightWidth: 1, borderColor: B, padding: 2, alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' },
  verifContent: { width: '70%', flexDirection: 'column' },
  verifSubRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: B, minHeight: 10 },
  verifSubLabel: { width: '30%', borderRightWidth: 1, borderColor: B, padding: 2 },
  verifSubVal: { width: '70%', padding: 2 },

  // Footer 2-column layout
  footerColumns: { flexDirection: 'row', gap: 4 },
  footerLeft: { width: '42%', borderWidth: 1, borderColor: B },
  footerRight: { width: '58%', flexDirection: 'column', gap: 4 },
  footerBox: { borderWidth: 1, borderColor: B },

  // Signatures
  disclaimer: { fontSize: 4, padding: 2, borderBottomWidth: 1, borderColor: B },
  signRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: B },
  signCell: { flex: 1, borderRightWidth: 1, borderColor: B },
  signLabel: { textAlign: 'center', fontWeight: 'bold', borderBottomWidth: 1, borderColor: B, paddingBottom: 2, paddingTop: 2 },
  signNameRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: B, minHeight: 10, alignItems: 'center' },
  signNameLabel: { width: '30%', borderRightWidth: 1, borderColor: B, padding: 1 },
  signNameVal: { width: '70%', padding: 1 },

  // Dihentikan / Penyelesaian Tables
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: B, minHeight: 14, alignItems: 'center' },
  tableCell: { flex: 1, borderRightWidth: 1, borderColor: B, padding: 2, alignItems: 'center', justifyContent: 'center' }
});

interface PtwPDFProps {
  projectId: string;
  ptwType: PtwType;
  hazards: string[];
  apd: { [key: string]: string[] };
  pekerja: any[];
  peralatan: any[];
}

export default function PtwPDF({ projectId, ptwType, hazards, apd, pekerja, peralatan }: PtwPDFProps) {
  const currentDate = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  const typeDef = PTW_TYPES.find(t => t.id === ptwType) || PTW_TYPES[0];

  const renderCheckList = (items: string[], selected: string[], itemStyle: any = styles.checkItem) => {
    return items.map((item, i) => (
      <View key={i} style={itemStyle}>
        <View style={selected.includes(item) ? styles.checkBoxFilled : styles.checkBoxEmpty} />
        <Text style={{ flex: 1, fontSize: fs }}>{item}</Text>
      </View>
    ));
  };

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        
        {/* TOP HEADER */}
        <View style={[styles.topHeader, { backgroundColor: typeDef.color }]}>
          <View style={styles.topHeaderLogo}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: typeDef.color }}>LOGO PERUSAHAAN</Text>
          </View>
          <View style={styles.topHeaderCenter}>
            <Text style={[styles.headerTitle, { color: typeDef.textColor }]}>{typeDef.title.toUpperCase()}</Text>
            <Text style={[styles.headerSubtitle, { color: typeDef.textColor }]}>PT PERUSAHAAN GAS NEGARA Tbk</Text>
            <Text style={[styles.headerRegion, { color: typeDef.textColor }]}>[wilayah]</Text>
          </View>
        </View>

        {/* MAIN BODY: 2 COLUMNS */}
        <View style={styles.mainColumns}>
          
          {/* LEFT COLUMN: A, B, C, D */}
          <View style={styles.leftColumn}>
            
            {/* A. UMUM */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeader}>A. UMUM</Text>
              <View style={styles.umumRow}>
                <Text style={styles.umumLabel}>Nomor</Text>
                <Text style={styles.umumVal}>: PTW-{projectId.split('-')[1] || '001'}</Text>
              </View>
              <View style={styles.umumRow}>
                <Text style={styles.umumLabel}>Tanggal pengesahan</Text>
                <Text style={styles.umumVal}>: {currentDate}</Text>
              </View>
              <View style={styles.umumRow}>
                <Text style={styles.umumLabel}>Masa Berlaku</Text>
                <View style={[styles.umumVal, { flexDirection: 'row', paddingLeft: 0, borderLeftWidth: 0 }]}>
                  <View style={{ flex: 1, borderLeftWidth: 1, borderColor: B, paddingLeft: 4, justifyContent: 'center' }}>
                     <Text>Tanggal: {currentDate} s/d {currentDate}</Text>
                  </View>
                  <View style={{ flex: 1, borderLeftWidth: 1, borderColor: B, paddingLeft: 4, justifyContent: 'center' }}>
                     <Text>Waktu: 08:00 s/d 17:00</Text>
                  </View>
                </View>
              </View>
              <View style={styles.umumRow}>
                <Text style={styles.umumLabel}>Lokasi Pekerjaan</Text>
                <Text style={styles.umumVal}>: Area Proyek {projectId}</Text>
              </View>
              <View style={styles.umumRow}>
                <Text style={styles.umumLabel}>Pelaksana Pekerjaan</Text>
                <Text style={styles.umumVal}>: Vendor Terdaftar</Text>
              </View>
              <View style={[styles.umumRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.umumLabel}>Uraian Pekerjaan</Text>
                <Text style={styles.umumVal}>: Pemeliharaan dan Perbaikan</Text>
              </View>
            </View>

            {/* B. IDENTIFIKASI SUMBER BAHAYA */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeader}>B. IDENTIFIKASI SUMBER BAHAYA ALAT/KEGIATAN</Text>
              <View style={styles.gridContainer}>
                {renderCheckList(HAZARD_SOURCES.slice(0, 15), hazards)}
              </View>
            </View>

            {/* C. ALAT PELINDUNG DIRI */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeader}>C. ALAT PELINDUNG DIRI</Text>
              <View style={[styles.gridContainer, { flexDirection: 'row' }]}>
                {Object.entries(APD_ITEMS).map(([cat, items], idx) => (
                  <View key={cat} style={styles.apdCatCol}>
                    <Text style={styles.apdCatTitle}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                    {items.map(item => (
                      <View key={item} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 1 }}>
                        <View style={apd[cat]?.includes(item) ? styles.checkBoxFilled : styles.checkBoxEmpty} />
                        <Text style={{ fontSize: fs }}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </View>

            {/* D. DOKUMEN PENDUKUNG */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeader}>D. DOKUMEN PENDUKUNG DAN LAMPIRAN</Text>
              <View style={styles.docContainer}>
                <View style={styles.docCol}>
                   <Text style={styles.docColTitle}>Permit To Work Lainnya :</Text>
                   {renderCheckList(['PTW Memasuki Ruang Terbatas No.....', 'PTW Radiografi No.....', 'PTW Listrik No.....'], [], { width: '100%', flexDirection: 'row', paddingVertical: 1 })}
                </View>
                <View style={styles.docCol}>
                   <Text style={styles.docColTitle}>Dokumen Pendukung :</Text>
                   {renderCheckList(['Job Safety Analysis', 'Jadwal Pelaksanaan Pekerjaan', 'Daftar Identitas dan Sertifikat Pekerja', 'Daftar APD, Peralatan Kerja'], ['Job Safety Analysis', 'Jadwal Pelaksanaan Pekerjaan'], { width: '100%', flexDirection: 'row', paddingVertical: 1 })}
                </View>
              </View>
            </View>

          </View>

          {/* RIGHT COLUMN: E */}
          <View style={styles.rightColumn}>
            <View style={[styles.sectionBox, { flex: 1 }]}>
              <Text style={styles.sectionHeader}>E. SAFETY CHECKLIST</Text>
              
              {/* Table Header */}
              <View style={styles.tHeaderRow}>
                <View style={[styles.tCell, { width: '4%' }]}><Text style={{ textAlign: 'center' }}>No</Text></View>
                <View style={[styles.tCell, { width: '31%' }]}><Text style={{ textAlign: 'center' }}>Item</Text></View>
                {['Hari ke-1', 'Hari ke-2', 'Hari ke-3', 'Hari ke-4', 'Hari ke-5', 'Hari ke-6', 'Hari ke-7'].map((d, i) => (
                  <View key={i} style={[styles.tCell, { width: '8%', padding: 0 }]}>
                    <Text style={{ textAlign: 'center', borderBottomWidth: 1, borderColor: B, paddingVertical: 1, fontSize: 4 }}>{d}</Text>
                    <View style={{ flexDirection: 'row', flex: 1 }}>
                      <View style={{ flex: 1, borderRightWidth: 1, borderColor: B, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 3 }}>Sudah</Text></View>
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 3 }}>Belum</Text></View>
                    </View>
                  </View>
                ))}
                <View style={[styles.tCell, { width: '9%', borderRightWidth: 0 }]}><Text style={{ textAlign: 'center', fontSize: 4 }}>Keterangan</Text></View>
              </View>

              {/* Table Body */}
              {typeDef.checklist.map((item, index) => (
                <View key={item.id} style={styles.tRow}>
                  <View style={[styles.tCell, { width: '4%', alignItems: 'center' }]}><Text>{String.fromCharCode(97 + index)}.</Text></View>
                  <View style={[styles.tCell, { width: '31%' }]}><Text style={{ fontSize: 4.5 }}>{item.label}</Text></View>
                  {[1,2,3,4,5,6,7].map((d) => (
                    <View key={d} style={[styles.tCell, { width: '8%', padding: 0, flexDirection: 'row' }]}>
                      <View style={{ flex: 1, borderRightWidth: 1, borderColor: B }}></View>
                      <View style={{ flex: 1 }}></View>
                    </View>
                  ))}
                  <View style={[styles.tCell, { width: '9%', borderRightWidth: 0 }]}><Text></Text></View>
                </View>
              ))}

              {/* Verifikasi Section */}
              <View style={[styles.verifRow, { marginTop: 'auto' }]}>
                <View style={styles.verifLabel}><Text>Verifikasi</Text></View>
                <View style={styles.verifContent}>
                  <View style={styles.verifSubRow}><Text style={styles.verifSubLabel}>Tanggal (DD/MM)</Text><Text style={styles.verifSubVal}></Text></View>
                  <View style={styles.verifSubRow}><Text style={styles.verifSubLabel}>Waktu</Text><Text style={styles.verifSubVal}></Text></View>
                  <View style={styles.verifSubRow}>
                    <Text style={styles.verifSubLabel}>Pemegang PTW</Text>
                    <View style={[styles.verifSubVal, { flexDirection: 'column', padding: 0 }]}>
                      <View style={{ flex: 1, borderBottomWidth: 1, borderColor: B, flexDirection: 'row' }}><Text style={{ width: '30%', borderRightWidth: 1, borderColor: B, padding: 1 }}>Nama Inisial</Text><Text></Text></View>
                      <View style={{ flex: 1, flexDirection: 'row' }}><Text style={{ width: '30%', borderRightWidth: 1, borderColor: B, padding: 1 }}>Paraf</Text><Text></Text></View>
                    </View>
                  </View>
                  <View style={[styles.verifSubRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.verifSubLabel}>Pengawas / Penerbit PTW</Text>
                    <View style={[styles.verifSubVal, { flexDirection: 'column', padding: 0 }]}>
                      <View style={{ flex: 1, borderBottomWidth: 1, borderColor: B, flexDirection: 'row' }}><Text style={{ width: '30%', borderRightWidth: 1, borderColor: B, padding: 1 }}>Nama Inisial</Text><Text></Text></View>
                      <View style={{ flex: 1, flexDirection: 'row' }}><Text style={{ width: '30%', borderRightWidth: 1, borderColor: B, padding: 1 }}>Paraf</Text><Text></Text></View>
                    </View>
                  </View>
                </View>
              </View>

            </View>
          </View>

        </View>

        {/* FOOTER: 2 COLUMNS */}
        <View style={styles.footerColumns}>
          
          {/* Footer Left: PENGESAHAN */}
          <View style={styles.footerLeft}>
            <Text style={styles.sectionHeader}>PENGESAHAN DAN PERSETUJUAN PERMIT TO WORK</Text>
            <Text style={styles.disclaimer}>Saya memahami semua tindakan pencegahan dan akan memastikan pelaksanaan mitigasi sesuai dengan dokumen izin kerja yang ada.</Text>
            
            <View style={styles.signRow}>
              <View style={styles.signCell}>
                <Text style={styles.signLabel}>Pemohon Permit To Work</Text>
                <View style={[styles.signNameRow, { borderTopWidth: 0 }]}><Text style={styles.signNameLabel}>Nama</Text><Text style={styles.signNameVal}></Text></View>
                <View style={styles.signNameRow}><Text style={styles.signNameLabel}>Jabatan</Text><Text style={styles.signNameVal}></Text></View>
                <View style={[styles.signNameRow, { height: 18 }]}><Text style={styles.signNameLabel}>Tanda Tangan</Text><Text style={styles.signNameVal}></Text></View>
                <View style={styles.signNameRow}><Text style={styles.signNameLabel}>Tanggal</Text><Text style={styles.signNameVal}></Text></View>
              </View>
              <View style={[styles.signCell, { borderRightWidth: 0 }]}>
                <Text style={[styles.signLabel, { color: 'red' }]}>*Pemegang Permit To Work</Text>
                <View style={[styles.signNameRow, { borderTopWidth: 0 }]}><Text style={[styles.signNameLabel, { color: 'red' }]}>Nama</Text><Text style={styles.signNameVal}></Text></View>
                <View style={styles.signNameRow}><Text style={[styles.signNameLabel, { color: 'red' }]}>Jabatan</Text><Text style={styles.signNameVal}></Text></View>
                <View style={[styles.signNameRow, { height: 18 }]}><Text style={[styles.signNameLabel, { color: 'red' }]}>Tanda Tangan</Text><Text style={styles.signNameVal}></Text></View>
                <View style={styles.signNameRow}><Text style={[styles.signNameLabel, { color: 'red' }]}>Tanggal</Text><Text style={styles.signNameVal}></Text></View>
              </View>
            </View>

            <Text style={styles.disclaimer}>Saya sendiri telah memeriksa lokasi dan keadaannya, ijin ini menjamin untuk pekerjaan pada saat beroperasi.</Text>

            <View style={[styles.signRow, { borderBottomWidth: 0 }]}>
              <View style={styles.signCell}>
                <Text style={styles.signLabel}>Pemberi Permit To Work</Text>
                <View style={[styles.signNameRow, { borderTopWidth: 0 }]}><Text style={styles.signNameLabel}>Nama</Text><Text style={styles.signNameVal}></Text></View>
                <View style={styles.signNameRow}><Text style={styles.signNameLabel}>Jabatan</Text><Text style={styles.signNameVal}></Text></View>
                <View style={[styles.signNameRow, { height: 18 }]}><Text style={styles.signNameLabel}>Tanda Tangan</Text><Text style={styles.signNameVal}></Text></View>
                <View style={styles.signNameRow}><Text style={styles.signNameLabel}>Tanggal</Text><Text style={styles.signNameVal}></Text></View>
              </View>
              <View style={[styles.signCell, { borderRightWidth: 0 }]}>
                <Text style={styles.signLabel}>Penerbit Permit To Work</Text>
                <View style={[styles.signNameRow, { borderTopWidth: 0 }]}><Text style={styles.signNameLabel}>Nama</Text><Text style={styles.signNameVal}></Text></View>
                <View style={styles.signNameRow}><Text style={styles.signNameLabel}>Jabatan</Text><Text style={styles.signNameVal}></Text></View>
                <View style={[styles.signNameRow, { height: 18 }]}><Text style={styles.signNameLabel}>Tanda Tangan</Text><Text style={styles.signNameVal}></Text></View>
                <View style={styles.signNameRow}><Text style={styles.signNameLabel}>Tanggal</Text><Text style={styles.signNameVal}></Text></View>
              </View>
            </View>
          </View>

          {/* Footer Right: DIHENTIKAN & PENYELESAIAN */}
          <View style={styles.footerRight}>
            
            <View style={styles.footerBox}>
              <Text style={styles.sectionHeader}>DIHENTIKAN SEMENTARA</Text>
              <View style={{ padding: 4 }}>
                <Text style={{ marginBottom: 4 }}>Saya menyatakan, saya menghentikan pekerjaan di PTW ini dan saya telah menginformasikan kepada penerbit PTW / wewenang operasi dengan ALASAN :</Text>
                <Text style={{ marginBottom: 12 }}>................................................................................................................................................................</Text>
                
                <View style={styles.tableRow}>
                   <View style={[styles.tableCell, { borderLeftWidth: 1 }]}><Text>Tanggal</Text></View>
                   <View style={styles.tableCell}><Text>Waktu</Text></View>
                   <View style={styles.tableCell}><Text>Nama</Text></View>
                   <View style={styles.tableCell}><Text>Tanda Tangan</Text></View>
                   <View style={styles.tableCell}><Text>Tanggal</Text></View>
                   <View style={styles.tableCell}><Text>Waktu</Text></View>
                   <View style={styles.tableCell}><Text>Nama</Text></View>
                   <View style={styles.tableCell}><Text>Tanda Tangan</Text></View>
                </View>
                <View style={[styles.tableRow, { height: 20, borderBottomWidth: 1 }]}>
                   <View style={[styles.tableCell, { borderLeftWidth: 1 }]}><Text></Text></View>
                   <View style={styles.tableCell}><Text></Text></View>
                   <View style={styles.tableCell}><Text></Text></View>
                   <View style={styles.tableCell}><Text></Text></View>
                   <View style={styles.tableCell}><Text></Text></View>
                   <View style={styles.tableCell}><Text></Text></View>
                   <View style={styles.tableCell}><Text></Text></View>
                   <View style={styles.tableCell}><Text></Text></View>
                </View>

              </View>
            </View>

            <View style={[styles.footerBox, { flex: 1 }]}>
              <Text style={styles.sectionHeader}>PENYELESAIAN PERMIT TO WORK</Text>
              <View style={{ padding: 4 }}>
                <Text style={{ marginBottom: 6 }}>Kami yang bertandatangan di bawah ini menyatakan bahwa pekerjaan yang tercantum pada PTW ini :</Text>
                
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ width: '40%' }}>
                     <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 }}><View style={styles.checkBoxEmpty}/><Text style={{ flex: 1, lineHeight: 1.2 }}>Selesai dan diperiksa, lokasi kerja ditinggalkan dalam keadaan aman.</Text></View>
                     <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 }}><View style={styles.checkBoxEmpty}/><Text style={{ flex: 1, lineHeight: 1.2 }}>Tidak teralisasikan dan secara tegas dihentikan.</Text></View>
                     <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 }}><View style={styles.checkBoxEmpty}/><Text style={{ flex: 1, lineHeight: 1.2 }}>Belum selesai dan akan dilanjutkan pada PTW No. .................</Text></View>
                  </View>
                  <View style={{ width: '60%', paddingLeft: 10 }}>
                      <View style={styles.tableRow}>
                         <View style={[styles.tableCell, { borderLeftWidth: 1 }]}><Text>Tanggal</Text></View>
                         <View style={styles.tableCell}><Text>Waktu</Text></View>
                         <View style={styles.tableCell}><Text>Nama</Text></View>
                         <View style={styles.tableCell}><Text>Tanda Tangan</Text></View>
                      </View>
                      <View style={[styles.tableRow, { height: 20, borderBottomWidth: 1 }]}>
                         <View style={[styles.tableCell, { borderLeftWidth: 1 }]}><Text></Text></View>
                         <View style={styles.tableCell}><Text></Text></View>
                         <View style={styles.tableCell}><Text></Text></View>
                         <View style={styles.tableCell}><Text></Text></View>
                      </View>
                  </View>
                </View>
                
              </View>
            </View>

          </View>

        </View>

      </Page>
    </Document>
  );
}
