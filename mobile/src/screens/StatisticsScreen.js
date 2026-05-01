import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Dimensions, ActivityIndicator, Alert, Share 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../config/theme';
import useStatsStore from '../store/statsStore';
import useAnimalStore from '../store/animalStore';
import useThemeStore from '../store/themeStore';


const { width } = Dimensions.get('window');

export default function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const { farmStats, fetchFarmStats, isLoading } = useStatsStore();
  const { animals } = useAnimalStore();
  const { getColors, isDarkMode } = useThemeStore();
  const COLORS = getColors();
  
  const [selectedPeriod, setSelectedPeriod] = useState('daily');


  useEffect(() => {
    fetchFarmStats();
  }, []);

  const generatePDF = async () => {
    const html = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #1e293b; }
            .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; }
            .logo { font-size: 28px; font-weight: bold; color: #4f46e5; }
            .title { font-size: 22px; margin-top: 20px; }
            .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
            .card-title { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
            .card-value { font-size: 20px; font-weight: bold; }
            .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">🛡 SMART SHEPHERD</div>
            <div class="title">Rapport de Performance - ${selectedPeriod.toUpperCase()}</div>
            <div style="font-size: 12px; color: #64748b;">Généré le ${new Date().toLocaleDateString()}</div>
          </div>
          
          <div class="stats-grid">
            <div class="card">
              <div class="card-title">Animaux Totaux</div>
              <div class="card-value">${animals.length}</div>
            </div>
            <div class="card">
              <div class="card-title">État du Système</div>
              <div class="card-value" style="color: #22c55e;">OPÉRATIONNEL</div>
            </div>
          </div>

          <h3 style="margin-top: 40px;">Résumé de l'Activité</h3>
          <p>Le troupeau a parcouru environ 42.5 km au total aujourd'hui avec un taux d'activité moyen de 68%.</p>

          <div class="footer">
            © 2026 Smart Shepherd Platform - Solution de Tracking IOT Professionnelle
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de générer le rapport PDF.');
    }
  };

  const chartConfig = {
    backgroundGradientFrom: COLORS.card,
    backgroundGradientTo: COLORS.card,
    color: (opacity = 1) => isDarkMode ? `rgba(46, 204, 113, ${opacity})` : `rgba(39, 174, 96, ${opacity})`,
    labelColor: (opacity = 1) => COLORS.textMuted,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 1,
  };

  const healthData = {
    labels: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
    datasets: [{
      data: [38.2, 38.5, 38.4, 38.9, 39.1, 38.7, 38.5]
    }]
  };

  if (isLoading && !farmStats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>Supervision de l'exploitation</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={generatePDF}>
          <Ionicons name="document-text-outline" size={20} color={COLORS.white} />
          <Text style={styles.exportText}>PDF</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* -- Period Selector -- */}
        <View style={styles.periodRow}>
          {['daily', 'weekly', 'monthly'].map(p => (
            <TouchableOpacity 
              key={p} 
              style={[styles.periodBtn, selectedPeriod === p && styles.periodBtnActive]}
              onPress={() => setSelectedPeriod(p)}
            >
              <Text style={[styles.periodBtnText, selectedPeriod === p && styles.textWhite]}>
                {p === 'daily' ? 'Jour' : p === 'weekly' ? 'Semaine' : 'Mois'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* -- Key Metrics -- */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>DIST. TOTALE</Text>
            <Text style={styles.metricValue}>124.5 <Text style={styles.unit}>km</Text></Text>
            <View style={styles.trendRow}>
              <Ionicons name="trending-up" size={14} color={COLORS.success} />
              <Text style={styles.trendText}>+12% vs hier</Text>
            </View>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>ACT. MOYENNE</Text>
            <Text style={styles.metricValue}>72 <Text style={styles.unit}>%</Text></Text>
            <View style={styles.trendRow}>
              <Ionicons name="trending-down" size={14} color={COLORS.danger} />
              <Text style={[styles.trendText, { color: COLORS.danger }]}>-4% vs hier</Text>
            </View>
          </View>
        </View>

        {/* -- Health Chart -- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Évolution de la Température (°C)</Text>
          <LineChart
            data={healthData}
            width={width - 40}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        </View>

        {/* -- Status Distribution -- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>État de Santé Global</Text>
          <View style={styles.pieContainer}>
            <PieChart
              data={[
                { name: 'Sain', population: 85, color: COLORS.success, legendFontColor: COLORS.textMuted },
                { name: 'Alerte', population: 10, color: COLORS.warning, legendFontColor: COLORS.textMuted },
                { name: 'Danger', population: 5, color: COLORS.danger, legendFontColor: COLORS.textMuted },
              ]}
              width={width - 40}
              height={180}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 20, 
    paddingVertical: 20,
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border
  },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: COLORS.textMuted, fontSize: 14, marginTop: 4 },
  exportBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.primary, 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    borderRadius: 12, 
    gap: 8,
    ...SHADOWS.soft
  },
  exportText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
  scrollContent: { padding: 20 },
  
  periodRow: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 14, padding: 4, marginBottom: 25, borderWidth: 1, borderColor: COLORS.border },
  periodBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  periodBtnActive: { backgroundColor: COLORS.primary, ...SHADOWS.soft },
  periodBtnText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700' },
  textWhite: { color: COLORS.white },

  metricsGrid: { flexDirection: 'row', gap: 15, marginBottom: 25 },
  metricCard: { flex: 1, backgroundColor: COLORS.card, padding: 18, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft },
  metricLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  metricValue: { color: COLORS.text, fontSize: 24, fontWeight: '900', marginTop: 10 },
  unit: { fontSize: 14, fontWeight: '400', color: COLORS.textMuted },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  trendText: { color: COLORS.success, fontSize: 11, fontWeight: '700' },

  section: { marginBottom: 30 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginBottom: 15 },
  chart: { borderRadius: 24, marginVertical: 8 },
  pieContainer: { backgroundColor: COLORS.card, borderRadius: 24, paddingVertical: 15, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft }
});
