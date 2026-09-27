import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

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
  incident?: {
    vendorName: string;
    projectName: string;
    type: string;
    incident_date: string;
    incident_time: string;
    location: string;
    chronology: string;
    immediateAction?: string | null;
    reporterName?: string | null;
    investigatorName?: string | null;
  } | null;
}

function formatIncidentDate(date?: string): string {
  if (!date) return '—';
  const parsed = new Date(`${date}T00:00:00`);
  if (isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatIncidentTime(time?: string): string {
  if (!time) return '—';
  const hhmm = time.slice(0, 5);
  return hhmm.length === 5 ? `${hhmm} WIB` : time;
}

export default function IncidentPDF({ incidentId, investigation, incident }: IncidentPDFProps) {
  const currentDate = new Date().toLocaleDateString('id-ID');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header Document */}
        <View style={styles.headerBox}>
          <View style={styles.logoBox}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0ea5e9' }}>RACHEL</Text>
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
          <Text style={styles.value}>: {incident?.vendorName || '—'}</Text>
        </View>
        <View style={styles.rowGroup}>
          <Text style={styles.label}>Proyek Terkait</Text>
          <Text style={styles.value}>: {incident?.projectName || '—'}</Text>
        </View>
        <View style={styles.rowGroup}>
          <Text style={styles.label}>Klasifikasi Insiden</Text>
          <Text style={styles.value}>: {incident?.type || '—'}</Text>
        </View>
        <View style={styles.rowGroup}>
          <Text style={styles.label}>Waktu & Lokasi</Text>
          <Text style={styles.value}>: {formatIncidentDate(incident?.incident_date)} {formatIncidentTime(incident?.incident_time)} | {incident?.location || '—'}</Text>
        </View>
        <View style={{ marginTop: 10, marginBottom: 5 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>Kronologi Awal:</Text>
          <View style={styles.multilineBox}>
            <Text>{incident?.chronology || '(Belum diisi)'}</Text>
          </View>
        </View>
        {incident?.immediateAction && (
          <View style={{ marginBottom: 5 }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>Tindakan Langsung (Immediate Action):</Text>
            <View style={styles.multilineBox}>
              <Text>{incident.immediateAction}</Text>
            </View>
          </View>
        )}

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
            <Text style={styles.signName}>{incident?.reporterName || '__________________'}</Text>
            <Text style={styles.signRole}>{incident?.vendorName || 'Vendor'}</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>Diinvestigasi Oleh,</Text>
            <Text style={styles.signName}>{incident?.investigatorName || '__________________'}</Text>
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
