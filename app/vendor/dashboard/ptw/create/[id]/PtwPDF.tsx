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

// Styles for Portrait PTW
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#ffffff'
  },
  headerBox: {
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 20,
    flexDirection: 'row',
  },
  logoBox: {
    width: '20%',
    padding: 10,
    borderRightWidth: 1,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleBox: {
    width: '50%',
    padding: 10,
    borderRightWidth: 1,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center'
  },
  docInfoBox: {
    width: '30%',
    padding: 5,
  },
  docInfoRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  docInfoLabel: {
    width: '40%',
    fontSize: 8,
    fontWeight: 'bold'
  },
  docInfoValue: {
    width: '60%',
    fontSize: 8
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  subTitle: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center'
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#e2e8f0',
    padding: 5,
    borderWidth: 1,
    borderColor: '#000',
    marginTop: 10,
    marginBottom: 5
  },
  rowGroup: {
    flexDirection: 'row',
    marginBottom: 5
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
  },
  value: {
    width: '70%',
    borderBottomWidth: 1,
    borderColor: '#ccc'
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000',
    marginTop: 5,
    marginBottom: 10
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderColor: '#000',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000',
    minHeight: 20,
    alignItems: 'center'
  },
  tableCell: {
    padding: 4,
    borderRightWidth: 1,
    borderColor: '#000',
  },
  tableHeaderText: {
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 9
  },
  cellText: {
    fontSize: 9
  },
  checklist: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#000',
    padding: 10
  },
  checkItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5
  },
  checkBox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: '#000',
    marginRight: 5,
    backgroundColor: '#000' // Simulated check
  },
  signSection: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20
  },
  signBox: {
    alignItems: 'center',
    width: 150
  },
  signTitle: {
    fontWeight: 'bold',
    marginBottom: 40
  },
  signName: {
    textDecoration: 'underline',
    fontWeight: 'bold'
  },
  signRole: {
    marginTop: 2
  }
});

interface PtwPDFProps {
  projectId: string;
  pekerja: any[];
  peralatan: any[];
}

export default function PtwPDF({ projectId, pekerja, peralatan }: PtwPDFProps) {
  const currentDate = new Date().toLocaleDateString('id-ID');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header Document */}
        <View style={styles.headerBox}>
          <View style={styles.logoBox}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0ea5e9' }}>SIPERMIT</Text>
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.title}>PERMIT TO WORK (PTW)</Text>
            <Text style={styles.subTitle}>SURAT IZIN KERJA AMAN</Text>
          </View>
          <View style={styles.docInfoBox}>
            <View style={styles.docInfoRow}>
              <Text style={styles.docInfoLabel}>No PTW</Text>
              <Text style={styles.docInfoValue}>: PTW-{projectId.split('-')[1] || '001'}</Text>
            </View>
            <View style={styles.docInfoRow}>
              <Text style={styles.docInfoLabel}>Tanggal</Text>
              <Text style={styles.docInfoValue}>: {currentDate}</Text>
            </View>
            <View style={styles.docInfoRow}>
              <Text style={styles.docInfoLabel}>Status</Text>
              <Text style={styles.docInfoValue}>: DRAFT PENGAJUAN</Text>
            </View>
          </View>
        </View>

        {/* Bagian A: Informasi Pekerjaan */}
        <Text style={styles.sectionTitle}>BAGIAN A: INFORMASI PEKERJAAN</Text>
        <View style={styles.rowGroup}>
          <Text style={styles.label}>Nama Proyek / Pekerjaan</Text>
          <Text style={styles.value}>: Pekerjaan Perbaikan Pos Security</Text>
        </View>
        <View style={styles.rowGroup}>
          <Text style={styles.label}>Vendor Pelaksana</Text>
          <Text style={styles.value}>: PT. Vendor Konstruksi</Text>
        </View>
        <View style={styles.rowGroup}>
          <Text style={styles.label}>Lokasi Kerja</Text>
          <Text style={styles.value}>: Stasiun Muara Bekasi</Text>
        </View>
        <View style={styles.rowGroup}>
          <Text style={styles.label}>Ref. JSA Terkait</Text>
          <Text style={styles.value}>: JSA-{projectId.split('-')[1] || '001'} (APPROVED)</Text>
        </View>

        {/* Bagian B: Daftar Pekerja */}
        <Text style={styles.sectionTitle}>BAGIAN B: DAFTAR PEKERJA BERTUGAS</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={[styles.tableCell, { width: '10%' }]}><Text style={styles.tableHeaderText}>No</Text></View>
            <View style={[styles.tableCell, { width: '40%' }]}><Text style={styles.tableHeaderText}>Nama Pekerja</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.tableHeaderText}>Jabatan</Text></View>
            <View style={[styles.tableCell, { width: '25%', borderRightWidth: 0 }]}><Text style={styles.tableHeaderText}>Sertifikasi</Text></View>
          </View>
          {pekerja.length === 0 ? (
             <View style={styles.tableRow}>
               <View style={[styles.tableCell, { width: '100%', borderRightWidth: 0, textAlign: 'center' }]}><Text>Belum ada pekerja dipilih</Text></View>
             </View>
          ) : (
             pekerja.map((p, idx) => (
               <View key={p.id} style={styles.tableRow}>
                 <View style={[styles.tableCell, { width: '10%' }]}><Text style={styles.cellText}>{idx + 1}</Text></View>
                 <View style={[styles.tableCell, { width: '40%' }]}><Text style={styles.cellText}>{p.nama} ({p.id})</Text></View>
                 <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellText}>{p.jabatan}</Text></View>
                 <View style={[styles.tableCell, { width: '25%', borderRightWidth: 0 }]}><Text style={styles.cellText}>{p.sertifikat}</Text></View>
               </View>
             ))
          )}
        </View>

        {/* Bagian C: Daftar Peralatan */}
        <Text style={styles.sectionTitle}>BAGIAN C: DAFTAR PERALATAN & MESIN</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={[styles.tableCell, { width: '10%' }]}><Text style={styles.tableHeaderText}>No</Text></View>
            <View style={[styles.tableCell, { width: '40%' }]}><Text style={styles.tableHeaderText}>Nama Peralatan</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.tableHeaderText}>Jenis</Text></View>
            <View style={[styles.tableCell, { width: '25%', borderRightWidth: 0 }]}><Text style={styles.tableHeaderText}>No. SILO/SIA</Text></View>
          </View>
          {peralatan.length === 0 ? (
             <View style={styles.tableRow}>
               <View style={[styles.tableCell, { width: '100%', borderRightWidth: 0, textAlign: 'center' }]}><Text>Belum ada peralatan dipilih</Text></View>
             </View>
          ) : (
             peralatan.map((p, idx) => (
               <View key={p.id} style={styles.tableRow}>
                 <View style={[styles.tableCell, { width: '10%' }]}><Text style={styles.cellText}>{idx + 1}</Text></View>
                 <View style={[styles.tableCell, { width: '40%' }]}><Text style={styles.cellText}>{p.nama} ({p.id})</Text></View>
                 <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellText}>{p.jenis}</Text></View>
                 <View style={[styles.tableCell, { width: '25%', borderRightWidth: 0 }]}><Text style={styles.cellText}>{p.silo}</Text></View>
               </View>
             ))
          )}
        </View>

        {/* Bagian D: Checklist Keselamatan */}
        <Text style={styles.sectionTitle}>BAGIAN D: PERSIAPAN & KESELAMATAN (Diverifikasi)</Text>
        <View style={styles.checklist}>
           <View style={styles.checkItem}><View style={styles.checkBox}></View><Text>Prosedur disetujui</Text></View>
           <View style={styles.checkItem}><View style={styles.checkBox}></View><Text>JSA telah disetujui</Text></View>
           <View style={styles.checkItem}><View style={styles.checkBox}></View><Text>Pekerja memiliki kompetensi (KTP/Sertifikat)</Text></View>
           <View style={styles.checkItem}><View style={styles.checkBox}></View><Text>Alat laik pakai (SILO/SIA aktif)</Text></View>
           <View style={styles.checkItem}><View style={styles.checkBox}></View><Text>Alat Pelindung Diri (APD) Lengkap</Text></View>
           <View style={styles.checkItem}><View style={styles.checkBox}></View><Text>Area kerja telah disterilkan</Text></View>
        </View>

        {/* Signatures */}
        <View style={styles.signSection}>
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>Pemohon (Vendor),</Text>
            <Text style={styles.signName}>Nama Pemohon</Text>
            <Text style={styles.signRole}>Project Supervisor</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>Validasi K3,</Text>
            <Text style={styles.signName}>__________________</Text>
            <Text style={styles.signRole}>HSE Officer PGN</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>Otorisasi PTW,</Text>
            <Text style={styles.signName}>__________________</Text>
            <Text style={styles.signRole}>Project Manager PGN</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
