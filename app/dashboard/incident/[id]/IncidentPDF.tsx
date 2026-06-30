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

// Styles for Portrait Investigation Report
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
    fontSize: 14,
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
    borderColor: '#ccc',
    paddingBottom: 2
  },
  multilineBox: {
    borderWidth: 1,
    borderColor: '#000',
    padding: 8,
    minHeight: 50,
    marginBottom: 10
  },
  signSection: {
    marginTop: 30,
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

interface IncidentPDFProps {
  incidentId: string;
  investigation: {
    akarMasalah: string;
    tindakanPerbaikan: string;
    tindakanPencegahan: string;
    status: string;
  };
}

export default function IncidentPDF({ incidentId, investigation }: IncidentPDFProps) {
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
            <Text style={styles.title}>LAPORAN INVESTIGASI INSIDEN K3</Text>
            <Text style={styles.subTitle}>(INCIDENT INVESTIGATION REPORT)</Text>
          </View>
          <View style={styles.docInfoBox}>
            <View style={styles.docInfoRow}>
              <Text style={styles.docInfoLabel}>No Laporan</Text>
              <Text style={styles.docInfoValue}>: {incidentId}</Text>
            </View>
            <View style={styles.docInfoRow}>
              <Text style={styles.docInfoLabel}>Tgl Cetak</Text>
              <Text style={styles.docInfoValue}>: {currentDate}</Text>
            </View>
            <View style={styles.docInfoRow}>
              <Text style={styles.docInfoLabel}>Status</Text>
              <Text style={styles.docInfoValue}>: {investigation.status === 'Investigasi Selesai' ? 'FINAL' : 'DRAFT'}</Text>
            </View>
          </View>
        </View>

        {/* Bagian A: Informasi Kejadian */}
        <Text style={styles.sectionTitle}>BAGIAN A: INFORMASI AWAL KEJADIAN</Text>
        <View style={styles.rowGroup}>
          <Text style={styles.label}>Vendor Pelapor</Text>
          <Text style={styles.value}>: PT. Vendor Konstruksi</Text>
        </View>
        <View style={styles.rowGroup}>
          <Text style={styles.label}>Klasifikasi Insiden</Text>
          <Text style={styles.value}>: Near Miss (Hampir Celaka)</Text>
        </View>
        <View style={styles.rowGroup}>
          <Text style={styles.label}>Waktu & Lokasi</Text>
          <Text style={styles.value}>: 28 Juni 2026 10:15 WIB | Area Boiler 1</Text>
        </View>
        <View style={{ marginTop: 10, marginBottom: 5 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>Kronologi Awal:</Text>
          <View style={styles.multilineBox}>
            <Text>"Pekerja sedang berjalan di area Boiler 1 dan nyaris tertimpa pipa scaffolding yang tergelincir dari lantai 2. Tidak ada korban jiwa maupun luka, namun pekerja kaget dan pekerjaan langsung dihentikan."</Text>
          </View>
        </View>

        {/* Bagian B: Hasil Investigasi (RCA) */}
        <Text style={styles.sectionTitle}>BAGIAN B: HASIL INVESTIGASI (HSE PGN)</Text>
        
        <View style={{ marginBottom: 5 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>1. Akar Masalah (Root Cause):</Text>
          <View style={styles.multilineBox}>
            <Text>{investigation.akarMasalah || '(Belum diisi)'}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 5 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>2. Tindakan Perbaikan (Corrective Action):</Text>
          <View style={styles.multilineBox}>
            <Text>{investigation.tindakanPerbaikan || '(Belum diisi)'}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 5 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>3. Tindakan Pencegahan (Preventive Action):</Text>
          <View style={styles.multilineBox}>
            <Text>{investigation.tindakanPencegahan || '(Belum diisi)'}</Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.signSection}>
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>Dilaporkan Oleh,</Text>
            <Text style={styles.signName}>SPV Vendor</Text>
            <Text style={styles.signRole}>PT. Vendor Konstruksi</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>Diinvestigasi Oleh,</Text>
            <Text style={styles.signName}>__________________</Text>
            <Text style={styles.signRole}>HSE Officer PGN</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>Mengetahui,</Text>
            <Text style={styles.signName}>__________________</Text>
            <Text style={styles.signRole}>Project Manager PGN</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
