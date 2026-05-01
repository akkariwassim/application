import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Formik } from 'formik';
import * as Yup from 'yup';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import { SHADOWS } from '../config/theme';

const LoginSchema = Yup.object().shape({
  email:    Yup.string().email('Email invalide').required('L\'email est requis'),
  password: Yup.string().min(6, 'Minimum 6 caractères').required('Le mot de passe est requis'),
});

export default function LoginScreen({ navigation }) {
  const [showPwd, setShowPwd] = useState(false);
  const { login, error, isLoading, clearError } = useAuthStore();
  const { getColors } = useThemeStore();
  const COLORS = getColors();
  const styles = createStyles(COLORS);

  const handleLogin = async (values) => {
    clearError();
    await login(values.email, values.password);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <MaterialCommunityIcons name="shield-check" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Smart Fence</Text>
          <Text style={styles.subtitle}>Gestion intelligente du bétail</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connexion</Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Formik
            initialValues={{ email: '', password: '' }}
            validationSchema={LoginSchema}
            onSubmit={handleLogin}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View style={[styles.inputWrap, touched.email && errors.email && styles.inputError]}>
                    <Ionicons name="mail-outline" size={18} color={COLORS.textDim} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="votre@email.com"
                      placeholderTextColor={COLORS.textDim}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={values.email}
                      onChangeText={handleChange('email')}
                      onBlur={handleBlur('email')}
                    />
                  </View>
                  {touched.email && errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Mot de passe</Text>
                  <View style={[styles.inputWrap, touched.password && errors.password && styles.inputError]}>
                    <Ionicons name="lock-closed-outline" size={18} color={COLORS.textDim} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor={COLORS.textDim}
                      secureTextEntry={!showPwd}
                      value={values.password}
                      onChangeText={handleChange('password')}
                      onBlur={handleBlur('password')}
                    />
                    <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={styles.eyeBtn}>
                      <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textDim} />
                    </TouchableOpacity>
                  </View>
                  {touched.password && errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
                </View>

                <TouchableOpacity
                  style={[styles.btn, isLoading && styles.btnDisabled]}
                  onPress={handleSubmit}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading
                    ? <ActivityIndicator color={COLORS.white} />
                    : <Text style={styles.btnText}>Se Connecter</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </Formik>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkRow}>
            <Text style={styles.linkText}>Pas de compte ? <Text style={styles.link}>S'inscrire</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  scroll:      { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header:      { alignItems: 'center', marginBottom: 40 },
  logoBox:     { width: 88, height: 88, borderRadius: 24, backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: COLORS.primary + '30' },
  title:       { fontSize: 34, fontWeight: '900', color: COLORS.text, letterSpacing: -1 },
  subtitle:    { fontSize: 15, color: COLORS.textMuted, marginTop: 4, fontWeight: '500' },
  
  card:        { backgroundColor: COLORS.card, borderRadius: 32, padding: 24, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.hard },
  cardTitle:   { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 24 },
  
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.danger + '15', borderRadius: 14, padding: 14, marginBottom: 20, gap: 10, borderWidth: 1, borderColor: COLORS.danger + '30' },
  errorText:   { color: COLORS.danger, flex: 1, fontSize: 13, fontWeight: '600' },
  
  fieldGroup:  { marginBottom: 20 },
  label:       { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, marginBottom: 8, marginLeft: 4 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16 },
  inputError:  { borderColor: COLORS.danger },
  inputIcon:   { marginRight: 10 },
  input:       { flex: 1, height: 54, color: COLORS.text, fontSize: 16, fontWeight: '600' },
  eyeBtn:      { padding: 8 },
  fieldError:  { color: COLORS.danger, fontSize: 12, marginTop: 5, marginLeft: 4, fontWeight: '600' },
  
  btn:         { backgroundColor: COLORS.primary, borderRadius: 16, height: 58, alignItems: 'center', justifyContent: 'center', marginTop: 10, ...SHADOWS.soft },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: COLORS.white, fontSize: 17, fontWeight: '800' },
  
  linkRow:     { alignItems: 'center', marginTop: 24 },
  linkText:    { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  link:        { color: COLORS.primary, fontWeight: '800' },
});
