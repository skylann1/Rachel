import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 20,
  },
  headerCol1: {
    width: '25%',
    borderRightWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  headerCol2: {
    width: '50%',
    borderRightWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  headerCol3: {
    width: '25%',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: 5,
  },
  titleBig: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    textAlign: 'center',
  },
  titleMedium: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  infoText: {
    fontSize: 8,
    marginBottom: 2,
  },
  
  // Table
  table: {
    display: 'flex',
    flexDirection: 'column',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#000',
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableHeader: {
    backgroundColor: '#f1f5f9',
    fontFamily: 'Helvetica-Bold',
  },
  cellNo: {
    width: '8%',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    padding: 5,
    textAlign: 'center',
  },
  cellStep: {
    width: '30%',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    padding: 5,
  },
  cellHazard: {
    width: '30%',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    padding: 5,
  },
  cellMitigation: {
    width: '32%',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    padding: 5,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  bullet: {
    width: 10,
  },
  bulletText: {
    flex: 1,
  },
  
  // Signatures
  signatureArea: {
    flexDirection: 'row',
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#000',
  },
  sigBox: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: '#000',
    padding: 10,
    alignItems: 'center',
    minHeight: 80,
  },
  sigBoxLast: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    minHeight: 80,
  },
  sigTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 30,
  },
  sigName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    textDecoration: 'underline',
  },
  sigRole: {
    fontSize: 9,
  }
});

interface JsaPDFProps {
  project: any;
  jsaSteps: any[];
}

export const JsaPDF: React.FC<JsaPDFProps> = ({ project, jsaSteps }) => {
  const parseField = (field: any) => {
    if (!field) return [];
    try {
      const parsed = typeof field === 'string' ? JSON.parse(field) : field;
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object') {
        return Object.values(parsed).filter(v => typeof v === 'string' && v.trim() !== '');
      }
      return [String(parsed)];
    } catch(e) {
      return [String(field)];
    }
  };

  const parseControls = (field: any) => {
    if (!field) return [];
    try {
      const parsed = typeof field === 'string' ? JSON.parse(field) : field;
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object') {
         let vals: string[] = [];
         if (parsed.mitigasi && typeof parsed.mitigasi === 'object') {
             vals = Object.values(parsed.mitigasi).filter(v => typeof v === 'string' && v.trim() !== '') as string[];
         } else {
             vals = Object.values(parsed).filter(v => typeof v === 'string' && v.trim() !== '') as string[];
         }
         return vals;
      }
      return [String(parsed)];
    } catch(e) {
      return [String(field)];
    }
  };

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        
        <View style={styles.header}>
          <View style={styles.headerCol1}>
            <Text>LOGO PGN / VENDOR</Text>
          </View>
          <View style={styles.headerCol2}>
            <Text style={styles.titleBig}>JOB SAFETY ANALYSIS (JSA)</Text>
            <Text style={styles.titleMedium}>{project.name.toUpperCase()}</Text>
          </View>
          <View style={styles.headerCol3}>
            <Text style={styles.infoText}>JSA No  : JSA-{project.id.substring(0,6).toUpperCase()}</Text>
            <Text style={styles.infoText}>Tanggal : {new Date(project.created_at).toLocaleDateString('id-ID')}</Text>
            <Text style={styles.infoText}>Lokasi  : {project.location || '-'}</Text>
            <Text style={styles.infoText}>Vendor  : {project.vendors?.company_name || '-'}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.cellNo}>No</Text>
            <Text style={styles.cellStep}>Langkah Pekerjaan</Text>
            <Text style={styles.cellHazard}>Bahaya / Konsekuensi</Text>
            <Text style={styles.cellMitigation}>Mitigasi / Pengendalian</Text>
          </View>

          {jsaSteps.map((step, idx) => {
            const hazards = parseField(step.bahaya);
            const controls = parseControls(step.tindakan);
            
            return (
              <View key={step.id} style={styles.tableRow}>
                <Text style={styles.cellNo}>{idx + 1}</Text>
                <Text style={styles.cellStep}>{step.pekerjaan}</Text>
                
                <View style={styles.cellHazard}>
                  {hazards.map((h: string, i: number) => (
                    <View key={i} style={styles.bulletPoint}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.bulletText}>{h}</Text>
                    </View>
                  ))}
                  {hazards.length === 0 && <Text>-</Text>}
                </View>

                <View style={styles.cellMitigation}>
                  {controls.map((c: string, i: number) => (
                    <View key={i} style={styles.bulletPoint}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.bulletText}>{c}</Text>
                    </View>
                  ))}
                  {controls.length === 0 && <Text>-</Text>}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.signatureArea}>
          <View style={styles.sigBox}>
            <Text style={styles.sigTitle}>Dibuat Oleh (Vendor)</Text>
            <Text style={styles.sigName}>____________________</Text>
            <Text style={styles.sigRole}>HSE / Pengawas Vendor</Text>
          </View>
          <View style={styles.sigBox}>
            <Text style={styles.sigTitle}>Diperiksa Oleh</Text>
            <Text style={styles.sigName}>____________________</Text>
            <Text style={styles.sigRole}>Pengawas Pekerjaan PGN</Text>
          </View>
          <View style={styles.sigBoxLast}>
            <Text style={styles.sigTitle}>Disetujui Oleh</Text>
            <Text style={styles.sigName}>____________________</Text>
            <Text style={styles.sigRole}>Project Manager / HSE PGN</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
};
