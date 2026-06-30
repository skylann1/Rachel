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

// Styles for Landscape JSA
const styles = StyleSheet.create({
  page: {
    padding: 30,
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
    width: '60%',
    padding: 10,
    borderRightWidth: 1,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center'
  },
  docInfoBox: {
    width: '20%',
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
  projectInfoBox: {
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#000',
    padding: 8
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  infoItem: {
    width: '50%',
    flexDirection: 'row',
    marginBottom: 6
  },
  infoLabel: {
    width: '30%',
    fontWeight: 'bold'
  },
  infoText: {
    width: '70%'
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000',
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
    minHeight: 30,
  },
  colNo: {
    width: '5%',
    padding: 5,
    borderRightWidth: 1,
    borderColor: '#000',
    textAlign: 'center'
  },
  colLangkah: {
    width: '30%',
    padding: 5,
    borderRightWidth: 1,
    borderColor: '#000',
  },
  colBahaya: {
    width: '30%',
    padding: 5,
    borderRightWidth: 1,
    borderColor: '#000',
  },
  colMitigasi: {
    width: '35%',
    padding: 5,
  },
  tableHeaderText: {
    fontWeight: 'bold',
    textAlign: 'center'
  },
  signSection: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 50
  },
  signBox: {
    alignItems: 'center',
    width: 150
  },
  signTitle: {
    fontWeight: 'bold',
    marginBottom: 50
  },
  signName: {
    textDecoration: 'underline',
    fontWeight: 'bold'
  },
  signRole: {
    marginTop: 2
  }
});

interface JsaStep {
  id: number;
  langkah: string;
  bahaya: string;
  mitigasi: string;
}

interface JsaPDFProps {
  projectId: string;
  steps: JsaStep[];
}

export default function JsaPDF({ projectId, steps }: JsaPDFProps) {
  const currentDate = new Date().toLocaleDateString('id-ID');

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        
        {/* Header Document */}
        <View style={styles.headerBox}>
          <View style={styles.logoBox}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0ea5e9' }}>SIPERMIT</Text>
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.title}>JOB SAFETY ANALYSIS (JSA)</Text>
            <Text style={styles.subTitle}>& HAZARD IDENTIFICATION RISK ASSESSMENT</Text>
          </View>
          <View style={styles.docInfoBox}>
            <View style={styles.docInfoRow}>
              <Text style={styles.docInfoLabel}>No Dok.</Text>
              <Text style={styles.docInfoValue}>: JSA-{projectId.split('-')[1] || '001'}</Text>
            </View>
            <View style={styles.docInfoRow}>
              <Text style={styles.docInfoLabel}>Revisi</Text>
              <Text style={styles.docInfoValue}>: 0</Text>
            </View>
            <View style={styles.docInfoRow}>
              <Text style={styles.docInfoLabel}>Tanggal</Text>
              <Text style={styles.docInfoValue}>: {currentDate}</Text>
            </View>
          </View>
        </View>

        {/* Project Info */}
        <View style={styles.projectInfoBox}>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Nama Proyek</Text>
              <Text style={styles.infoText}>: Pekerjaan Perbaikan Pos Security</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Vendor Pelaksana</Text>
              <Text style={styles.infoText}>: PT. Vendor Konstruksi</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Lokasi Kerja</Text>
              <Text style={styles.infoText}>: Stasiun Muara Bekasi</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Tanggal Dibuat</Text>
              <Text style={styles.infoText}>: {currentDate}</Text>
            </View>
          </View>
        </View>

        {/* JSA Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colNo}><Text style={styles.tableHeaderText}>No</Text></View>
            <View style={styles.colLangkah}><Text style={styles.tableHeaderText}>Urutan Langkah Kerja</Text></View>
            <View style={styles.colBahaya}><Text style={styles.tableHeaderText}>Potensi Bahaya</Text></View>
            <View style={styles.colMitigasi}><Text style={styles.tableHeaderText}>Mitigasi / Pengendalian</Text></View>
          </View>

          {steps.map((step, index) => (
            <View key={step.id} style={styles.tableRow}>
              <View style={styles.colNo}><Text>{index + 1}</Text></View>
              <View style={styles.colLangkah}><Text>{step.langkah || '-'}</Text></View>
              <View style={styles.colBahaya}><Text>{step.bahaya || '-'}</Text></View>
              <View style={styles.colMitigasi}><Text>{step.mitigasi || '-'}</Text></View>
            </View>
          ))}
          
          {steps.length === 0 && (
            <View style={styles.tableRow}>
              <View style={styles.colNo}><Text>-</Text></View>
              <View style={styles.colLangkah}><Text>Belum ada data langkah kerja</Text></View>
              <View style={styles.colBahaya}><Text>-</Text></View>
              <View style={styles.colMitigasi}><Text>-</Text></View>
            </View>
          )}
        </View>

        {/* Signatures */}
        <View style={styles.signSection}>
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>Dibuat Oleh,</Text>
            <Text style={styles.signName}>Nama Vendor SPV</Text>
            <Text style={styles.signRole}>Supervisor Vendor</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>Diperiksa Oleh,</Text>
            <Text style={styles.signName}>Nama Safety Vendor</Text>
            <Text style={styles.signRole}>Safety Officer Vendor</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>Disetujui Oleh,</Text>
            <Text style={styles.signName}>__________________</Text>
            <Text style={styles.signRole}>HSE PGN</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
